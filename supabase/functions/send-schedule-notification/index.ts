import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const notificationSchema = z.object({
  schedule_id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  department_id: z.string().uuid(),
  department_name: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  time_start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid time format"),
  time_end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid time format"),
  notes: z.string().max(500).optional(),
  type: z.enum(['new_schedule', 'schedule_moved']),
  old_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  confirmation_token: z.string().optional(),
  sector_name: z.string().max(100).optional(),
  assignment_role_label: z.string().max(50).optional(),
});

type NotificationRequest = z.infer<typeof notificationSchema>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

const WEEKDAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS_SHORT_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const formatShortDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00');
  const weekday = WEEKDAYS_PT[date.getDay()];
  const day = date.getDate();
  const month = MONTHS_SHORT_PT[date.getMonth()];
  return `${weekday}, ${day}/${month}`;
};

const formatDate = (dateStr: string): string => {
  return formatShortDate(dateStr);
};

const buildDetailsSuffix = (sectorName?: string, roleLabel?: string): string => {
  const details = [sectorName, roleLabel].filter(Boolean).join(' - ');
  return details ? ` | ${details}` : '';
};

const formatTime = (time: string): string => {
  return time.slice(0, 5);
};

// HTML escape helper to prevent XSS in email templates
const escapeHtml = (str: string): string => {
  return str.replace(/[&<>"']/g, (c) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return entities[c] || c;
  });
};

// Send push notification via the send-push-notification function
const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`
      },
      body: JSON.stringify({ userId, title, body, data })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Push notification failed:', errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    console.log('Push notification result:', result);
    return { success: result.sent > 0 };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending push notification:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

// Send Telegram notification
const sendTelegramNotification = async (
  userId: string,
  message: string
): Promise<{ success: boolean; error?: string }> => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-telegram-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`
      },
      body: JSON.stringify({ userId, message })
    });
    const result = await response.json();
    return { success: result.sent > 0 };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending telegram notification:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-schedule-notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the authorization header to verify the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing authorization header" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify the JWT and get the caller's user ID
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !caller) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Caller authenticated:", caller.id);

    // Parse and validate input
    const rawData = await req.json();
    const validationResult = notificationSchema.safeParse(rawData);
    
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: "Invalid input", 
          details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const requestData: NotificationRequest = validationResult.data;
    console.log("Request data validated:", requestData);

    const { user_id, department_id, department_name, date, time_start, time_end, notes, type, old_date, confirmation_token, sector_name, assignment_role_label } = requestData;
    const detailsSuffix = buildDetailsSuffix(sector_name, assignment_role_label);

    // AUTHORIZATION CHECK: Verify caller is the department leader
    const { data: department, error: deptError } = await supabaseAdmin
      .from('departments')
      .select('leader_id')
      .eq('id', department_id)
      .single();

    if (deptError || !department) {
      console.error("Department not found:", deptError);
      return new Response(
        JSON.stringify({ error: "Department not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (department.leader_id !== caller.id) {
      console.error("Authorization failed: Caller is not department leader", {
        caller_id: caller.id,
        leader_id: department.leader_id
      });
      return new Response(
        JSON.stringify({ error: "Forbidden: Only department leaders can send notifications" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Authorization passed: Caller is department leader");

    // AUTHORIZATION CHECK: Verify target user is a member of the department
    const { data: membership, error: memberError } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('department_id', department_id)
      .eq('user_id', user_id)
      .single();

    if (memberError || !membership) {
      console.error("Target user is not a department member:", memberError);
      return new Response(
        JSON.stringify({ error: "Forbidden: Target user is not a member of this department" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Target user verified as department member");

    // Fetch user profile to get email, name and whatsapp
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email, name, whatsapp')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      throw new Error("User profile not found");
    }

    console.log("Sending notifications to:", profile.email, profile.whatsapp ? "WhatsApp: " + profile.whatsapp : "No WhatsApp");

    const formattedDate = formatDate(date);
    const formattedTimeStart = formatTime(time_start);
    const formattedTimeEnd = formatTime(time_end);

    let subject: string;
    let htmlContent: string;
    let whatsappMessage: string;

    // Build confirmation URLs if token is available
    const confirmUrl = confirmation_token 
      ? `${SUPABASE_URL}/functions/v1/confirm-schedule?token=${confirmation_token}&action=confirm`
      : null;
    const declineUrl = confirmation_token 
      ? `${SUPABASE_URL}/functions/v1/confirm-schedule?token=${confirmation_token}&action=decline`
      : null;

    if (type === 'new_schedule') {
      subject = `📅 Nova Escala - ${department_name}`;
      
      // WhatsApp message with confirmation links
      let whatsappConfirmation = '';
      if (confirmUrl && declineUrl) {
        whatsappConfirmation = `\n\n✅ *Confirmar presença:*\n${confirmUrl}\n\n❌ *Não poderei:*\n${declineUrl}`;
      }
      whatsappMessage = `📅 *Nova Escala - ${department_name}*\n\nOlá, ${profile.name}!\n\nVocê foi escalado para:\n📆 *Data:* ${formattedDate}\n⏰ *Horário:* ${formattedTimeStart} às ${formattedTimeEnd}${sector_name ? `\n📍 *Setor:* ${sector_name}` : ''}${assignment_role_label ? `\n👤 *Função:* ${assignment_role_label}` : ''}${notes ? `\n📝 *Observações:* ${notes}` : ''}${whatsappConfirmation}\n\n_LEVI - Sistema de Escalas_`;
      
      // HTML email with confirmation buttons
      const confirmationButtons = confirmUrl && declineUrl ? `
              <div style="margin-top: 24px; text-align: center;">
                <p style="color: #52525b; margin-bottom: 16px; font-weight: 600;">Confirme sua presença:</p>
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                  <a href="${confirmUrl}" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600; font-size: 15px;">✅ Confirmar Presença</a>
                  <a href="${declineUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600; font-size: 15px;">❌ Não Poderei</a>
                </div>
              </div>
      ` : '';

      // Parse date parts for grid
      const dateObj = new Date(date + 'T00:00:00');
      const dayNum = dateObj.getDate().toString();
      const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
      const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
      const yearNum = dateObj.getFullYear().toString();
      const initial = profile.name ? profile.name.charAt(0).toUpperCase() : '?';

      const confirmBtnsHtml = confirmUrl && declineUrl ? `
        <tr><td style="padding: 24px 28px 8px; text-align: center;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
            <td style="padding-right:8px;">
              <a href="${confirmUrl}" style="display:inline-block;background-color:#22c55e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">✅ Confirmar</a>
            </td>
            <td style="padding-left:8px;">
              <a href="${declineUrl}" style="display:inline-block;background-color:#f59e0b;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">❌ Não Poderei</a>
            </td>
          </tr></table>
        </td></tr>
      ` : '';

      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin:0;padding:20px;background-color:#0f0f13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="420" style="max-width:420px;background-color:#16161e;border:1px solid #2a2a38;border-radius:20px;overflow:hidden;">
              <!-- Header -->
              <tr><td style="background-color:#4f46e5;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#db2777 100%);padding:28px 28px 22px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td>
                  <span style="display:inline-block;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.25);border-radius:30px;padding:5px 14px;font-size:11px;font-weight:600;color:#fff;letter-spacing:1.2px;text-transform:uppercase;">📅 NOVA ESCALA</span>
                </td></tr><tr><td style="padding-top:14px;">
                  <span style="font-size:24px;color:#fff;font-weight:700;line-height:1.2;">${escapeHtml(department_name)}</span><br/>
                  <span style="font-size:13px;color:rgba(255,255,255,0.65);font-weight:300;">Você foi escalado para servir</span>
                </td></tr></table>
              </td></tr>
              <!-- Avatar -->
              <tr><td style="padding:24px 28px 16px;border-bottom:1px solid #22222e;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="width:50px;height:50px;border-radius:50%;background-color:#4f46e5;background:linear-gradient(135deg,#4f46e5,#db2777);text-align:center;vertical-align:middle;border:2px solid #2a2a38;">
                    <span style="color:#fff;font-size:20px;font-weight:700;line-height:50px;">${initial}</span>
                  </td>
                  <td style="padding-left:16px;">
                    <span style="display:block;font-size:10px;color:#5a5a7a;letter-spacing:1.2px;text-transform:uppercase;font-weight:600;">VOLUNTÁRIO</span>
                    <span style="display:block;font-size:17px;font-weight:600;color:#e8e8f0;">${escapeHtml(profile.name)}</span>
                  </td>
                </tr></table>
              </td></tr>
              <!-- Info Grid -->
              <tr><td style="padding:0;">
                <table role="presentation" cellpadding="0" cellspacing="1" border="0" width="100%" style="background-color:#22222e;">
                  <tr>
                    <td width="50%" style="background-color:#16161e;padding:18px 22px;">
                      <span style="font-size:18px;display:block;margin-bottom:6px;">📅</span>
                      <span style="font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#5a5a7a;display:block;margin-bottom:4px;">DIA</span>
                      <span style="font-size:14px;font-weight:600;color:#a78bfa;">${dayNum}</span>
                    </td>
                    <td width="50%" style="background-color:#16161e;padding:18px 22px;">
                      <span style="font-size:18px;display:block;margin-bottom:6px;">📆</span>
                      <span style="font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#5a5a7a;display:block;margin-bottom:4px;">DIA DA SEMANA</span>
                      <span style="font-size:14px;font-weight:500;color:#c8c8e0;">${weekday}</span>
                    </td>
                  </tr>
                  <tr>
                    <td width="50%" style="background-color:#16161e;padding:18px 22px;">
                      <span style="font-size:18px;display:block;margin-bottom:6px;">🗓️</span>
                      <span style="font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#5a5a7a;display:block;margin-bottom:4px;">MÊS</span>
                      <span style="font-size:14px;font-weight:500;color:#c8c8e0;">${monthName}</span>
                    </td>
                    <td width="50%" style="background-color:#16161e;padding:18px 22px;">
                      <span style="font-size:18px;display:block;margin-bottom:6px;">⏰</span>
                      <span style="font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#5a5a7a;display:block;margin-bottom:4px;">HORÁRIO</span>
                      <span style="font-size:14px;font-weight:600;color:#a78bfa;">${formattedTimeStart} - ${formattedTimeEnd}</span>
                    </td>
                  </tr>
                </table>
              </td></tr>
              <!-- Department -->
              <tr><td style="padding:18px 22px;border-bottom:1px solid #22222e;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="width:40px;height:40px;border-radius:10px;background-color:rgba(139,92,246,0.15);text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;line-height:40px;">🏢</span>
                  </td>
                  <td style="padding-left:14px;">
                    <span style="display:block;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#5a5a7a;margin-bottom:3px;">DEPARTAMENTO</span>
                    <span style="font-size:14px;font-weight:500;color:#c8c8e0;">${escapeHtml(department_name)}</span>
                  </td>
                </tr></table>
              </td></tr>
              ${sector_name ? `
              <tr><td style="padding:18px 22px;border-bottom:1px solid #22222e;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="width:40px;height:40px;border-radius:10px;background-color:rgba(59,130,246,0.15);text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;line-height:40px;">📌</span>
                  </td>
                  <td style="padding-left:14px;">
                    <span style="display:block;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#5a5a7a;margin-bottom:3px;">SETOR</span>
                    <span style="font-size:14px;font-weight:500;color:#c8c8e0;">${escapeHtml(sector_name)}</span>
                  </td>
                </tr></table>
              </td></tr>
              ` : ''}
              ${assignment_role_label ? `
              <tr><td style="padding:18px 22px;border-bottom:1px solid #22222e;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="width:40px;height:40px;border-radius:10px;background-color:rgba(219,39,119,0.15);text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;line-height:40px;">💼</span>
                  </td>
                  <td style="padding-left:14px;">
                    <span style="display:block;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#5a5a7a;margin-bottom:3px;">FUNÇÃO</span>
                    <span style="font-size:14px;font-weight:500;color:#c8c8e0;">${escapeHtml(assignment_role_label)}</span>
                  </td>
                </tr></table>
              </td></tr>
              ` : ''}
              ${notes ? `
              <tr><td style="padding:18px 22px;border-bottom:1px solid #22222e;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="width:40px;height:40px;border-radius:10px;background-color:rgba(251,191,36,0.15);text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;line-height:40px;">📝</span>
                  </td>
                  <td style="padding-left:14px;">
                    <span style="display:block;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#5a5a7a;margin-bottom:3px;">OBSERVAÇÕES</span>
                    <span style="font-size:14px;font-weight:500;color:#c8c8e0;">${escapeHtml(notes)}</span>
                  </td>
                </tr></table>
              </td></tr>
              ` : ''}
              ${confirmBtnsHtml}
              <!-- Footer -->
              <tr><td style="padding:16px 28px;background-color:#12121a;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                  <td style="font-size:11px;color:#3a3a5a;">Powered by <span style="color:#6366f1;font-weight:600;">LEVI</span></td>
                  <td align="right" style="font-size:11px;color:#3a3a5a;">Sistema de Escalas</td>
                </tr></table>
              </td></tr>
            </table>
          </td></tr></table>
        </body>
        </html>
      `;
    } else {
      // schedule_moved
      const formattedOldDate = old_date ? formatDate(old_date) : '';
      subject = `⚠️ Alteração de Escala - ${department_name}`;
      whatsappMessage = `⚠️ *Alteração de Escala - ${department_name}*\n\nOlá, ${profile.name}!\n\nSua escala foi alterada:\n❌ *De:* ${formattedOldDate}\n✅ *Para:* ${formattedDate}\n⏰ *Horário:* ${formattedTimeStart} às ${formattedTimeEnd}\n\n_LEVI - Sistema de Escalas_`;
      const oldDateObj = old_date ? new Date(old_date + 'T00:00:00') : null;
      const newDateObj = new Date(date + 'T00:00:00');
      const initial = profile.name ? profile.name.charAt(0).toUpperCase() : '?';

      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin:0;padding:20px;background-color:#0f0f13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="420" style="max-width:420px;background-color:#16161e;border:1px solid #2a2a38;border-radius:20px;overflow:hidden;">
              <!-- Header amber -->
              <tr><td style="background-color:#f59e0b;background:linear-gradient(135deg,#f59e0b 0%,#ea580c 100%);padding:28px 28px 22px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td>
                  <span style="display:inline-block;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.25);border-radius:30px;padding:5px 14px;font-size:11px;font-weight:600;color:#fff;letter-spacing:1.2px;text-transform:uppercase;">⚠️ ALTERAÇÃO</span>
                </td></tr><tr><td style="padding-top:14px;">
                  <span style="font-size:24px;color:#fff;font-weight:700;line-height:1.2;">Escala Alterada</span><br/>
                  <span style="font-size:13px;color:rgba(255,255,255,0.65);font-weight:300;">${escapeHtml(department_name)}</span>
                </td></tr></table>
              </td></tr>
              <!-- Avatar -->
              <tr><td style="padding:24px 28px 16px;border-bottom:1px solid #22222e;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="width:50px;height:50px;border-radius:50%;background-color:#f59e0b;text-align:center;vertical-align:middle;border:2px solid #2a2a38;">
                    <span style="color:#fff;font-size:20px;font-weight:700;line-height:50px;">${initial}</span>
                  </td>
                  <td style="padding-left:16px;">
                    <span style="display:block;font-size:10px;color:#5a5a7a;letter-spacing:1.2px;text-transform:uppercase;font-weight:600;">VOLUNTÁRIO</span>
                    <span style="display:block;font-size:17px;font-weight:600;color:#e8e8f0;">${escapeHtml(profile.name)}</span>
                  </td>
                </tr></table>
              </td></tr>
              <!-- Old vs New -->
              <tr><td style="padding:0;">
                <table role="presentation" cellpadding="0" cellspacing="1" border="0" width="100%" style="background-color:#22222e;">
                  <tr>
                    <td width="50%" style="background-color:#16161e;padding:18px 22px;">
                      <span style="font-size:18px;display:block;margin-bottom:6px;">❌</span>
                      <span style="font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#5a5a7a;display:block;margin-bottom:4px;">DATA ANTERIOR</span>
                      <span style="font-size:14px;font-weight:500;color:#ef4444;text-decoration:line-through;">${formattedOldDate}</span>
                    </td>
                    <td width="50%" style="background-color:#16161e;padding:18px 22px;">
                      <span style="font-size:18px;display:block;margin-bottom:6px;">✅</span>
                      <span style="font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#5a5a7a;display:block;margin-bottom:4px;">NOVA DATA</span>
                      <span style="font-size:14px;font-weight:600;color:#22c55e;">${formattedDate}</span>
                    </td>
                  </tr>
                </table>
              </td></tr>
              <!-- Horário -->
              <tr><td style="padding:18px 22px;border-bottom:1px solid #22222e;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="width:40px;height:40px;border-radius:10px;background-color:rgba(139,92,246,0.15);text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;line-height:40px;">⏰</span>
                  </td>
                  <td style="padding-left:14px;">
                    <span style="display:block;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#5a5a7a;margin-bottom:3px;">HORÁRIO</span>
                    <span style="font-size:14px;font-weight:600;color:#a78bfa;">${formattedTimeStart} às ${formattedTimeEnd}</span>
                  </td>
                </tr></table>
              </td></tr>
              <!-- Footer -->
              <tr><td style="padding:16px 28px;background-color:#12121a;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                  <td style="font-size:11px;color:#3a3a5a;">Powered by <span style="color:#6366f1;font-weight:600;">LEVI</span></td>
                  <td align="right" style="font-size:11px;color:#3a3a5a;">Sistema de Escalas</td>
                </tr></table>
              </td></tr>
            </table>
          </td></tr></table>
        </body>
        </html>
      `;
    }

    // Send notifications in parallel
    const notificationPromises: Promise<any>[] = [];

    // Email notification
    notificationPromises.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "LEVI Escalas <onboarding@resend.dev>",
          to: [profile.email],
          subject: subject,
          html: htmlContent,
        }),
      }).then(async (response) => {
        if (!response.ok) {
          const errorData = await response.text();
          console.error("Resend API error:", errorData);
          return { type: 'email', success: false, error: errorData };
        }
        const data = await response.json();
        console.log("Email sent successfully:", data);
        return { type: 'email', success: true, data };
      }).catch((error) => {
        console.error("Email error:", error);
        return { type: 'email', success: false, error: error.message };
      })
    );

    // Push notification
    const pushTitle = type === 'new_schedule' ? `📅 Nova Escala` : `⚠️ Escala Alterada`;
    const pushBody = type === 'new_schedule' 
      ? `${department_name}: ${formattedDate} às ${formattedTimeStart}${detailsSuffix}`
      : `${department_name}: alterada para ${formattedDate} às ${formattedTimeStart}${detailsSuffix}`;
    
    notificationPromises.push(
      sendPushNotification(user_id, pushTitle, pushBody, {
        type,
        department_id,
        date,
        url: '/my-schedules'
      }).then((result: { success: boolean; error?: string }) => ({
        type: 'push',
        ...result
      }))
    );

    // Telegram notification
    const telegramMsg = type === 'new_schedule'
      ? `📅 *Nova Escala - ${department_name}*\n\n📆 ${formattedDate}\n⏰ ${formattedTimeStart} às ${formattedTimeEnd}${sector_name ? `\n📍 ${sector_name}` : ''}${assignment_role_label ? `\n👤 ${assignment_role_label}` : ''}${notes ? `\n📝 ${notes}` : ''}`
      : `⚠️ *Escala Alterada - ${department_name}*\n\n📆 Nova data: ${formattedDate}\n⏰ ${formattedTimeStart} às ${formattedTimeEnd}${sector_name ? `\n📍 ${sector_name}` : ''}${assignment_role_label ? `\n👤 ${assignment_role_label}` : ''}`;

    notificationPromises.push(
      sendTelegramNotification(user_id, telegramMsg).then((result) => ({
        type: 'telegram',
        ...result
      }))
    );

    // WhatsApp notification via Z-API
    if (profile.whatsapp) {
      notificationPromises.push(
        fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`
          },
          body: JSON.stringify({
            phone: profile.whatsapp,
            message: whatsappMessage,
          })
        }).then(async (res) => {
          const data = await res.json();
          return { type: 'whatsapp', success: data.sent === true };
        }).catch((error) => {
          console.error("WhatsApp error:", error);
          return { type: 'whatsapp', success: false, error: error.message };
        })
      );
    }

    const results = await Promise.all(notificationPromises);
    console.log("Notification results:", results);

    const emailResult = results.find((r: { type: string }) => r.type === 'email');
    const pushResult = results.find((r: { type: string }) => r.type === 'push');

    // Create notification record
    const notificationMessage = type === 'new_schedule' 
      ? `${department_name}: ${formattedDate} às ${formattedTimeStart}${detailsSuffix}`
      : `Escala alterada: ${department_name} ${formattedDate} às ${formattedTimeStart}${detailsSuffix}`;

    const { error: notificationError } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: user_id,
        department_id: department_id,
        type: type,
        message: notificationMessage,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

    if (notificationError) {
      console.error("Error creating notification record:", notificationError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        email: emailResult?.success ? (emailResult as { data?: unknown }).data : null,
        push: (pushResult as { success: boolean } | undefined)?.success ?? false,
        channels: {
          email: emailResult?.success ?? false,
          push: (pushResult as { success: boolean } | undefined)?.success ?? false
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-schedule-notification:", error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

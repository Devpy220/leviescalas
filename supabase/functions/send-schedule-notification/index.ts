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
});

type NotificationRequest = z.infer<typeof notificationSchema>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
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

    const { user_id, department_id, department_name, date, time_start, time_end, notes, type, old_date, confirmation_token } = requestData;

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
      whatsappMessage = `📅 *Nova Escala - ${department_name}*\n\nOlá, ${profile.name}!\n\nVocê foi escalado para:\n📆 *Data:* ${formattedDate}\n⏰ *Horário:* ${formattedTimeStart} às ${formattedTimeEnd}${notes ? `\n📝 *Observações:* ${notes}` : ''}${whatsappConfirmation}\n\n_LEVI - Sistema de Escalas_`;
      
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

      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; padding: 24px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 24px; }
            .greeting { font-size: 18px; color: #18181b; margin-bottom: 16px; }
            .info-card { background: #f4f4f5; border-radius: 12px; padding: 16px; margin: 16px 0; }
            .info-row { display: flex; align-items: center; margin: 8px 0; }
            .info-icon { font-size: 20px; margin-right: 12px; }
            .info-text { color: #3f3f46; }
            .notes { background: #fef3c7; border-radius: 8px; padding: 12px; margin-top: 16px; }
            .notes-title { font-weight: 600; color: #92400e; margin-bottom: 4px; }
            .footer { text-align: center; padding: 16px; color: #71717a; font-size: 14px; border-top: 1px solid #e4e4e7; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📅 Nova Escala</h1>
            </div>
            <div class="content">
              <p class="greeting">Olá, <strong>${escapeHtml(profile.name)}</strong>!</p>
              <p style="color: #52525b;">Você foi escalado para o departamento <strong>${escapeHtml(department_name)}</strong>:</p>
              
              <div class="info-card">
                <div class="info-row">
                  <span class="info-icon">📆</span>
                  <span class="info-text"><strong>Data:</strong> ${formattedDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-icon">⏰</span>
                  <span class="info-text"><strong>Horário:</strong> ${formattedTimeStart} às ${formattedTimeEnd}</span>
                </div>
              </div>
              
              ${notes ? `
              <div class="notes">
                <div class="notes-title">📝 Observações:</div>
                <p style="margin: 0; color: #78350f;">${escapeHtml(notes)}</p>
              </div>
              ` : ''}

              ${confirmationButtons}
            </div>
            <div class="footer">
              Enviado pelo LEVI - Sistema de Escalas
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      // schedule_moved
      const formattedOldDate = old_date ? formatDate(old_date) : '';
      subject = `⚠️ Alteração de Escala - ${department_name}`;
      whatsappMessage = `⚠️ *Alteração de Escala - ${department_name}*\n\nOlá, ${profile.name}!\n\nSua escala foi alterada:\n❌ *De:* ${formattedOldDate}\n✅ *Para:* ${formattedDate}\n⏰ *Horário:* ${formattedTimeStart} às ${formattedTimeEnd}\n\n_LEVI - Sistema de Escalas_`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 24px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 24px; }
            .greeting { font-size: 18px; color: #18181b; margin-bottom: 16px; }
            .change-card { background: #fef3c7; border-radius: 12px; padding: 16px; margin: 16px 0; }
            .old-date { text-decoration: line-through; color: #dc2626; }
            .new-date { color: #16a34a; font-weight: 600; }
            .arrow { font-size: 24px; margin: 8px 0; text-align: center; }
            .footer { text-align: center; padding: 16px; color: #71717a; font-size: 14px; border-top: 1px solid #e4e4e7; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Alteração de Escala</h1>
            </div>
            <div class="content">
              <p class="greeting">Olá, <strong>${escapeHtml(profile.name)}</strong>!</p>
              <p style="color: #52525b;">Sua escala no departamento <strong>${escapeHtml(department_name)}</strong> foi alterada:</p>
              
              <div class="change-card">
                <p class="old-date">❌ De: ${formattedOldDate}</p>
                <div class="arrow">⬇️</div>
                <p class="new-date">✅ Para: ${formattedDate}</p>
                <p style="margin-top: 12px; color: #78350f;">⏰ Horário: ${formattedTimeStart} às ${formattedTimeEnd}</p>
              </div>
            </div>
            <div class="footer">
              Enviado pelo LEVI - Sistema de Escalas
            </div>
          </div>
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

    // Push notification (replaces WhatsApp)
    const pushTitle = type === 'new_schedule' ? `📅 Nova Escala` : `⚠️ Escala Alterada`;
    const pushBody = type === 'new_schedule' 
      ? `${department_name}: ${formattedDate} às ${formattedTimeStart}`
      : `${department_name}: alterada para ${formattedDate}`;
    
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
      ? `📅 *Nova Escala - ${department_name}*\n\n📆 ${formattedDate}\n⏰ ${formattedTimeStart} às ${formattedTimeEnd}${notes ? `\n📝 ${notes}` : ''}`
      : `⚠️ *Escala Alterada - ${department_name}*\n\n📆 Nova data: ${formattedDate}\n⏰ ${formattedTimeStart} às ${formattedTimeEnd}`;

    notificationPromises.push(
      sendTelegramNotification(user_id, telegramMsg).then((result) => ({
        type: 'telegram',
        ...result
      }))
    );

    const results = await Promise.all(notificationPromises);
    console.log("Notification results:", results);

    const emailResult = results.find((r: { type: string }) => r.type === 'email');
    const pushResult = results.find((r: { type: string }) => r.type === 'push');

    // Create notification record
    const notificationMessage = type === 'new_schedule' 
      ? `Nova escala em ${department_name} para ${formattedDate}`
      : `Escala alterada em ${department_name} para ${formattedDate}`;

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

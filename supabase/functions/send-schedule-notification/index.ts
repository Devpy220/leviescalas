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
});

type NotificationRequest = z.infer<typeof notificationSchema>;

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

    const { user_id, department_id, department_name, date, time_start, time_end, notes, type, old_date } = requestData;

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

    // Fetch user profile to get email and name
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email, name')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      throw new Error("User profile not found");
    }

    console.log("Sending email to:", profile.email);

    const formattedDate = formatDate(date);
    const formattedTimeStart = formatTime(time_start);
    const formattedTimeEnd = formatTime(time_end);

    let subject: string;
    let htmlContent: string;

    if (type === 'new_schedule') {
      subject = `📅 Nova Escala - ${department_name}`;
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
              <p class="greeting">Olá, <strong>${profile.name}</strong>!</p>
              <p style="color: #52525b;">Você foi escalado para o departamento <strong>${department_name}</strong>:</p>
              
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
                <p style="margin: 0; color: #78350f;">${notes}</p>
              </div>
              ` : ''}
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
              <p class="greeting">Olá, <strong>${profile.name}</strong>!</p>
              <p style="color: #52525b;">Sua escala no departamento <strong>${department_name}</strong> foi alterada:</p>
              
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

    // Send email via Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
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
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend API error:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const emailData = await emailResponse.json();

    console.log("Email sent successfully:", emailData);

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
      JSON.stringify({ success: true, email: emailData }),
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

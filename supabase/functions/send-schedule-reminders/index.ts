import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
};

const formatTime = (time: string): string => {
  return time.slice(0, 5);
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
    return { success: result.sent > 0 };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending push notification:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

const sendEmailReminder = async (
  email: string, 
  name: string, 
  departmentName: string, 
  date: string, 
  timeStart: string, 
  timeEnd: string,
  confirmToken: string,
  supabaseUrl: string,
  isPendingConfirmation: boolean
): Promise<{ success: boolean; error?: string }> => {
  if (!RESEND_API_KEY) {
    console.log("Resend API key not configured");
    return { success: false, error: "Resend not configured" };
  }

  const formattedDate = formatDate(date);
  const formattedTimeStart = formatTime(timeStart);
  const formattedTimeEnd = formatTime(timeEnd);

  const confirmUrlDirect = `${supabaseUrl}/functions/v1/confirm-schedule?token=${confirmToken}&action=confirm`;
  const declineUrlDirect = `${supabaseUrl}/functions/v1/confirm-schedule?token=${confirmToken}&action=decline`;

  const confirmationButtons = isPendingConfirmation ? `
    <div style="text-align: center; margin: 20px 0;">
      <p style="color: #d97706; font-weight: bold; margin-bottom: 16px;">⚠️ Você ainda não confirmou sua presença!</p>
      <a href="${confirmUrlDirect}" style="display: inline-block; background: #10b981; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-right: 8px;">
        ✅ Confirmar Presença
      </a>
      <a href="${declineUrlDirect}" style="display: inline-block; background: #ef4444; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
        ❌ Não Poderei
      </a>
    </div>
  ` : '';

  const headerColor = isPendingConfirmation 
    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
    : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';

  const subjectEmoji = isPendingConfirmation ? '⚠️' : '⏰';
  const subjectText = isPendingConfirmation 
    ? `${subjectEmoji} CONFIRME: Escala amanhã - ${departmentName}`
    : `${subjectEmoji} Lembrete: Escala amanhã - ${departmentName}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: ${headerColor}; color: white; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 24px; }
        .info-card { background: #fef3c7; border-radius: 12px; padding: 16px; margin: 16px 0; }
        .footer { text-align: center; padding: 16px; color: #71717a; font-size: 14px; border-top: 1px solid #e4e4e7; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${isPendingConfirmation ? '⚠️ Confirme sua Presença' : '⏰ Lembrete de Escala'}</h1>
        </div>
        <div class="content">
          <p>Olá, <strong>${name}</strong>!</p>
          <p>${isPendingConfirmation ? 'Você ainda não confirmou sua presença na escala de <strong>amanhã</strong>:' : 'Este é um lembrete da sua escala <strong>amanhã</strong>:'}</p>
          
          <div class="info-card">
            <p>📆 <strong>Data:</strong> ${formattedDate}</p>
            <p>⏰ <strong>Horário:</strong> ${formattedTimeStart} às ${formattedTimeEnd}</p>
            <p>🏢 <strong>Departamento:</strong> ${departmentName}</p>
          </div>

          ${confirmationButtons}
        </div>
        <div class="footer">
          LEVI - Sistema de Escalas
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "LEVI Escalas <onboarding@resend.dev>",
        to: [email],
        subject: subjectText,
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Resend API error:", errorData);
      return { success: false, error: errorData };
    }

    console.log("Email reminder sent to:", email);
    return { success: true };
  } catch (error: any) {
    console.error("Error sending email:", error);
    return { success: false, error: error.message };
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-schedule-reminders function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log("Fetching schedules for date:", tomorrowStr);

    // Fetch all schedules for tomorrow with user and department info
    const { data: schedules, error: schedulesError } = await supabaseAdmin
      .from('schedules')
      .select(`
        id,
        date,
        time_start,
        time_end,
        user_id,
        department_id,
        notes,
        confirmation_status,
        confirmation_token
      `)
      .eq('date', tomorrowStr);

    if (schedulesError) {
      console.error("Error fetching schedules:", schedulesError);
      throw schedulesError;
    }

    console.log(`Found ${schedules?.length || 0} schedules for tomorrow`);

    if (!schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No schedules for tomorrow", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let sentCount = 0;
    let errorCount = 0;
    let pendingCount = 0;

    for (const schedule of schedules) {
      try {
        const isPendingConfirmation = schedule.confirmation_status === 'pending';
        if (isPendingConfirmation) pendingCount++;

        // Get user profile
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('email, name, whatsapp')
          .eq('id', schedule.user_id)
          .single();

        if (profileError || !profile) {
          console.error("Error fetching profile for user:", schedule.user_id, profileError);
          errorCount++;
          continue;
        }

        // Get department name
        const { data: department, error: deptError } = await supabaseAdmin
          .from('departments')
          .select('name')
          .eq('id', schedule.department_id)
          .single();

        if (deptError || !department) {
          console.error("Error fetching department:", schedule.department_id, deptError);
          errorCount++;
          continue;
        }

        const formattedDate = formatDate(schedule.date);
        const formattedTimeStart = formatTime(schedule.time_start);
        const formattedTimeEnd = formatTime(schedule.time_end);

        const confirmUrl = `${supabaseUrl}/functions/v1/confirm-schedule?token=${schedule.confirmation_token}&action=confirm`;
        const declineUrl = `${supabaseUrl}/functions/v1/confirm-schedule?token=${schedule.confirmation_token}&action=decline`;

        // Send push notification (replaces WhatsApp)
        const pushTitle = isPendingConfirmation 
          ? `⚠️ Confirme sua Presença` 
          : `⏰ Lembrete de Escala`;
        const pushBody = isPendingConfirmation
          ? `Escala amanhã em ${department.name} - ${formattedTimeStart}`
          : `Amanhã: ${department.name} às ${formattedTimeStart}`;
        
        const pushResult = await sendPushNotification(
          schedule.user_id,
          pushTitle,
          pushBody,
          {
            type: isPendingConfirmation ? 'confirmation_reminder' : 'schedule_reminder',
            department_id: schedule.department_id,
            date: schedule.date,
            url: '/my-schedules'
          }
        );

        if (pushResult.success) {
          sentCount++;
        }

        // Send email reminder
        const emailResult = await sendEmailReminder(
          profile.email,
          profile.name,
          department.name,
          schedule.date,
          schedule.time_start,
          schedule.time_end,
          schedule.confirmation_token,
          supabaseUrl,
          isPendingConfirmation
        );

        if (emailResult.success) {
          sentCount++;
        }

        // Create notification record
        const notificationType = isPendingConfirmation ? 'confirmation_reminder' : 'schedule_reminder';
        const notificationMessage = isPendingConfirmation 
          ? `⚠️ Confirme sua presença: escala amanhã em ${department.name}`
          : `Lembrete: você tem escala amanhã em ${department.name}`;

        await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: schedule.user_id,
            department_id: schedule.department_id,
            schedule_id: schedule.id,
            type: notificationType,
            message: notificationMessage,
            status: 'sent',
            sent_at: new Date().toISOString()
          });

      } catch (error) {
        console.error("Error processing schedule:", schedule.id, error);
        errorCount++;
      }
    }

    console.log(`Reminders sent: ${sentCount}, Errors: ${errorCount}, Pending confirmations: ${pendingCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount, 
        errors: errorCount,
        total: schedules.length,
        pendingConfirmations: pendingCount
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-schedule-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

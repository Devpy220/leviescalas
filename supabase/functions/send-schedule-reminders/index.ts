import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
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

const sendWhatsAppMessage = async (to: string, message: string): Promise<{ success: boolean; error?: string }> => {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.log("Twilio credentials not configured");
    return { success: false, error: "Twilio not configured" };
  }

  let formattedNumber = to.replace(/\D/g, '');
  if (!formattedNumber.startsWith('55')) {
    formattedNumber = '55' + formattedNumber;
  }
  const whatsappTo = `whatsapp:+${formattedNumber}`;

  console.log("Sending WhatsApp reminder to:", whatsappTo);

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authString = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authString}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: TWILIO_WHATSAPP_FROM,
        To: whatsappTo,
        Body: message,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Twilio API error:", errorData);
      return { success: false, error: errorData };
    }

    const data = await response.json();
    console.log("WhatsApp reminder sent:", data.sid);
    return { success: true };
  } catch (error: any) {
    console.error("Error sending WhatsApp:", error);
    return { success: false, error: error.message };
  }
};

const sendEmailReminder = async (email: string, name: string, departmentName: string, date: string, timeStart: string, timeEnd: string): Promise<{ success: boolean; error?: string }> => {
  if (!RESEND_API_KEY) {
    console.log("Resend API key not configured");
    return { success: false, error: "Resend not configured" };
  }

  const formattedDate = formatDate(date);
  const formattedTimeStart = formatTime(timeStart);
  const formattedTimeEnd = formatTime(timeEnd);

  const htmlContent = `
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
        .info-card { background: #fef3c7; border-radius: 12px; padding: 16px; margin: 16px 0; }
        .footer { text-align: center; padding: 16px; color: #71717a; font-size: 14px; border-top: 1px solid #e4e4e7; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⏰ Lembrete de Escala</h1>
        </div>
        <div class="content">
          <p>Olá, <strong>${name}</strong>!</p>
          <p>Este é um lembrete da sua escala <strong>amanhã</strong>:</p>
          
          <div class="info-card">
            <p>📆 <strong>Data:</strong> ${formattedDate}</p>
            <p>⏰ <strong>Horário:</strong> ${formattedTimeStart} às ${formattedTimeEnd}</p>
            <p>🏢 <strong>Departamento:</strong> ${departmentName}</p>
          </div>
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
        subject: `⏰ Lembrete: Escala amanhã - ${departmentName}`,
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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
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
        notes
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

    for (const schedule of schedules) {
      try {
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

        // Send WhatsApp reminder if user has WhatsApp
        if (profile.whatsapp) {
          const whatsappMessage = `⏰ *Lembrete de Escala*\n\nOlá, ${profile.name}!\n\nLembrete da sua escala *amanhã*:\n📆 *Data:* ${formattedDate}\n⏰ *Horário:* ${formattedTimeStart} às ${formattedTimeEnd}\n🏢 *Departamento:* ${department.name}\n\n_LEVI - Sistema de Escalas_`;
          
          const whatsappResult = await sendWhatsAppMessage(profile.whatsapp, whatsappMessage);
          if (whatsappResult.success) {
            sentCount++;
          }
        }

        // Send email reminder
        const emailResult = await sendEmailReminder(
          profile.email,
          profile.name,
          department.name,
          schedule.date,
          schedule.time_start,
          schedule.time_end
        );

        if (emailResult.success) {
          sentCount++;
        }

        // Create notification record
        await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: schedule.user_id,
            department_id: schedule.department_id,
            schedule_id: schedule.id,
            type: 'schedule_reminder',
            message: `Lembrete: você tem escala amanhã em ${department.name}`,
            status: 'sent',
            sent_at: new Date().toISOString()
          });

      } catch (error) {
        console.error("Error processing schedule:", schedule.id, error);
        errorCount++;
      }
    }

    console.log(`Reminders sent: ${sentCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount, 
        errors: errorCount,
        total: schedules.length 
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

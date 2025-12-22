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

// Security: Validate webhook URLs to prevent SSRF attacks
const validateWebhookUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    
    // Block private IPs and metadata endpoints
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('169.254.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      console.error("Blocked webhook URL pointing to private/internal address:", hostname);
      return false;
    }
    
    // Require HTTPS for security
    if (parsed.protocol !== 'https:') {
      console.error("Blocked non-HTTPS webhook URL:", parsed.protocol);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error("Invalid webhook URL:", e);
    return false;
  }
};

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

const escapeHtml = (str: string): string => {
  return str.replace(/[&<>"']/g, (c) => {
    const entities: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    };
    return entities[c] || c;
  });
};

const sendWhatsAppMessage = async (to: string, message: string): Promise<{ success: boolean; error?: string }> => {
  console.log("=== WhatsApp Notification Attempt ===");
  console.log("TWILIO_ACCOUNT_SID configured:", !!TWILIO_ACCOUNT_SID);
  console.log("TWILIO_AUTH_TOKEN configured:", !!TWILIO_AUTH_TOKEN);
  console.log("TWILIO_WHATSAPP_FROM configured:", !!TWILIO_WHATSAPP_FROM, TWILIO_WHATSAPP_FROM ? `(${TWILIO_WHATSAPP_FROM})` : '');
  
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.log("Twilio credentials not configured - skipping WhatsApp");
    return { success: false, error: "Twilio not configured" };
  }

  let formattedNumber = to.replace(/\D/g, '');
  if (!formattedNumber.startsWith('55')) {
    formattedNumber = '55' + formattedNumber;
  }
  const whatsappTo = `whatsapp:+${formattedNumber}`;

  console.log("Original number:", to);
  console.log("Formatted WhatsApp To:", whatsappTo);
  console.log("WhatsApp From:", TWILIO_WHATSAPP_FROM);

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authString = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    console.log("Calling Twilio API...");
    
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

    const responseText = await response.text();
    console.log("Twilio response status:", response.status);
    console.log("Twilio response body:", responseText);

    if (!response.ok) {
      console.error("Twilio API error - Status:", response.status, "Body:", responseText);
      // Common Twilio WhatsApp errors:
      // 21608: The 'To' phone number is not currently opted in to receive messages from this number
      // 63007: The recipient has not opted in to receive this message
      return { success: false, error: responseText };
    }

    const data = JSON.parse(responseText);
    console.log("WhatsApp sent successfully! SID:", data.sid, "Status:", data.status);
    return { success: true };
  } catch (error: any) {
    console.error("Error sending WhatsApp:", error.message, error.stack);
    return { success: false, error: error.message };
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("auto-notify-schedule function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { record, type: eventType } = body;

    console.log("Event type:", eventType, "Record:", record);

    if (!record || eventType !== 'INSERT') {
      return new Response(
        JSON.stringify({ success: false, message: "Only INSERT events are processed" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { user_id, department_id, date, time_start, time_end, notes, id: schedule_id } = record;

    // Check if notification already exists for this schedule to prevent duplicates
    const { data: existingNotification } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('schedule_id', schedule_id)
      .eq('type', 'new_schedule')
      .maybeSingle();

    if (existingNotification) {
      console.log("Notification already exists for schedule:", schedule_id, "- skipping duplicate");
      return new Response(
        JSON.stringify({ success: true, message: "Notification already sent" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email, name, whatsapp')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      throw new Error("User profile not found");
    }

    // Get department name
    const { data: department, error: deptError } = await supabaseAdmin
      .from('departments')
      .select('name')
      .eq('id', department_id)
      .single();

    if (deptError || !department) {
      console.error("Error fetching department:", deptError);
      throw new Error("Department not found");
    }

    const formattedDate = formatDate(date);
    const formattedTimeStart = formatTime(time_start);
    const formattedTimeEnd = formatTime(time_end);

    const notificationPromises: Promise<any>[] = [];

    // Webhook payload (used by both n8n and FiqOn)
    const webhookPayload = {
      event: "schedule.created",
      timestamp: new Date().toISOString(),
      schedule: {
        id: schedule_id,
        date: date,
        date_formatted: formattedDate,
        time_start: formattedTimeStart,
        time_end: formattedTimeEnd,
        notes: notes || null,
      },
      user: {
        id: user_id,
        name: profile.name,
        email: profile.email,
        whatsapp: profile.whatsapp,
      },
      department: {
        id: department_id,
        name: department.name,
      },
    };

    // FiqOn Webhook notification - with SSRF protection
    const fiqonWebhookUrl = Deno.env.get("FIQON_WEBHOOK_URL");
    if (fiqonWebhookUrl && validateWebhookUrl(fiqonWebhookUrl)) {
      console.log("Sending to FiqOn webhook...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      notificationPromises.push(
        fetch(fiqonWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
          signal: controller.signal,
        }).then(async response => {
          clearTimeout(timeoutId);
          const responseText = await response.text();
          console.log("FiqOn response:", response.status, responseText);
          return { type: 'fiqon', success: response.ok, error: response.ok ? null : responseText };
        }).catch(error => {
          clearTimeout(timeoutId);
          console.error("FiqOn webhook error:", error);
          return { type: 'fiqon', success: false, error: error.message };
        })
      );
    } else if (fiqonWebhookUrl) {
      console.error("FIQON_WEBHOOK_URL failed validation - skipping for security");
    } else {
      console.log("FIQON_WEBHOOK_URL not configured - skipping FiqOn integration");
    }

    // n8n Webhook notification (legacy support) - with SSRF protection
    const n8nWebhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
    if (n8nWebhookUrl && validateWebhookUrl(n8nWebhookUrl)) {
      console.log("Sending to n8n webhook...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      notificationPromises.push(
        fetch(n8nWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
          signal: controller.signal,
        }).then(async response => {
          clearTimeout(timeoutId);
          const responseText = await response.text();
          console.log("n8n response:", response.status, responseText);
          return { type: 'n8n', success: response.ok, error: response.ok ? null : responseText };
        }).catch(error => {
          clearTimeout(timeoutId);
          console.error("n8n webhook error:", error);
          return { type: 'n8n', success: false, error: error.message };
        })
      );
    } else if (n8nWebhookUrl) {
      console.error("N8N_WEBHOOK_URL failed validation - skipping for security");
    } else {
      console.log("N8N_WEBHOOK_URL not configured - skipping n8n integration");
    }

    // WhatsApp notification via Twilio (fallback if n8n not configured)
    if (profile.whatsapp && !n8nWebhookUrl) {
      const whatsappMessage = `📅 *Nova Escala - ${department.name}*\n\nOlá, ${profile.name}!\n\nVocê foi escalado para:\n📆 *Data:* ${formattedDate}\n⏰ *Horário:* ${formattedTimeStart} às ${formattedTimeEnd}${notes ? `\n📝 *Observações:* ${notes}` : ''}\n\n_LEVI - Sistema de Escalas_`;
      
      notificationPromises.push(
        sendWhatsAppMessage(profile.whatsapp, whatsappMessage).then(result => ({
          type: 'whatsapp',
          ...result
        }))
      );
    }

    // Email notification
    if (RESEND_API_KEY) {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; padding: 24px; text-align: center; }
            .content { padding: 24px; }
            .info-card { background: #f4f4f5; border-radius: 12px; padding: 16px; margin: 16px 0; }
            .footer { text-align: center; padding: 16px; color: #71717a; font-size: 14px; border-top: 1px solid #e4e4e7; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>📅 Nova Escala</h1></div>
            <div class="content">
              <p>Olá, <strong>${escapeHtml(profile.name)}</strong>!</p>
              <p>Você foi escalado para o departamento <strong>${escapeHtml(department.name)}</strong>:</p>
              <div class="info-card">
                <p>📆 <strong>Data:</strong> ${formattedDate}</p>
                <p>⏰ <strong>Horário:</strong> ${formattedTimeStart} às ${formattedTimeEnd}</p>
                ${notes ? `<p>📝 <strong>Observações:</strong> ${escapeHtml(notes)}</p>` : ''}
              </div>
            </div>
            <div class="footer">LEVI - Sistema de Escalas</div>
          </div>
        </body>
        </html>
      `;

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
            subject: `📅 Nova Escala - ${department.name}`,
            html: htmlContent,
          }),
        }).then(async response => {
          if (!response.ok) {
            const errorData = await response.text();
            console.error("Resend API error:", errorData);
            return { type: 'email', success: false, error: errorData };
          }
          console.log("Auto email sent to:", profile.email);
          return { type: 'email', success: true };
        }).catch(error => {
          console.error("Email error:", error);
          return { type: 'email', success: false, error: error.message };
        })
      );
    }

    const results = await Promise.all(notificationPromises);
    console.log("Auto notification results:", results);

    // Create notification record
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: user_id,
        department_id: department_id,
        schedule_id: schedule_id,
        type: 'new_schedule',
        message: `Nova escala em ${department.name} para ${formattedDate}`,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        channels: {
          fiqon: results.find(r => r.type === 'fiqon')?.success ?? false,
          n8n: results.find(r => r.type === 'n8n')?.success ?? false,
          whatsapp: results.find(r => r.type === 'whatsapp')?.success ?? false,
          email: results.find(r => r.type === 'email')?.success ?? false
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in auto-notify-schedule:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

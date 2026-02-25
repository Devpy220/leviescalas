import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getUserIdFromJwt = (token: string): string | null => {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    const decoded = JSON.parse(atob(payload));
    return typeof decoded?.sub === "string" ? decoded.sub : null;
  } catch {
    return null;
  }
};
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const adminUserId = getUserIdFromJwt(token);

    if (!adminUserId) {
      console.error("Auth error: invalid JWT token");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify admin role
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: adminUserId,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { title, message, channels, recipientIds } = await req.json();

    if (!title || !message || !channels || !Array.isArray(channels) || channels.length === 0) {
      return new Response(
        JSON.stringify({ error: "title, message, and channels are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch profiles - all or specific recipients
    let query = supabase.from("profiles").select("id, email, name, whatsapp");
    
    if (recipientIds && Array.isArray(recipientIds) && recipientIds.length > 0) {
      query = query.in("id", recipientIds);
    }

    const { data: profiles, error: profilesError } = await query;

    if (profilesError) throw profilesError;

    const recipients = profiles || [];
    const recipientsCount = recipients.length;

    let emailSent = 0;
    let pushSent = 0;
    let telegramSent = 0;
    let whatsappSent = 0;

    // 1. In-app notifications
    if (channels.includes("inapp")) {
      const notifications = recipients.map((p) => ({
        user_id: p.id,
        type: "admin_broadcast",
        message: `📢 LEVI: ${title}\n${message}`,
        status: "sent",
        sent_at: new Date().toISOString(),
      }));

      for (let i = 0; i < notifications.length; i += 100) {
        const batch = notifications.slice(i, i + 100);
        await supabase.from("notifications").insert(batch);
      }
      console.log(`In-app: ${recipientsCount} notifications inserted`);
    }

    // 2. Email via Resend
    if (channels.includes("email") && resendApiKey) {
      const emailRecipients = recipients.filter((p) => p.email);

      for (const profile of emailRecipients) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "LEVI <onboarding@resend.dev>",
              to: [profile.email],
              subject: `📢 LEVI: ${title}`,
              html: `
                <!DOCTYPE html>
                <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body style="margin:0;padding:20px;background-color:#0f0f13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="420" style="max-width:420px;background-color:#16161e;border:1px solid #2a2a38;border-radius:20px;overflow:hidden;">
                      <tr><td style="background-color:#4f46e5;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#db2777 100%);padding:28px 28px 22px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td>
                          <span style="display:inline-block;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.25);border-radius:30px;padding:5px 14px;font-size:11px;font-weight:600;color:#fff;letter-spacing:1.2px;text-transform:uppercase;">📢 COMUNICADO OFICIAL</span>
                        </td></tr><tr><td style="padding-top:14px;">
                          <span style="font-size:24px;color:#fff;font-weight:700;line-height:1.2;">LEVI Escalas</span><br/>
                          <span style="font-size:13px;color:rgba(255,255,255,0.65);font-weight:300;">Mensagem importante para você</span>
                        </td></tr></table>
                      </td></tr>
                      <tr><td style="padding:24px 28px 16px;border-bottom:1px solid #22222e;">
                        <span style="display:block;font-size:10px;color:#5a5a7a;letter-spacing:1.2px;text-transform:uppercase;font-weight:600;margin-bottom:4px;">DESTINATÁRIO</span>
                        <span style="font-size:17px;font-weight:600;color:#e8e8f0;">${profile.name || "Voluntário"}</span>
                      </td></tr>
                      <tr><td style="padding:22px 28px;">
                        <span style="display:block;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#5a5a7a;margin-bottom:8px;">ASSUNTO</span>
                        <span style="display:block;font-size:18px;font-weight:700;color:#e8e8f0;margin-bottom:16px;">${title}</span>
                        <span style="display:block;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#5a5a7a;margin-bottom:8px;">MENSAGEM</span>
                        <span style="display:block;font-size:14px;font-weight:400;color:#c8c8e0;line-height:1.6;white-space:pre-line;">${message}</span>
                      </td></tr>
                      <tr><td style="padding:16px 28px;background-color:#12121a;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                          <td style="font-size:11px;color:#3a3a5a;">Powered by <span style="color:#6366f1;font-weight:600;">LEVI</span></td>
                          <td align="right" style="font-size:11px;color:#3a3a5a;">Sistema de Escalas</td>
                        </tr></table>
                      </td></tr>
                    </table>
                  </td></tr></table>
                </body></html>
              `,
            }),
          });

          if (res.ok) {
            emailSent++;
          } else {
            const errText = await res.text();
            console.error(`Email error for ${profile.email}:`, errText);
          }
        } catch (e) {
          console.error(`Email exception for ${profile.email}:`, e);
        }
      }
      console.log(`Email: ${emailSent}/${emailRecipients.length} sent`);
    }

    // 3. Push via PushAlert
    if (channels.includes("push")) {
      try {
        const userIds = recipients.map((p) => p.id);
        const pushRes = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            userIds,
            title: `📢 LEVI`,
            body: `${title}: ${message}`.substring(0, 200),
          }),
        });

        if (pushRes.ok) {
          const pushResult = await pushRes.json();
          pushSent = pushResult.sent || 0;
        }
      } catch (e) {
        console.error("Push error:", e);
      }
      console.log(`Push: ${pushSent} sent`);
    }

    // 4. Telegram
    if (channels.includes("telegram")) {
      const { data: telegramLinks } = await supabase
        .from("telegram_links")
        .select("user_id")
        .eq("is_active", true);

      if (telegramLinks && telegramLinks.length > 0) {
        for (const link of telegramLinks) {
          try {
            const tgRes = await fetch(`${supabaseUrl}/functions/v1/send-telegram-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                userId: link.user_id,
                message: `📢 *Comunicado LEVI*\n\n*${title}*\n\n${message}`,
              }),
            });

            if (tgRes.ok) {
              const tgResult = await tgRes.json();
              telegramSent += tgResult.sent || 0;
            }
          } catch (e) {
            console.error("Telegram error:", e);
          }
        }
      }
      console.log(`Telegram: ${telegramSent} sent`);
    }

    // 5. WhatsApp via Z-API
    if (channels.includes("whatsapp")) {
      const whatsappRecipients = recipients.filter((p) => p.whatsapp);
      const whatsappMsg = `📢 *Comunicado LEVI*\n\n*${title}*\n\n${message}`;

      for (const profile of whatsappRecipients) {
        try {
          const wpRes = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              phone: profile.whatsapp,
              message: whatsappMsg,
            }),
          });
          if (wpRes.ok) {
            const wpResult = await wpRes.json();
            if (wpResult.sent) whatsappSent++;
          }
        } catch (e) {
          console.error("WhatsApp error:", e);
        }
      }
      console.log(`WhatsApp: ${whatsappSent}/${whatsappRecipients.length} sent`);
    }

    // Save broadcast record
    await supabase.from("admin_broadcasts").insert({
      admin_user_id: adminUserId,
      title,
      message,
      channels_used: channels,
      recipients_count: recipientsCount,
      email_sent: emailSent,
      push_sent: pushSent,
      telegram_sent: telegramSent,
      sms_sent: 0,
      whatsapp_sent: whatsappSent,
    });

    return new Response(
      JSON.stringify({
        success: true,
        recipients: recipientsCount,
        email_sent: emailSent,
        push_sent: pushSent,
        telegram_sent: telegramSent,
        sms_sent: 0,
        whatsapp_sent: whatsappSent,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("send-admin-broadcast error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

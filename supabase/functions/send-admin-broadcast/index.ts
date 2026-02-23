import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sendSms = async (apiKey: string, number: string, msg: string): Promise<boolean> => {
  try {
    // Clean number: remove non-digits
    const cleanNumber = number.replace(/\D/g, '');
    if (cleanNumber.length < 10) return false;

    // Ensure country code
    const fullNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;

    const res = await fetch("https://api.smsdev.com.br/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: apiKey,
        type: 1,
        number: fullNumber,
        msg: msg.substring(0, 160),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`SMS to ${fullNumber}:`, data);
      return data.situacao === "OK" || data.codigo === "1";
    } else {
      console.error(`SMS error for ${fullNumber}:`, await res.text());
      return false;
    }
  } catch (e) {
    console.error(`SMS exception:`, e);
    return false;
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const smsdevApiKey = Deno.env.get("SMSDEV_API_KEY") ?? "";

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const adminUserId = claimsData.claims.sub as string;

    // Verify admin role
    const supabase = createClient(supabaseUrl, serviceRoleKey);
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

    const { title, message, channels } = await req.json();

    if (!title || !message || !channels || !Array.isArray(channels) || channels.length === 0) {
      return new Response(
        JSON.stringify({ error: "title, message, and channels are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, name, whatsapp");

    if (profilesError) throw profilesError;

    const recipients = profiles || [];
    const recipientsCount = recipients.length;

    let emailSent = 0;
    let pushSent = 0;
    let telegramSent = 0;
    let smsSent = 0;

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
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: #7c3aed; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 20px;">📢 Comunicado LEVI</h1>
                  </div>
                  <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                    <p style="color: #374151; margin: 0 0 8px;">Olá, <strong>${profile.name || "voluntário"}</strong>!</p>
                    <h2 style="color: #1f2937; margin: 16px 0 8px;">${title}</h2>
                    <p style="color: #4b5563; white-space: pre-line;">${message}</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">Este é um comunicado oficial do sistema LEVI Escalas.</p>
                  </div>
                </div>
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

    // 5. SMS via SMSDev
    if (channels.includes("sms") && smsdevApiKey) {
      const smsRecipients = recipients.filter((p) => p.whatsapp);
      const smsMsg = `LEVI: ${title} - ${message}`.substring(0, 160);

      for (const profile of smsRecipients) {
        const sent = await sendSms(smsdevApiKey, profile.whatsapp, smsMsg);
        if (sent) smsSent++;
      }
      console.log(`SMS: ${smsSent}/${smsRecipients.length} sent`);
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
      sms_sent: smsSent,
    });

    return new Response(
      JSON.stringify({
        success: true,
        recipients: recipientsCount,
        email_sent: emailSent,
        push_sent: pushSent,
        telegram_sent: telegramSent,
        sms_sent: smsSent,
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

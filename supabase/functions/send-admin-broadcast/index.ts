import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getUserIdFromJwt = (token: string): string | null => {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    const decoded = JSON.parse(atob(payload));
    return typeof decoded?.sub === "string" ? decoded.sub : null;
  } catch { return null; }
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
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const adminUserId = getUserIdFromJwt(token);
    if (!adminUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: adminUserId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { title, message, channels, recipientIds } = await req.json();
    if (!title || !message) {
      return new Response(JSON.stringify({ error: "title and message are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let query = supabase.from("profiles").select("id, name, whatsapp");
    if (recipientIds && Array.isArray(recipientIds) && recipientIds.length > 0) {
      query = query.in("id", recipientIds);
    }
    const { data: profiles, error: profilesError } = await query;
    if (profilesError) throw profilesError;

    const recipients = profiles || [];
    const recipientsCount = recipients.length;
    let whatsappSent = 0;

    // In-app notifications with metadata
    const notifications = recipients.map((p) => ({
      user_id: p.id,
      type: "admin_broadcast",
      message: `📢 LEVI: ${title}\n${message}`,
      status: "sent",
      sent_at: new Date().toISOString(),
      metadata: { user_name: p.name || 'Voluntário', announcement_title: `${title}\n\n${message}` },
    }));

    const { data: insertedNotifs } = await supabase
      .from("notifications")
      .insert(notifications as any)
      .select("id, user_id");

    const notifMap = new Map((insertedNotifs || []).map((n: any) => [n.user_id, n.id]));

    // WhatsApp
    const whatsappRecipients = recipients.filter((p) => p.whatsapp);
    for (const profile of whatsappRecipients) {
      try {
        const notifId = notifMap.get(profile.id);
        const viewUrl = notifId ? `${supabaseUrl}/functions/v1/view-notification?id=${notifId}` : '';
        const whatsappMsg = `📢 *Comunicado LEVI*\n\nOlá, *${profile.name}*!\n\n*${title}*\n\n${message}\n\n${viewUrl ? `👉 Ver detalhes:\n${viewUrl}\n\n` : ''}_LEVI — Escalas Inteligentes_`;

        const linkTitle = `📢 Comunicado LEVI`;
        const linkDescription = title.length > 80 ? title.slice(0, 77) + '...' : title;

        const res = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({
            phone: profile.whatsapp,
            message: whatsappMsg,
          }),
        });
        if (res.ok) {
          const result = await res.json();
          if (result.sent) whatsappSent++;
        }
      } catch (e) {
        console.error("WhatsApp error:", e);
      }
    }

    // Save broadcast record
    await supabase.from("admin_broadcasts").insert({
      admin_user_id: adminUserId,
      title, message,
      channels_used: channels || ['whatsapp'],
      recipients_count: recipientsCount,
      email_sent: 0, push_sent: 0, telegram_sent: 0, sms_sent: 0,
      whatsapp_sent: whatsappSent,
    });

    return new Response(
      JSON.stringify({ success: true, recipients: recipientsCount, whatsapp_sent: whatsappSent }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

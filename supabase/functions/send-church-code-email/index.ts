import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const requestSchema = z.object({
  churchId: z.string().uuid(),
});

const sendEmailViaResend = async (to: string, subject: string, html: string) => {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "LEVI <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    console.error("Resend error:", data);
    throw new Error(`Failed to send email: ${JSON.stringify(data)}`);
  }

  return data;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json().catch(() => null));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Allow the church creator (leader_id) OR admin to send the email
    const { data: church, error: churchErr } = await serviceClient
      .from("churches")
      .select("id, name, code, email, slug, leader_id, phone, registrant_phone, registrant_name")
      .eq("id", parsed.data.churchId)
      .maybeSingle();


    // Get registrant profile name
    const { data: registrantProfile } = await serviceClient
      .from("profiles")
      .select("name")
      .eq("id", userData.user.id)
      .maybeSingle();
    const registrantName = registrantProfile?.name || "Não informado";

    if (churchErr) throw churchErr;
    if (!church) {
      return new Response(JSON.stringify({ error: "Church not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check: must be the church creator or an admin
    const isCreator = church.leader_id === userData.user.id;
    const { data: isAdmin } = await serviceClient
      .rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });

    if (!isCreator && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const baseUrl = req.headers.get("origin") || "https://leviescalas.com.br";
    const createDeptUrl = `${baseUrl}/departments/new?churchCode=${church.code}`;
    const churchPageUrl = church.slug ? `${baseUrl}/igreja/${church.slug}` : null;

    const sendWhatsAppFallback = async (reason: string) => {
      const phone = (church as any).registrant_phone || (church as any).phone;
      if (!phone) {
        return { sent: false, channel: null, error: `email_failed: ${reason}; no_phone` };
      }
      const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
      const zToken = Deno.env.get("ZAPI_TOKEN");
      const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
      if (!instanceId || !zToken || !clientToken) {
        return { sent: false, channel: null, error: `email_failed: ${reason}; zapi_not_configured` };
      }
      const cleanNumber = String(phone).replace(/\D/g, "");
      if (cleanNumber.length < 10) {
        return { sent: false, channel: null, error: `email_failed: ${reason}; invalid_phone` };
      }
      const fullNumber = cleanNumber.startsWith("55") ? cleanNumber : `55${cleanNumber}`;
      const message =
        `🎉 *LEVI* — Igreja *${church.name}* cadastrada com sucesso!\n\n` +
        `Próximo passo: crie os departamentos/ministérios da sua igreja.\n\n` +
        `👉 ${createDeptUrl}\n\n` +
        (churchPageUrl ? `Página pública: ${churchPageUrl}\n\n` : "") +
        `⚠️ Igrejas sem departamentos em até 5 dias são removidas automaticamente.`;
      const res = await fetch(
        `https://api.z-api.io/instances/${instanceId}/token/${zToken}/send-text`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Client-Token": clientToken },
          body: JSON.stringify({ phone: fullNumber, message, delayMessage: 2 }),
        },
      );
      if (!res.ok) {
        const errText = await res.text();
        return { sent: false, channel: null, error: `email_failed: ${reason}; whatsapp_failed: ${errText}` };
      }
      return { sent: true, channel: "whatsapp", phone: fullNumber };
    };

    // Always send via WhatsApp (email disabled by product decision)
    const wa = await sendWhatsAppFallback("whatsapp_only");
    return new Response(JSON.stringify({ ok: wa.sent, ...wa }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("send-church-code-email error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});


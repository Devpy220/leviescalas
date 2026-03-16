import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Check if today is one of the fixed days (1, 8, 16, 24) in Brazil timezone
    const now = new Date();
    const brParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const dayOfMonth = parseInt(brParts.find((p) => p.type === "day")?.value ?? "0");
    const SEND_DAYS = [1, 8, 16, 24];

    if (!SEND_DAYS.includes(dayOfMonth)) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `Today is day ${dayOfMonth}, not a send day` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch all profiles with whatsapp
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, name, whatsapp")
      .neq("whatsapp", "");

    if (error || !profiles?.length) {
      return new Response(
        JSON.stringify({ sent: 0, error: error?.message || "No profiles with WhatsApp" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const PIX_KEY = "suport@leviescalas.com.br";
    const TITULAR = "EDUARDO LINO DA SILVA";

    let sent = 0;
    let errors = 0;

    for (const profile of profiles) {
      if (!profile.whatsapp) continue;

      const msg = `❤️ *Apoie o LEVI*\n\nOlá, *${profile.name}*!\n\nO LEVI é gratuito e depende do seu apoio para continuar funcionando. Qualquer valor faz a diferença!\n\n💰 *Chave PIX (E-mail):*\n${PIX_KEY}\n\n👤 *Titular:* ${TITULAR}\n\n📋 _Copie a chave acima e cole no app do seu banco._\n\n🙏 Obrigado pelo carinho!\n\n_LEVI — Escalas Inteligentes_`;

      try {
        await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ phone: profile.whatsapp, message: msg }),
        });
        sent++;
      } catch {
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, errors, total: profiles.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("send-support-whatsapp error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

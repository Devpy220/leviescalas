import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPPORT_MESSAGE = `❤️ *Apoie o Levi - Escalas Inteligentes* ❤️

Olá! Obrigado por usar o Levi para organizar suas escalas.

O Levi é gratuito e mantido com o apoio de pessoas como você. Se puder contribuir com qualquer valor, ajuda muito a manter o projeto no ar!

💰 *Chave PIX (E-mail):*
suport@leviescalas.com.br

👤 *Titular:* EDUARDO LINO DA SILVA

🔗 Veja mais em: https://leviescalas.lovable.app/apoio

Deus abençoe! 🙏`;

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all profiles with whatsapp filled
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, name, whatsapp")
      .neq("whatsapp", "")
      .not("whatsapp", "is", null);

    if (error) {
      console.error("Error fetching profiles:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!profiles || profiles.length === 0) {
      console.log("No profiles with WhatsApp found");
      return new Response(
        JSON.stringify({ success: true, sent: 0, total: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${profiles.length} profiles with WhatsApp`);

    let sent = 0;
    let failed = 0;

    for (const profile of profiles) {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/send-whatsapp-notification`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              phone: profile.whatsapp,
              message: SUPPORT_MESSAGE,
            }),
          }
        );

        const result = await res.json();
        if (result.sent) {
          sent++;
          console.log(`✅ Sent to ${profile.name}`);
        } else {
          failed++;
          console.log(`❌ Failed for ${profile.name}: ${result.error}`);
        }

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        failed++;
        console.error(`Error sending to ${profile.name}:`, err);
      }
    }

    console.log(`Support WhatsApp complete: ${sent} sent, ${failed} failed out of ${profiles.length}`);

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: profiles.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("send-support-whatsapp error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

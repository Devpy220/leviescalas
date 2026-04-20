import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { scheduleBatch } from "../_shared/whatsapp-queue.ts";
import { buildSupportMessage } from "../_shared/messageVariants.ts";

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

    const recipients = profiles
      .filter((p: any) => p.whatsapp)
      .map((p: any) => ({
        phone: p.whatsapp,
        message: buildSupportMessage({
          userId: p.id,
          userName: p.name || "Voluntário",
          pixKey: PIX_KEY,
          titular: TITULAR,
        }),
      }));

    const queued = recipients.length;
    scheduleBatch(supabaseUrl, serviceRoleKey, recipients);

    return new Response(
      JSON.stringify({ success: true, queued, total: profiles.length }),
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

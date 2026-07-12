import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { scheduleBatch } from "../_shared/whatsapp-queue.ts";
import { buildSupportOnlyMessage, randomBetween } from "../_shared/messageVariants.ts";
import { requireCronAuth } from "../_shared/cronAuth.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = await requireCronAuth(req, corsHeaders);
  if (authFail) return authFail;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Send only once per week (Wednesdays) in Brazil timezone
    const now = new Date();
    const brWeekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
    }).format(now); // e.g. "Wed"
    const SEND_WEEKDAY = "Wed";

    if (brWeekday !== SEND_WEEKDAY) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `Today is ${brWeekday}, not ${SEND_WEEKDAY}` }),
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

    // Support message only (no Instagram, no commands hint).
    // Commands hint is intentionally sent ONLY on the antepenultimate day of the
    // month, together with the blackout-collection prompt.
    const flat: { phone: string; message: string }[] = [];
    for (const p of profiles as any[]) {
      if (!p.whatsapp) continue;
      flat.push({ phone: p.whatsapp, message: buildSupportOnlyMessage(p.name || "Voluntário") });
    }

    // Shuffle recipients to avoid blasting in profile order.
    for (let i = flat.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [flat[i], flat[j]] = [flat[j], flat[i]];
    }
    const recipients = flat;

    const queued = recipients.length;
    const { promise } = scheduleBatch(supabaseUrl, serviceRoleKey, recipients, {
      forceQueue: true,
      origin: "support_whatsapp",
      minDelayMs: 15_000,
      maxDelayMs: 60_000,
    });
    await promise;


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

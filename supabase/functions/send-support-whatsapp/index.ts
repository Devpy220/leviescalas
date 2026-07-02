import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { scheduleBatch } from "../_shared/whatsapp-queue.ts";
import { buildSupportOnlyMessage, buildCommandsOnlyMessage, randomBetween } from "../_shared/messageVariants.ts";
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

    // Check if today is one of the fixed days (1, 8, 16, 24) in Brazil timezone
    const now = new Date();
    const brParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const dayOfMonth = parseInt(brParts.find((p) => p.type === "day")?.value ?? "0");
    const SEND_DAYS = [5, 20];

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

    // Support message + commands hint (2 msgs, no Instagram).
    // We flatten into a single flat queue: for each recipient add both parts
    // interleaved with other recipients via scheduleBatch's random delays.
    const flat: { phone: string; message: string }[] = [];
    for (const p of profiles as any[]) {
      if (!p.whatsapp) continue;
      flat.push({ phone: p.whatsapp, message: buildSupportOnlyMessage(p.name || "Voluntário") });
      flat.push({ phone: p.whatsapp, message: buildCommandsOnlyMessage() });
    }

    // Shuffle recipient pairs together (keep support -> commands order per phone
    // by grouping and randomizing groups).
    const groups = new Map<string, { phone: string; message: string }[]>();
    for (const r of flat) {
      const g = groups.get(r.phone) ?? [];
      g.push(r);
      groups.set(r.phone, g);
    }
    const groupArr = Array.from(groups.values());
    for (let i = groupArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [groupArr[i], groupArr[j]] = [groupArr[j], groupArr[i]];
    }
    const recipients = groupArr.flat();

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

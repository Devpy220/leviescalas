// Cron worker: processes pending messages from public.whatsapp_queue.
// Runs frequently (e.g., every minute) and dispatches a small slice each time.
// Each call sends up to MAX_PER_RUN due messages, which keeps execution well
// under the edge function timeout while still preserving randomized spacing
// (the spacing is encoded in `scheduled_for`).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { randomBetween } from "../_shared/messageVariants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PER_RUN = 5;
const MAX_ATTEMPTS = 3;

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: due, error } = await supabase
      .from("whatsapp_queue")
      .select("id, phone, message, attempts")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(MAX_PER_RUN);

    if (error) throw error;
    if (!due || due.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < due.length; i++) {
      const item = due[i] as { id: string; phone: string; message: string; attempts: number };
      try {
        const delayTyping = randomBetween(3, 8);
        const res = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ phone: item.phone, message: item.message, delayTyping }),
        });
        const body = await res.json().catch(() => ({ sent: false }));
        if (body?.sent === true) {
          await supabase.from("whatsapp_queue").update({
            status: "sent",
            sent_at: new Date().toISOString(),
            attempts: item.attempts + 1,
          }).eq("id", item.id);
          sent++;
        } else {
          const newAttempts = item.attempts + 1;
          await supabase.from("whatsapp_queue").update({
            status: newAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
            attempts: newAttempts,
            scheduled_for: new Date(Date.now() + 60_000).toISOString(),
          }).eq("id", item.id);
          failed++;
        }
      } catch (e) {
        console.error("worker item error:", e);
        const newAttempts = item.attempts + 1;
        await supabase.from("whatsapp_queue").update({
          status: newAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts: newAttempts,
          scheduled_for: new Date(Date.now() + 60_000).toISOString(),
        }).eq("id", item.id);
        failed++;
      }

      // tiny random spacing within the same run (1-6s) — humanize even within a slice
      if (i < due.length - 1) {
        await new Promise((r) => setTimeout(r, randomBetween(1, 6) * 1000));
      }
    }

    return new Response(
      JSON.stringify({ processed: due.length, sent, failed }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("process-whatsapp-queue error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

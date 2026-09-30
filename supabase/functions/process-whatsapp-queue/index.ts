// Cron worker: processes pending messages from public.whatsapp_queue.
// Runs frequently (e.g., every minute) and dispatches a small slice each time.
// When a message fails for good, the leaders of the recipient's departments
// receive a WhatsApp listing the name and phone that could not be reached.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { randomBetween } from "../_shared/messageVariants.ts";
import { requireCronAuth } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PER_RUN = 3;
// Stop picking new items after this much wall-clock time to avoid worker kills.
const TIME_BUDGET_MS = 25_000;
const MAX_ATTEMPTS = 3;
const ALERT_ORIGIN = "leader_failure_alert";

const digits = (p: string | null | undefined) => (p || "").replace(/\D/g, "");
const tail = (p: string | null | undefined) => digits(p).slice(-8);

async function alertLeaders(supabase: SupabaseClient, failures: { phone: string; origin: string | null }[]) {
  // Never alert about failed alerts (avoid loops)
  const relevant = failures.filter((f) => f.origin !== ALERT_ORIGIN && tail(f.phone).length === 8);
  if (relevant.length === 0) return;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, whatsapp")
    .not("whatsapp", "is", null);
  const all = (profiles || []) as { id: string; name: string | null; whatsapp: string | null }[];

  // leaderId -> list of "Name (phone)"
  const perLeader = new Map<string, Set<string>>();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();

  for (const f of relevant) {
    const t = tail(f.phone);
    const matches = all.filter((p) => tail(p.whatsapp) === t);
    if (matches.length === 0) continue;
    const userIds = matches.map((m) => m.id);

    const { data: mems } = await supabase
      .from("members").select("department_id").in("user_id", userIds);
    const deptIds = [...new Set((mems || []).map((m: any) => m.department_id))];
    if (deptIds.length === 0) continue;

    const { data: depts } = await supabase
      .from("departments").select("leader_id").in("id", deptIds);

    const label = `• ${matches[0].name || "Sem nome"} — ${f.phone}`;
    for (const d of depts || []) {
      const lid = (d as any).leader_id as string | null;
      if (!lid || userIds.includes(lid)) continue;
      if (!perLeader.has(lid)) perLeader.set(lid, new Set());
      perLeader.get(lid)!.add(label);
    }
  }

  for (const [leaderId, labels] of perLeader) {
    const leader = all.find((p) => p.id === leaderId);
    if (!leader?.whatsapp) continue;
    const { data: lp } = await supabase
      .from("profiles").select("whatsapp_opt_out_at").eq("id", leaderId).maybeSingle();
    if ((lp as any)?.whatsapp_opt_out_at) continue;

    // Dedupe: skip phones already reported to this leader in the last 24h
    const { data: recent } = await supabase
      .from("whatsapp_queue").select("message")
      .eq("origin", ALERT_ORIGIN).eq("phone", leader.whatsapp).gte("created_at", since);
    const already = (recent || []).map((r: any) => r.message as string).join("\n");
    const fresh = [...labels].filter((l) => !already.includes(l));
    if (fresh.length === 0) continue;

    const message =
      `⚠️ *LEVI — Mensagem não entregue*\n\n` +
      `Olá, ${leader.name?.split(" ")[0] || "líder"}! Não conseguimos enviar mensagem no WhatsApp para:\n\n` +
      `${fresh.join("\n")}\n\n` +
      `Verifique se o número está correto e se tem WhatsApp, e peça para a pessoa atualizar o cadastro no LEVI.`;

    await supabase.from("whatsapp_queue").insert({
      phone: leader.whatsapp,
      message,
      origin: ALERT_ORIGIN,
      scheduled_for: new Date(Date.now() + 30_000).toISOString(),
    });
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = await requireCronAuth(req, corsHeaders);
  if (authFail) return authFail;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: due, error } = await supabase
      .from("whatsapp_queue")
      .select("id, phone, message, attempts, origin")
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
    const finalFailures: { phone: string; origin: string | null }[] = [];

    const startedAt = Date.now();
    for (let i = 0; i < due.length; i++) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break;
      const item = due[i] as { id: string; phone: string; message: string; attempts: number; origin: string | null };
      try {
        const delayTyping = randomBetween(3, 8);
        const res = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ phone: item.phone, message: item.message, delayTyping, origin: item.origin }),
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
          const isFinal = body?.permanent === true || newAttempts >= MAX_ATTEMPTS;
          await supabase.from("whatsapp_queue").update({
            status: isFinal ? "failed" : "pending",
            attempts: newAttempts,
            scheduled_for: new Date(Date.now() + 60_000).toISOString(),
          }).eq("id", item.id);
          // Opt-out is the volunteer's choice, not a delivery failure.
          if (isFinal && body?.error !== "opted_out") finalFailures.push(item);
          failed++;
        }
      } catch (e) {
        console.error("worker item error:", e);
        const newAttempts = item.attempts + 1;
        const isFinal = newAttempts >= MAX_ATTEMPTS;
        await supabase.from("whatsapp_queue").update({
          status: isFinal ? "failed" : "pending",
          attempts: newAttempts,
          scheduled_for: new Date(Date.now() + 60_000).toISOString(),
        }).eq("id", item.id);
        if (isFinal) finalFailures.push(item);
        failed++;
      }

      if (i < due.length - 1) {
        await new Promise((r) => setTimeout(r, randomBetween(1, 3) * 1000));
      }
    }

    if (finalFailures.length > 0) {
      try {
        await alertLeaders(supabase, finalFailures);
      } catch (e) {
        console.error("leader alert error:", e);
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

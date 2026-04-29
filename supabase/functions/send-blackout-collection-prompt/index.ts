import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { scheduleBatch } from "../_shared/whatsapp-queue.ts";
import { pickVariant } from "../_shared/messageVariants.ts";
import {
  buildCandidateDays,
  formatCandidateLine,
  getActiveSlotsForUser,
  type AvailabilityRow,
} from "../_shared/scheduleDates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function isThirdToLastDayOfMonth(d: Date): boolean {
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() === lastDay - 2;
}

function daysUntilEndOfMonth(d: Date): number {
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return lastDay - d.getDate();
}

function firstName(name: string): string {
  return (name || "").trim().split(/\s+/)[0] || "amigo(a)";
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const nowBRT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const force = new URL(req.url).searchParams.get("force") === "1";

    if (!force && !isThirdToLastDayOfMonth(nowBRT)) {
      return new Response(JSON.stringify({ skipped: true, reason: "not third-to-last day of month" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const targetMonth = new Date(nowBRT.getFullYear(), nowBRT.getMonth() + 1, 1);
    const targetMonthIso = `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, "0")}-01`;
    const targetMonthName = MONTH_NAMES[targetMonth.getMonth()];
    const daysLeft = daysUntilEndOfMonth(nowBRT);
    const lastDayCurrent = new Date(nowBRT.getFullYear(), nowBRT.getMonth() + 1, 0).getDate();

    const { data: members, error: mErr } = await supabase
      .from("members")
      .select("user_id, department_id");
    if (mErr) throw mErr;

    const userIds = Array.from(new Set((members ?? []).map((m: any) => m.user_id)));
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no members" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, name, whatsapp")
      .in("id", userIds)
      .neq("whatsapp", "");
    if (pErr) throw pErr;

    const { data: existingPrompts } = await supabase
      .from("blackout_collection_prompts")
      .select("user_id")
      .eq("target_month", targetMonthIso);
    const alreadyPrompted = new Set((existingPrompts ?? []).map((p: any) => p.user_id));

    // Fetch all availability rows for these users in one go
    const { data: availabilityRows } = await supabase
      .from("member_availability")
      .select("user_id, department_id, day_of_week, time_start, time_end, is_available")
      .in("user_id", userIds);

    // Fetch department blackout limits
    const deptIds = Array.from(new Set((members ?? []).map((m: any) => m.department_id)));
    const { data: depts } = await supabase
      .from("departments")
      .select("id, name, max_blackout_dates")
      .in("id", deptIds);
    const deptById = new Map<string, { name: string; max: number }>();
    for (const d of depts ?? []) {
      deptById.set(d.id, { name: d.name, max: d.max_blackout_dates ?? 5 });
    }

    // Build per-user dept memberships
    const userDepts = new Map<string, string[]>();
    for (const m of members ?? []) {
      const arr = userDepts.get(m.user_id) ?? [];
      arr.push(m.department_id);
      userDepts.set(m.user_id, arr);
    }

    const recipients: { phone: string; message: string }[] = [];
    const promptRows: any[] = [];

    for (const p of profiles ?? []) {
      if (alreadyPrompted.has(p.id)) continue;
      if (!p.whatsapp) continue;

      // Aggregate availability rows: a slot is blocked if blocked in ALL the user's departments
      // (simpler: take union — show as candidate any slot that is_available in at least one dept)
      const userRows: AvailabilityRow[] = (availabilityRows ?? []).filter((r: any) => r.user_id === p.id);

      // Per (dow, time): is_available unless ALL dept rows say false
      const userActiveRows: AvailabilityRow[] = [];
      const depIds = userDepts.get(p.id) ?? [];
      const slotKeys = new Set<string>();
      for (const r of userRows) slotKeys.add(`${r.day_of_week}-${r.time_start}-${r.time_end}`);
      for (const key of slotKeys) {
        const [dow, ts, te] = key.split("-");
        const matching = userRows.filter(
          (r) => `${r.day_of_week}-${r.time_start}-${r.time_end}` === key,
        );
        // blocked only if blocked in all depts the user belongs to AND we have a row for each
        const blockedInAll = depIds.length > 0 && matching.length === depIds.length && matching.every((r) => r.is_available === false);
        userActiveRows.push({
          day_of_week: parseInt(dow, 10),
          time_start: ts,
          time_end: te,
          is_available: !blockedInAll,
        });
      }

      const activeSlots = getActiveSlotsForUser(userActiveRows);
      const candidates = buildCandidateDays(targetMonth.getFullYear(), targetMonth.getMonth(), activeSlots);
      if (candidates.length === 0) continue;

      // Show all candidates if <= 12, otherwise top-12
      const shown = candidates.slice(0, 12);
      const moreCount = candidates.length - shown.length;
      const linesStr = shown.map(formatCandidateLine).join("\n");
      const moreLine = moreCount > 0 ? `\n…e mais ${moreCount} dia(s)` : "";

      // Compute max-blackout summary across user's departments
      const userDeptInfos = (userDepts.get(p.id) ?? [])
        .map((id) => deptById.get(id))
        .filter(Boolean) as { name: string; max: number }[];
      const minMax = userDeptInfos.length > 0
        ? Math.min(...userDeptInfos.map((d) => d.max))
        : 5;
      const limitLine = `\n\nℹ️ Você pode bloquear até *${minMax} dia(s)* por departamento. Se passar do limite, o LEVI ignora os extras e avisa para falar com seu líder.`;

      const greet = pickVariant(`${p.id}-${targetMonthIso}`, ["Olá", "Oi", "Opa", "E aí"]);
      const close = pickVariant(`${p.id}-bo-${targetMonthIso}`, [
        "_LEVI — Escalas Inteligentes_",
        "_Até lá! — LEVI_",
        "_Equipe LEVI_",
      ]);
      const headEmoji = pickVariant(`${p.id}-emo-${targetMonthIso}`, ["📅", "🗓️", "⏰"]);

      const msg =
`${headEmoji} *LEVI — Disponibilidade de ${targetMonthName}*

${greet}, *${firstName(p.name)}*! Em *${daysLeft} dia(s)* começa *${targetMonthName}*.

Estes são os dias em que você pode ser escalado:
${linesStr}${moreLine}

Responda de uma destas formas:

🔴 *Para BLOQUEAR dias:*
   _bloquear 5/${targetMonth.getMonth() + 1}, 12/${targetMonth.getMonth() + 1}_

🟢 *Para SERVIR APENAS nestes dias* (bloqueia o restante):
   _servir 18/${targetMonth.getMonth() + 1}, 25/${targetMonth.getMonth() + 1}_

✅ *Para liberar TODOS os dias:*
   _nenhum_ (ou simplesmente não responda)${limitLine}

Você tem até *dia ${lastDayCurrent}* para responder.

${close}`;

      recipients.push({ phone: p.whatsapp, message: msg });
      promptRows.push({ user_id: p.id, target_month: targetMonthIso });
    }

    if (promptRows.length > 0) {
      await supabase
        .from("blackout_collection_prompts")
        .insert(promptRows);
    }

    for (let i = recipients.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [recipients[i], recipients[j]] = [recipients[j], recipients[i]];
    }

    const { backgrounded } = scheduleBatch(supabaseUrl, serviceRoleKey, recipients);

    return new Response(
      JSON.stringify({
        success: true,
        target_month: targetMonthIso,
        queued: recipients.length,
        backgrounded,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (e) {
    console.error("send-blackout-collection-prompt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

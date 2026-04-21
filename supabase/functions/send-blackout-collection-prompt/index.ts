import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { scheduleBatch } from "../_shared/whatsapp-queue.ts";
import { pickVariant, randomBetween } from "../_shared/messageVariants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function isThirdToLastDayOfMonth(d: Date): boolean {
  // Antepenúltimo dia: faltam exatamente 2 dias para o último dia do mês
  // Ex: mês com 31 dias -> dia 29; mês com 30 -> dia 28; fevereiro 28 -> dia 26
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

    // Check BRT date
    const nowBRT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const force = new URL(req.url).searchParams.get("force") === "1";

    if (!force && !isThirdToLastDayOfMonth(nowBRT)) {
      return new Response(JSON.stringify({ skipped: true, reason: "not third-to-last day of month" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Target month = next month, day 1
    const targetMonth = new Date(nowBRT.getFullYear(), nowBRT.getMonth() + 1, 1);
    const targetMonthIso = `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, "0")}-01`;
    const targetMonthName = MONTH_NAMES[targetMonth.getMonth()];
    const targetMonthNum = targetMonth.getMonth() + 1; // 1-12
    const daysLeft = daysUntilEndOfMonth(nowBRT); // normalmente 2

    // Find active volunteers (members with whatsapp)
    const { data: members, error: mErr } = await supabase
      .from("members")
      .select("user_id");
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

    // Skip users already prompted this target month
    const { data: existingPrompts } = await supabase
      .from("blackout_collection_prompts")
      .select("user_id")
      .eq("target_month", targetMonthIso);
    const alreadyPrompted = new Set((existingPrompts ?? []).map((p: any) => p.user_id));

    const recipients: { phone: string; message: string }[] = [];
    const promptRows: any[] = [];

    for (const p of profiles ?? []) {
      if (alreadyPrompted.has(p.id)) continue;
      if (!p.whatsapp) continue;

      const greet = pickVariant(`${p.id}-${targetMonthIso}`, ["Olá", "Oi", "Opa", "E aí"]);
      const close = pickVariant(`${p.id}-bo-${targetMonthIso}`, [
        "_LEVI — Escalas Inteligentes_",
        "_Até lá! — LEVI_",
        "_Equipe LEVI_",
      ]);
      const headEmoji = pickVariant(`${p.id}-emo-${targetMonthIso}`, ["📅", "🗓️", "⏰"]);

      const mm = String(targetMonthNum); // sem zero à esquerda: 5/5
      const lastDayCurrent = new Date(nowBRT.getFullYear(), nowBRT.getMonth() + 1, 0).getDate();

      const msg =
`${headEmoji} *LEVI — Bloqueios de ${targetMonthName}*

${greet}, *${firstName(p.name)}*! Em *${daysLeft} dia(s)* começa *${targetMonthName}*.

Se tiver dias que *não pode servir* em ${targetMonthName}, responda esta mensagem com as datas no formato *dia/mês*. Exemplos:
• 5/${mm}, 12/${mm}, 19/${mm}
• dia 7/${mm} e 14/${mm}
• 22/${mm}

Para liberar todos os dias, responda *nenhum*.
Você tem até o *dia ${lastDayCurrent}* (último dia deste mês) para responder.

${close}`;

      recipients.push({ phone: p.whatsapp, message: msg });
      promptRows.push({ user_id: p.id, target_month: targetMonthIso });
    }

    if (promptRows.length > 0) {
      await supabase
        .from("blackout_collection_prompts")
        .insert(promptRows);
    }

    // Shuffle to mix users
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

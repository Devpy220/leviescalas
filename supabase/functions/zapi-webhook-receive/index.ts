import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(p: string): string {
  return (p || "").replace(/\D/g, "");
}

// Parse blackout dates from free-text message.
// targetMonth = first day of the month being blocked.
export function parseBlackoutDates(text: string, targetMonth: Date): Date[] {
  const lower = (text || "").toLowerCase().trim();
  if (!lower) return [];

  // Clear keywords
  if (/\b(nenhum|nenhuma|nada|livre|todos|disponivel|disponível)\b/.test(lower)) {
    return [];
  }

  const tMonth = targetMonth.getMonth(); // 0-based
  const tYear = targetMonth.getFullYear();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const found = new Set<string>();

  // Pattern 1: dd/mm or dd-mm or dd.mm (optional /yyyy)
  const ddmm = /(\b\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/g;
  let m: RegExpExecArray | null;
  while ((m = ddmm.exec(lower)) !== null) {
    const day = parseInt(m[1], 10);
    const mon = parseInt(m[2], 10) - 1;
    let yr = m[3] ? parseInt(m[3], 10) : tYear;
    if (yr < 100) yr += 2000;
    if (day < 1 || day > 31 || mon < 0 || mon > 11) continue;
    const d = new Date(yr, mon, day);
    if (d.getDate() !== day || d.getMonth() !== mon) continue;
    if (d < today) continue;
    found.add(d.toISOString().slice(0, 10));
  }

  // Remove dd/mm matches from text so we can extract bare days
  const stripped = lower.replace(ddmm, " ");

  // Pattern 2: bare day numbers (1-31) separated by , ; e \n space
  const bareDays = stripped.match(/\b(\d{1,2})\b/g) ?? [];
  for (const ds of bareDays) {
    const day = parseInt(ds, 10);
    if (day < 1 || day > 31) continue;
    const d = new Date(tYear, tMonth, day);
    if (d.getDate() !== day) continue;
    if (d < today) continue;
    found.add(d.toISOString().slice(0, 10));
  }

  return Array.from(found).sort().map((s) => new Date(s + "T00:00:00"));
}

async function sendConfirmation(supabaseUrl: string, key: string, phone: string, message: string) {
  const delayTyping = Math.floor(Math.random() * 6) + 3;
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ phone, message, delayTyping }),
    });
  } catch (e) {
    console.error("confirmation send error:", e);
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload = await req.json().catch(() => ({} as any));
    console.log("Z-API webhook payload:", JSON.stringify(payload).slice(0, 500));

    // Z-API received-message payload variants
    const phoneRaw =
      payload.phone ?? payload.from ?? payload.sender ?? payload.author ?? "";
    const text =
      payload.text?.message ??
      payload.message ??
      payload.body ??
      payload.text ??
      "";
    const fromMe = payload.fromMe === true || payload.isFromMe === true;

    if (fromMe || !phoneRaw || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ ignored: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const phoneDigits = normalizePhone(String(phoneRaw));
    // Match against profiles.whatsapp by trailing digits (ignore country prefix differences)
    const tail = phoneDigits.slice(-10); // last 10 digits (DDD + number)
    if (tail.length < 10) {
      return new Response(JSON.stringify({ ignored: true, reason: "phone too short" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: candidates } = await supabase
      .from("profiles")
      .select("id, name, whatsapp")
      .neq("whatsapp", "");
    const profile = (candidates ?? []).find(
      (p: any) => normalizePhone(p.whatsapp).slice(-10) === tail,
    );

    if (!profile) {
      return new Response(JSON.stringify({ ignored: true, reason: "phone not found" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Find active prompt: most recent unresponded for this user
    const { data: prompts } = await supabase
      .from("blackout_collection_prompts")
      .select("*")
      .eq("user_id", profile.id)
      .is("responded_at", null)
      .order("sent_at", { ascending: false })
      .limit(1);

    const prompt = prompts?.[0];
    if (!prompt) {
      return new Response(JSON.stringify({ ignored: true, reason: "no active prompt" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Window: from day 28 of (target_month - 1) to day 5 of target_month
    const targetMonth = new Date(prompt.target_month + "T00:00:00");
    const windowStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth() - 1, 28);
    const windowEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 5, 23, 59, 59);
    const now = new Date();
    if (now < windowStart || now > windowEnd) {
      return new Response(JSON.stringify({ ignored: true, reason: "outside window" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const dates = parseBlackoutDates(text, targetMonth);
    const dateStrings = dates.map((d) => d.toISOString().slice(0, 10));

    // Get user's departments + max_blackout per dept
    const { data: memberships } = await supabase
      .from("members")
      .select("department_id")
      .eq("user_id", profile.id);

    const deptIds = (memberships ?? []).map((m: any) => m.department_id);
    if (deptIds.length === 0) {
      await sendConfirmation(
        supabaseUrl,
        serviceRoleKey,
        profile.whatsapp,
        `Olá *${(profile.name || "").split(" ")[0]}*! Você não está em nenhum departamento ativo. Procure seu líder.`,
      );
      return new Response(JSON.stringify({ ok: true, no_depts: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: depts } = await supabase
      .from("departments")
      .select("id, name, max_blackout_dates")
      .in("id", deptIds);

    let acceptedGlobal = new Set<string>();
    let rejectedGlobal = new Set<string>();

    for (const dept of depts ?? []) {
      const max = dept.max_blackout_dates ?? 5;

      // Get existing preferences
      const { data: existing } = await supabase
        .from("member_preferences")
        .select("blackout_dates")
        .eq("user_id", profile.id)
        .eq("department_id", dept.id)
        .maybeSingle();

      const current = new Set<string>(((existing?.blackout_dates as string[]) ?? []).map((d) => d.toString()));

      // Special case: empty dates with "nenhum" => clear
      const isClear = dateStrings.length === 0 && /\b(nenhum|nenhuma|nada|livre|todos|disponivel|disponível)\b/i.test(text);
      let finalDates: string[];

      if (isClear) {
        finalDates = [];
        for (const d of current) acceptedGlobal.add("clear:" + d);
      } else {
        // Add new dates respecting max
        const merged = new Set(current);
        for (const ds of dateStrings) {
          if (merged.size >= max) {
            rejectedGlobal.add(ds);
            continue;
          }
          if (!merged.has(ds)) {
            merged.add(ds);
            acceptedGlobal.add(ds);
          } else {
            acceptedGlobal.add(ds);
          }
        }
        finalDates = Array.from(merged).sort();
      }

      await supabase
        .from("member_preferences")
        .upsert(
          {
            user_id: profile.id,
            department_id: dept.id,
            blackout_dates: finalDates,
          },
          { onConflict: "user_id,department_id" },
        );
    }

    // Mark prompt responded
    await supabase
      .from("blackout_collection_prompts")
      .update({ responded_at: new Date().toISOString(), parsed_dates: dateStrings })
      .eq("id", prompt.id);

    // Build confirmation
    const fname = (profile.name || "").split(" ")[0] || "amigo(a)";
    const fmt = (s: string) => {
      const [y, m, d] = s.split("-");
      return `${d}/${m}`;
    };
    let confirmMsg: string;
    if (dateStrings.length === 0) {
      confirmMsg = `✅ Anotado, *${fname}*! Você está liberado(a) em todos os dias do próximo mês.\n\n_LEVI_`;
    } else {
      const acceptedList = dateStrings
        .filter((d) => !rejectedGlobal.has(d))
        .map(fmt)
        .join(", ");
      let msg = `✅ Anotado, *${fname}*! Bloqueei: ${acceptedList || "(nenhuma data válida)"}.`;
      if (rejectedGlobal.size > 0) {
        const rejList = Array.from(rejectedGlobal).map(fmt).join(", ");
        msg += `\n\n⚠️ Não consegui adicionar (limite atingido): ${rejList}.`;
      }
      msg += `\n\nSe errei alguma data, responda novamente.\n\n_LEVI_`;
      confirmMsg = msg;
    }

    await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp, confirmMsg);

    return new Response(
      JSON.stringify({
        ok: true,
        accepted: dateStrings.filter((d) => !rejectedGlobal.has(d)),
        rejected: Array.from(rejectedGlobal),
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (e) {
    console.error("zapi-webhook-receive error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

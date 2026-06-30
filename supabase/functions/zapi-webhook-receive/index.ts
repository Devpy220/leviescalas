import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  buildCandidateDays,
  getActiveSlotsForUser,
  type AvailabilityRow,
} from "../_shared/scheduleDates.ts";
import { tryHandleSwapMessage } from "./swapFlow.ts";
import { detectLang, t, fmtTime, DOW, isScheduleListCommand, translateRole } from "../_shared/whatsappI18n.ts";
import { LEVI_COMMANDS_HINT } from "../_shared/messageVariants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(p: string): string {
  return (p || "").replace(/\D/g, "");
}

export type ResponseMode = "block" | "serve_only" | "none";

export interface ParsedResponse {
  mode: ResponseMode;
  dates: string[]; // ISO YYYY-MM-DD
}

// Parse the user's reply. Detects mode from keywords, plus dates.
export function parseUserResponse(text: string, targetMonth: Date): ParsedResponse {
  const lower = (text || "").toLowerCase().trim();
  if (!lower) return { mode: "none", dates: [] };

  // Clear keywords -> liberar todos
  if (/\b(nenhum|nenhuma|nada|livre|todos|disponivel|disponível|sem bloqueio)\b/.test(lower) &&
      !/\b(servir|posso servir|apenas|somente|so|só)\b/.test(lower)) {
    return { mode: "none", dates: [] };
  }

  // Detect serve-only mode
  const serveOnly =
    /\b(servir|posso servir|vou servir|apenas|somente|so|só|disponivel em|disponível em)\b/.test(lower);

  const tMonth = targetMonth.getMonth();
  const tYear = targetMonth.getFullYear();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const found = new Set<string>();

  // ── Weekday names: "toda quarta", "todas as terças", "domingos", "segundas"
  // Expand to ALL matching dates of the target month.
  const WEEKDAY_MAP: Record<string, number> = {
    'domingo': 0, 'domingos': 0,
    'segunda': 1, 'segundas': 1, 'segunda-feira': 1, 'segundas-feiras': 1,
    'terca': 2, 'terça': 2, 'tercas': 2, 'terças': 2, 'terca-feira': 2, 'terça-feira': 2,
    'quarta': 3, 'quartas': 3, 'quarta-feira': 3, 'quartas-feiras': 3,
    'quinta': 4, 'quintas': 4, 'quinta-feira': 4, 'quintas-feiras': 4,
    'sexta': 5, 'sextas': 5, 'sexta-feira': 5, 'sextas-feiras': 5,
    'sabado': 6, 'sábado': 6, 'sabados': 6, 'sábados': 6,
  };
  const weekdayPattern = /\b(domingos?|segundas?(?:-feiras?)?|ter[cç]as?(?:-feiras?)?|quartas?(?:-feiras?)?|quintas?(?:-feiras?)?|sextas?(?:-feiras?)?|s[áa]bados?)\b/g;
  let wm: RegExpExecArray | null;
  const matchedWeekdays = new Set<number>();
  while ((wm = weekdayPattern.exec(lower)) !== null) {
    const dow = WEEKDAY_MAP[wm[1]];
    if (dow !== undefined) matchedWeekdays.add(dow);
  }
  if (matchedWeekdays.size > 0) {
    const lastDay = new Date(tYear, tMonth + 1, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      const dt = new Date(tYear, tMonth, d);
      if (dt < today) continue;
      if (matchedWeekdays.has(dt.getDay())) {
        found.add(dt.toISOString().slice(0, 10));
      }
    }
  }

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

  const stripped = lower.replace(ddmm, " ").replace(weekdayPattern, " ");
  const bareDays = stripped.match(/\b(\d{1,2})\b/g) ?? [];
  for (const ds of bareDays) {
    const day = parseInt(ds, 10);
    if (day < 1 || day > 31) continue;
    const d = new Date(tYear, tMonth, day);
    if (d.getDate() !== day) continue;
    if (d < today) continue;
    found.add(d.toISOString().slice(0, 10));
  }

  const dates = Array.from(found).sort();
  const mode: ResponseMode = serveOnly ? "serve_only" : "block";
  return { mode, dates };
}

// Backward-compat export name (legacy callers)
export function parseBlackoutDates(text: string, targetMonth: Date): Date[] {
  return parseUserResponse(text, targetMonth).dates.map((s) => new Date(s + "T00:00:00"));
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

const fmt = (s: string) => {
  const [, m, d] = s.split("-");
  return `${d}/${m}`;
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Verify webhook source via shared secret. Accept either UAZAPI_WEBHOOK_SECRET
  // (preferred — new provider) or legacy ZAPI_WEBHOOK_SECRET during the transition
  // window. Configure the same value in the UAZAPI webhook custom header
  // (X-Webhook-Secret) or as a ?secret=... query string parameter.
  const expectedSecret =
    Deno.env.get("UAZAPI_WEBHOOK_SECRET") || Deno.env.get("ZAPI_WEBHOOK_SECRET");
  if (!expectedSecret) {
    console.error("whatsapp-webhook-receive: webhook secret not configured — refusing all requests");
    return new Response(JSON.stringify({ error: "Server misconfigured: webhook secret missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  {
    const url = new URL(req.url);
    const provided =
      req.headers.get("x-webhook-secret") ||
      req.headers.get("x-uazapi-secret") ||
      req.headers.get("x-zapi-secret") ||
      url.searchParams.get("secret") ||
      "";
    if (provided !== expectedSecret) {
      console.warn("whatsapp-webhook-receive: invalid webhook secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload = await req.json().catch(() => ({} as any));
    console.log("WhatsApp webhook payload:", JSON.stringify(payload).slice(0, 2000));

    // UAZAPI payloads nest under `message`. Z-API uses flat fields. Support both.
    const uaMsg = payload.message ?? payload.Message ?? {};
    const pickStr = (...vals: any[]): string => {
      for (const v of vals) {
        if (typeof v === "string" && v.trim()) return v;
      }
      return "";
    };
    const pickPhone = (...vals: any[]): string => {
      const candidates = vals.filter((v) => typeof v === "string" && v.trim()) as string[];
      // UAZAPI can send `sender/chatlid` as a WhatsApp LID (e.g. 176...@lid),
      // which is not the volunteer phone. Prefer the canonical chat id/phone.
      return (
        candidates.find((v) => !/@lid\b/i.test(v) && normalizePhone(v).length >= 10) ||
        candidates.find((v) => normalizePhone(v).length >= 10) ||
        candidates[0] ||
        ""
      );
    };
    const phoneRaw = pickPhone(
      // UAZAPI canonical phone/JID fields — these must be preferred over LID sender fields.
      uaMsg.chatid, uaMsg.chatId, uaMsg.remoteJid, uaMsg.key?.remoteJid,
      payload.chat?.wa_chatid, payload.chat?.phone, payload.chat?.wa_fastid,
      payload.phone, payload.chatid, payload.chatId,
      // Legacy Z-API / fallback sender fields.
      payload.from, payload.author, uaMsg.from, uaMsg.sender,
      uaMsg.chatlid, uaMsg.chatLid, payload.sender, payload.chatlid, payload.chat?.wa_chatlid,
      payload.chat?.wa_lastMessageSender, payload.chat?.id,
    );
    const text = pickStr(
      // UAZAPI text fields
      uaMsg.text, uaMsg.messageText, uaMsg.content, uaMsg.body,
      // Z-API legacy fields
      payload.text?.message,
      typeof payload.message === "string" ? payload.message : "",
      payload.body,
      typeof payload.text === "string" ? payload.text : "",
    );
    const fromMe =
      uaMsg.fromMe === true || uaMsg.fromme === true ||
      payload.fromMe === true || payload.isFromMe === true;

    console.log(`[extract] fromMe=${fromMe} phoneRaw="${phoneRaw}" textLen=${text.length} text="${text.slice(0,40)}"`);

    if (fromMe || !phoneRaw || typeof text !== "string" || !text.trim()) {
      console.log(`[extract] -> ignored (fromMe=${fromMe}, hasPhone=${!!phoneRaw}, hasText=${!!text.trim()})`);
      return new Response(JSON.stringify({ ignored: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const phoneDigits = normalizePhone(String(phoneRaw));
    const tail = phoneDigits.slice(-10);
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

    console.log(`[lookup] phoneDigits=${phoneDigits} tail=${tail} candidates=${candidates?.length ?? 0} profileFound=${!!profile}`);

    if (!profile) {
      console.log(`[lookup] -> no profile match for tail=${tail}`);
      return new Response(JSON.stringify({ ignored: true, reason: "phone not found" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ─── "ajuda" / "comandos" / "menu" / "?" / standalone "levi" → send commands list ───
    const helpRegex = /^(ajuda|help|comandos?|menu|\?|oi\s+levi|ol[áa]\s+levi|levi)\s*[!?.]*$/i;
    if (helpRegex.test((text || "").trim())) {
      const fname = (profile.name || "").split(" ")[0] || "👋";
      await sendConfirmation(
        supabaseUrl,
        serviceRoleKey,
        profile.whatsapp,
        `Olá *${fname}*!\n\n${LEVI_COMMANDS_HINT}`,
      );
      return new Response(JSON.stringify({ ok: true, handled: "help" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ─── "escala" command: list user's upcoming schedules ───
    try {
      if (isScheduleListCommand(text)) {
        const lang = detectLang(profile.whatsapp);
        const today = new Date().toISOString().slice(0, 10);
        const { data: scheds } = await supabase
          .from("schedules")
          .select("date, time_start, time_end, assignment_role, department_id")
          .eq("user_id", profile.id)
          .gte("date", today)
          .order("date", { ascending: true })
          .order("time_start", { ascending: true });

        const fname = (profile.name || "").split(" ")[0] || "👋";

        if (!scheds || scheds.length === 0) {
          await sendConfirmation(
            supabaseUrl,
            serviceRoleKey,
            profile.whatsapp,
            t(lang, "no_future_schedules", { fname }),
          );
        } else {
          const deptIdsSet = Array.from(new Set(scheds.map((s: any) => s.department_id)));
          const { data: deptRows } = await supabase
            .from("departments")
            .select("id, name")
            .in("id", deptIdsSet);
          const deptName: Record<string, string> = {};
          for (const d of deptRows ?? []) deptName[d.id] = d.name;

          const grouped: Record<string, string[]> = {};
          for (const s of scheds as any[]) {
            const d = new Date(s.date + "T00:00:00");
            const [, m, dd] = s.date.split("-");
            const dow = DOW[lang][d.getDay()];
            const ts = fmtTime(s.time_start);
            const te = fmtTime(s.time_end);
            const role = s.assignment_role ? ` — ${translateRole(s.assignment_role, lang)}` : "";
            const line = `• ${dd}/${m} (${dow}) ${ts}–${te}${role}`;
            const dn = deptName[s.department_id] || "—";
            (grouped[dn] ||= []).push(line);
          }

          let msg = t(lang, "list_header", { fname });
          for (const [dn, lines] of Object.entries(grouped)) {
            msg += `\n*${dn}*\n${lines.join("\n")}\n`;
          }
          msg += t(lang, "list_footer");


          await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp, msg);
        }

        return new Response(JSON.stringify({ ok: true, handled: "schedule_list" }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    } catch (e) {
      console.error("schedule list error:", e);
    }

    // ─── Swap-over-WhatsApp router ───
    console.log(`[router] profile=${profile.id} name=${profile.name} text="${text}" trying swap`);
    try {
      const handledSwap = await tryHandleSwapMessage(
        { supabase, supabaseUrl, serviceRoleKey },
        { id: profile.id, name: profile.name, whatsapp: profile.whatsapp },
        text,
      );
      console.log(`[router] swap handled=${handledSwap}`);
      if (handledSwap) {
        return new Response(JSON.stringify({ ok: true, handled: "swap" }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    } catch (e) {
      console.error("swap flow error:", e instanceof Error ? `${e.message}\n${e.stack}` : e);
    }

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

    // Only treat as blackout response if it's a recent reply to LEVI's prompt
    // (within 60 min) OR the user used explicit blackout keywords / a date.
    // This prevents LEVI from replying to every random message the user sends.
    const lowerText = (text || "").toLowerCase();
    const hasBlackoutKeyword =
      /\b(servir|bloquear|bloqueio|bloqueado|livre|liberado|liberada|nenhum|nenhuma|nada|todos|disponivel|disponível|domingos?|segundas?|ter[cç]as?|quartas?|quintas?|sextas?|s[áa]bados?)\b/.test(lowerText) ||
      /\d{1,2}[\/\-\.]\d{1,2}/.test(lowerText) ||
      /\b\d{1,2}\b/.test(lowerText);
    const sentAt = prompt.sent_at ? new Date(prompt.sent_at).getTime() : 0;
    const recentReply = sentAt > 0 && (Date.now() - sentAt) <= 60 * 60 * 1000;
    if (!recentReply && !hasBlackoutKeyword) {
      return new Response(JSON.stringify({ ignored: true, reason: "no keyword and not a recent reply" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const targetMonth = new Date(prompt.target_month + "T00:00:00");
    const windowStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth() - 1, 28);
    const windowEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 5, 23, 59, 59);
    const now = new Date();
    if (now < windowStart || now > windowEnd) {
      return new Response(JSON.stringify({ ignored: true, reason: "outside window" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const parsed = parseUserResponse(text, targetMonth);
    const fname = (profile.name || "").split(" ")[0] || "amigo(a)";

    // If user is replying to the prompt but we couldn't extract dates AND it's not "liberar todos",
    // send a friendly "não entendi" + commands hint instead of silently doing nothing.
    if (parsed.mode !== "none" && parsed.dates.length === 0) {
      await sendConfirmation(
        supabaseUrl,
        serviceRoleKey,
        profile.whatsapp,
        `🤔 *Não entendi, ${fname}.*\n\nNão consegui identificar datas na sua resposta.\n\n${LEVI_COMMANDS_HINT}`,
      );
      return new Response(JSON.stringify({ ok: true, handled: "unparsed" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }


    // Departments + memberships + availability
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
        `Olá *${fname}*! Você não está em nenhum departamento ativo. Procure seu líder.`,
      );
      return new Response(JSON.stringify({ ok: true, no_depts: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: depts } = await supabase
      .from("departments")
      .select("id, name, max_blackout_dates")
      .in("id", deptIds);

    // Compute target blackout list per mode
    let blackoutDateStrings: string[] = [];
    let serveOnlyDates: string[] = [];
    if (parsed.mode === "none") {
      blackoutDateStrings = [];
    } else if (parsed.mode === "block") {
      blackoutDateStrings = parsed.dates;
    } else {
      // serve_only: blackouts = candidate days NOT in parsed.dates
      // Use availability per dept and union — we mark blackout = any candidate day not chosen
      const { data: availRows } = await supabase
        .from("member_availability")
        .select("day_of_week, time_start, time_end, is_available, department_id")
        .eq("user_id", profile.id);

      const userRows: AvailabilityRow[] = (availRows ?? []).map((r: any) => ({
        day_of_week: r.day_of_week,
        time_start: r.time_start,
        time_end: r.time_end,
        is_available: r.is_available,
      }));
      // Treat slot active if available in at least one row (or no row at all = default true)
      const activeSlots = getActiveSlotsForUser(userRows);
      const allCandidates = buildCandidateDays(
        targetMonth.getFullYear(),
        targetMonth.getMonth(),
        activeSlots,
      ).map((c) => c.iso);
      const chosen = new Set(parsed.dates);
      blackoutDateStrings = allCandidates.filter((iso) => !chosen.has(iso));
      serveOnlyDates = parsed.dates;
    }

    const rejectedByDept: Record<string, string[]> = {}; // deptName -> rejected ISO

    for (const dept of depts ?? []) {
      const max = dept.max_blackout_dates ?? 5;

      const { data: existing } = await supabase
        .from("member_preferences")
        .select("blackout_dates")
        .eq("user_id", profile.id)
        .eq("department_id", dept.id)
        .maybeSingle();

      const _current = new Set<string>(((existing?.blackout_dates as string[]) ?? []).map((d) => d.toString()));

      let finalDates: string[];
      const rejected: string[] = [];

      if (parsed.mode === "none") {
        finalDates = [];
      } else if (parsed.mode === "block") {
        // Replace the user's blackout list for this month (start fresh, respect max)
        // Keep prior dates from other months
        const priorOtherMonths = Array.from(_current).filter((iso) => !iso.startsWith(prompt.target_month.slice(0, 7)));
        const merged = new Set(priorOtherMonths);
        for (const ds of blackoutDateStrings) {
          if (merged.size - priorOtherMonths.length >= max) {
            rejected.push(ds);
            continue;
          }
          merged.add(ds);
        }
        finalDates = Array.from(merged).sort();
      } else {
        // serve_only: same — respect max
        const priorOtherMonths = Array.from(_current).filter((iso) => !iso.startsWith(prompt.target_month.slice(0, 7)));
        const merged = new Set(priorOtherMonths);
        // Sort blackoutDateStrings so earliest are kept first
        const sorted = [...blackoutDateStrings].sort();
        for (const ds of sorted) {
          if (merged.size - priorOtherMonths.length >= max) {
            rejected.push(ds);
            continue;
          }
          merged.add(ds);
        }
        finalDates = Array.from(merged).sort();
      }

      if (rejected.length > 0) rejectedByDept[dept.name] = rejected;

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

    await supabase
      .from("blackout_collection_prompts")
      .update({ responded_at: new Date().toISOString(), parsed_dates: parsed.dates })
      .eq("id", prompt.id);

    // Build confirmation message
    let confirmMsg: string;
    if (parsed.mode === "none") {
      confirmMsg =
`✅ *Anotado, ${fname}!*
━━━━━━━━━━━━━━━━━━━━

📖 _Leia com atenção:_
Você está *liberado(a) em todos os dias* do próximo mês.

Se quiser bloquear algum dia, é só me responder novamente.

_LEVI_`;
    } else if (parsed.mode === "block") {
      const acceptedIso = blackoutDateStrings.filter((d) =>
        !Object.values(rejectedByDept).some((arr) => arr.includes(d) && arr.length === blackoutDateStrings.length)
      );
      const acceptedList = acceptedIso.map(fmt).join(", ");
      let msg =
`🔴 *Anotado, ${fname}!*
━━━━━━━━━━━━━━━━━━━━

📖 _Leia com atenção:_

🚫 *Dias bloqueados:*
${acceptedList || "(nenhuma data válida)"}`;
      if (Object.keys(rejectedByDept).length > 0) {
        msg += `\n\n━━━━━━━━━━━━━━━━━━━━\n⚠️ *Limite atingido em alguns departamentos.*\nNão consegui bloquear estes dias:\n`;
        for (const [deptName, list] of Object.entries(rejectedByDept)) {
          msg += `\n• *${deptName}*: ${list.map(fmt).join(", ")}`;
        }
        msg += `\n\n👉 Fale com seu líder se precisar liberar mais dias.`;
      }
      msg += `\n\n━━━━━━━━━━━━━━━━━━━━\nSe errei alguma data, é só me responder novamente.\n\n_LEVI_`;
      confirmMsg = msg;
    } else {
      // serve_only
      const serveList = serveOnlyDates.map(fmt).join(", ") || "(nenhuma)";
      let msg =
`🟢 *Anotado, ${fname}!*
━━━━━━━━━━━━━━━━━━━━

📖 _Leia com atenção:_

✅ *Você servirá apenas em:*
${serveList}

🚫 Os demais dias do mês ficarão *bloqueados*.`;
      if (Object.keys(rejectedByDept).length > 0) {
        msg += `\n\n━━━━━━━━━━━━━━━━━━━━\n⚠️ *Atenção:* o limite de bloqueios foi atingido em alguns departamentos.\nAlguns dias podem continuar como disponíveis:\n`;
        for (const [deptName, list] of Object.entries(rejectedByDept)) {
          msg += `\n• *${deptName}*: ${list.length} dia(s) não bloqueados`;
        }
        msg += `\n\n👉 Fale com seu líder para ajustar.`;
      }
      msg += `\n\n━━━━━━━━━━━━━━━━━━━━\nSe errei alguma data, é só me responder novamente.\n\n_LEVI_`;
      confirmMsg = msg;
    }

    await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp, confirmMsg);

    return new Response(
      JSON.stringify({
        ok: true,
        mode: parsed.mode,
        accepted: parsed.dates,
        blackouts_applied: blackoutDateStrings,
        rejected_by_dept: rejectedByDept,
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

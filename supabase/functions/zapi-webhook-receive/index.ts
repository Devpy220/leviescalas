import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { serveOnlyBlackouts } from "../_shared/scheduleDates.ts";
import { tryHandleSwapMessage } from "./swapFlow.ts";
import { detectLang, t, fmtTime, DOW, isScheduleListCommand, translateRole } from "../_shared/whatsappI18n.ts";
import { LEVI_COMMANDS_HINT, buildSupportOnlyMessage } from "../_shared/messageVariants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(p: string): string {
  return (p || "").replace(/\D/g, "");
}

export type ResponseMode = "block" | "serve_only" | "none";

export interface WeeklyBlock {
  dow: number;          // 0..6
  timeStart: string;    // HH:mm
  timeEnd: string;      // HH:mm
  label: string;        // e.g. "Domingo de Manhã"
}

export interface ParsedResponse {
  mode: ResponseMode;
  dates: string[]; // ISO YYYY-MM-DD
  weeklyBlocks?: WeeklyBlock[];
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
  // dow -> shift ('manha' | 'noite' | undefined for whole day)
  const weekdayShifts = new Map<number, 'manha' | 'noite' | undefined>();
  while ((wm = weekdayPattern.exec(lower)) !== null) {
    const dow = WEEKDAY_MAP[wm[1]];
    if (dow === undefined) continue;
    // look ±40 chars around the match for a shift word
    const start = Math.max(0, wm.index - 5);
    const end = Math.min(lower.length, wm.index + wm[0].length + 40);
    const ctx = lower.slice(start, end);
    let shift: 'manha' | 'noite' | undefined;
    if (/\b(manh[ãa]|cedo|matutin[oa]s?)\b/.test(ctx)) shift = 'manha';
    else if (/\b(noite|noturn[oa]s?|tarde|vespertin[oa]s?)\b/.test(ctx)) shift = 'noite';
    // If we already saw this dow with a stronger (shift) marker, keep the shift.
    if (!weekdayShifts.has(dow) || (shift && !weekdayShifts.get(dow))) {
      weekdayShifts.set(dow, shift);
    }
  }

  const weeklyBlocks: WeeklyBlock[] = [];
  const WEEKDAY_LABELS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

  if (weekdayShifts.size > 0) {
    const lastDay = new Date(tYear, tMonth + 1, 0).getDate();
    for (const [dow, shift] of weekdayShifts.entries()) {
      // Keywords like "domingos de manhã", "domingos de noite", "quartas"
      // apply ONLY to the upcoming month — enumerate all matching dates.
      // (Not permanent — user must resend next month if they want to reblock.)
      for (let d = 1; d <= lastDay; d++) {
        const dt = new Date(tYear, tMonth, d);
        if (dt < today) continue;
        if (dt.getDay() === dow) found.add(dt.toISOString().slice(0, 10));
      }
      const label = shift === 'manha'
        ? `${WEEKDAY_LABELS[dow]}s de manhã`
        : shift === 'noite'
        ? `${WEEKDAY_LABELS[dow]}s à noite`
        : `${WEEKDAY_LABELS[dow]}s (dia inteiro)`;
      weeklyBlocks.push({ dow, timeStart: '', timeEnd: '', label });
    }
  }

  const ddmm = /(\b\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/g;
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
  return { mode, dates, weeklyBlocks };
}

// Backward-compat export name (legacy callers)
export function parseBlackoutDates(text: string, targetMonth: Date): Date[] {
  return parseUserResponse(text, targetMonth).dates.map((s) => new Date(s + "T00:00:00"));
}

async function sendConfirmation(supabaseUrl: string, key: string, phone: string, message: string, origin = "bot_reply") {
  const delayTyping = Math.floor(Math.random() * 6) + 3;
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ phone, message, delayTyping, origin }),
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
    let text = pickStr(
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

    console.log(`[extract] fromMe=${fromMe} hasPhone=${!!phoneRaw} textLen=${text.length}`);

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

    // BR phone canonical: drop optional country code 55 and optional mobile "9"
    // after the 2-digit DDD. Returns up to 10 digits (DDD + 8-digit subscriber).
    const brCanonical = (raw: string): string => {
      let d = (raw || "").replace(/\D/g, "");
      if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
      if (d.length === 11 && d[2] === "9") d = d.slice(0, 2) + d.slice(3);
      return d.slice(-10);
    };
    const incomingCanon = brCanonical(phoneDigits);

    const { data: candidates } = await supabase
      .from("profiles")
      .select("id, name, whatsapp, whatsapp_opt_out_at")
      .neq("whatsapp", "");
    const profile = (candidates ?? []).find((p: any) => {
      const pd = normalizePhone(p.whatsapp);
      if (pd.slice(-10) === tail) return true;
      // BR fallback: match ignoring the optional 9
      return brCanonical(pd) === incomingCanon && incomingCanon.length >= 10;
    });

    console.log(`[lookup] candidates=${candidates?.length ?? 0} profileFound=${!!profile}`);

    if (!profile) {
      console.log(`[lookup] -> no profile match`);
      return new Response(JSON.stringify({ ignored: true, reason: "phone not found" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const reply = (body: Record<string, unknown>) =>
      new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    const firstName = (profile.name || "").split(" ")[0] || "👋";
    let cmd = (text || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[!?.]+$/, "").replace(/\s+/g, " ");

    // ─── Pedido de exclusão pendente: resposta SIM / NÃO após "SAIR" ───
    const { data: pendingDel } = await supabase.from("whatsapp_consent_log")
      .select("id, action, created_at").eq("user_id", profile.id)
      .in("action", ["delete_requested", "delete_cancelled"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const hasPending = pendingDel?.action === "delete_requested" &&
      Date.now() - new Date(pendingDel.created_at).getTime() < 24 * 3600 * 1000;
    if (hasPending && /^(sim|si|yes|oui|ja|s)$/.test(cmd)) {
      const { data: result, error: delErr } = await supabase.rpc("delete_account_by_id", { _uid: profile.id });
      if (delErr || result !== "deleted") {
        console.error("delete_account_by_id", delErr, result);
        await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp,
          result === "is_leader"
            ? `⚠️ *${firstName}*, você é líder de um departamento, então sua conta não pode ser apagada pelo WhatsApp. Transfira a liderança no app LEVI e tente novamente.`
            : `⚠️ Não foi possível apagar sua conta agora. Tente novamente mais tarde.`,
          "consent");
        return reply({ ok: false, action: "delete_failed", result });
      }
      await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp,
        `🗑️ *Conta apagada, ${firstName}.* Todos os seus dados foram removidos do LEVI. Obrigado por ter servido conosco! 🙏`,
        "consent");
      return reply({ ok: true, action: "account_deleted" });
    }
    if (hasPending && /^(nao|no|non|nein|n)$/.test(cmd)) {
      await supabase.from("whatsapp_consent_log").insert({
        user_id: profile.id, phone: phoneDigits, action: "delete_cancelled", consent_text: text, source: "whatsapp",
      });
      await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp,
        `👍 Ok, *${firstName}*! Sua conta foi mantida. Você não vai receber mensagens do LEVI neste número; responda *VOLTAR* se quiser voltar a receber.`,
        "consent");
      return reply({ ok: true, action: "delete_cancelled" });
    }

    // ─── RGPD: opt-out ("SAIR") + pergunta se quer apagar a conta ───
    if (["sair", "parar", "stop", "cancelar", "descadastrar", "sair da lista"].includes(cmd)) {
      await supabase.from("whatsapp_consent_log").insert([
        { user_id: profile.id, phone: phoneDigits, action: "opt_out", consent_text: text, source: "whatsapp" },
        { user_id: profile.id, phone: phoneDigits, action: "delete_requested", consent_text: text, source: "whatsapp" },
      ]);
      await supabase.from("profiles").update({ whatsapp_opt_out_at: new Date().toISOString() }).eq("id", profile.id);
      await sendConfirmation(
        supabaseUrl, serviceRoleKey, profile.whatsapp,
        `✅ *Pronto, ${firstName}!* Você não vai mais receber mensagens do LEVI neste número.\n\n❓ *Deseja também apagar sua conta e todos os seus dados do LEVI?*\n\nResponda *SIM* para apagar definitivamente ou *NÃO* para manter a conta.`,
        "consent",
      );
      return reply({ ok: true, action: "opt_out_delete_prompt" });
    }
    if (["voltar", "start", "aceito", "quero receber"].includes(cmd) && profile.whatsapp_opt_out_at) {
      await supabase.from("whatsapp_consent_log").insert({
        user_id: profile.id, phone: phoneDigits, action: "opt_in", consent_text: text, source: "whatsapp",
      });
      await supabase.from("profiles")
        .update({ whatsapp_opt_in_at: new Date().toISOString(), whatsapp_opt_in_text: text, whatsapp_opt_out_at: null })
        .eq("id", profile.id);
      await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp,
        `✅ *Bem-vindo de volta, ${firstName}!* Você voltou a receber as mensagens do LEVI. Responda *SAIR* a qualquer momento para cancelar.`,
        "consent");
      return reply({ ok: true, action: "opt_in" });
    }
    // Número que pediu SAIR: não responde a mais nada.
    if (profile.whatsapp_opt_out_at) {
      return reply({ ignored: true, reason: "opted_out" });
    }

    // Requests phrased as sentences are never applied immediately. Store the
    // explicit action for 15 minutes and require a fresh YES from this number.
    const { data: pendingCommand, error: pendingReadError } = await supabase
      .from("whatsapp_pending_commands")
      .select("command_text, expires_at, phone")
      .eq("user_id", profile.id).maybeSingle();
    if (pendingReadError) throw pendingReadError;
    if (pendingCommand && /^(sim|si|yes)$/.test(cmd)) {
      await supabase.from("whatsapp_pending_commands").delete().eq("user_id", profile.id);
      if (pendingCommand.phone !== phoneDigits || new Date(pendingCommand.expires_at).getTime() <= Date.now()) {
        await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp,
          `⌛ *${firstName}*, a confirmação expirou. Envie o pedido novamente; nada foi alterado.`);
        return reply({ ok: true, handled: "command_expired" });
      }
      text = pendingCommand.command_text;
      cmd = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[!?.]+$/, "").replace(/\s+/g, " ");
    } else if (pendingCommand && /^(nao|no|cancelar)$/.test(cmd)) {
      await supabase.from("whatsapp_pending_commands").delete().eq("user_id", profile.id);
      await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp,
        `✅ *${firstName}*, pedido cancelado. Nenhum dado foi alterado.`);
      return reply({ ok: true, handled: "command_cancelled" });
    } else {
      // A new message supersedes the previous proposal: a later SIM must
      // never unexpectedly execute an older request.
      if (pendingCommand) await supabase.from("whatsapp_pending_commands").delete().eq("user_id", profile.id);
      // Only standalone imperative verbs count: no inflected/quoted verbs or
      // negative instructions. The confirmation repeats the exact action.
      const normalized = cmd.replace(/^[\s,.:;]+/, "");
      const match = /\b(bloquear|desbloquear|liberar todos|liberar dias|servir|escala todos|escalas todos|escalas?|bloqueios|ajuda|apoiar)\b/.exec(normalized);
      const prefix = match ? normalized.slice(0, match.index).trim() : "";
      if (match && prefix && prefix.split(/\s+/).length <= 8 &&
          !/^(troca|trocar|cambio|cambiar|swap|change)\b/.test(normalized) &&
          !/\b(nao|nunca|sem|nem|evite|proibido|deixei|ja|antes|depois|quando|porque|por que|disse|falou)\b/.test(prefix) &&
          !/["“”'‘’]/.test(prefix)) {
        const action = normalized.slice(match.index);
        const isChange = /^(bloquear|desbloquear|liberar todos|liberar dias|servir)\b/.test(action);
        if (isChange) {
          const { error: pendingWriteError } = await supabase.from("whatsapp_pending_commands").upsert({
            user_id: profile.id, phone: phoneDigits, command_text: action,
            expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
          }, { onConflict: "user_id" });
          if (pendingWriteError) throw pendingWriteError;
          await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp,
            `*${firstName}*, você quer confirmar este pedido?\n\n*${action}*\n\nResponda *SIM* para executar ou *NÃO* para cancelar. Vale por 15 minutos. Nada foi alterado ainda.`);
          return reply({ ok: true, handled: "command_confirmation_required" });
        }
        // Read-only commands can be answered directly.
        text = action;
        cmd = action;
      }
    }

    // ─── "ajuda" / "comandos" / "?" / standalone "levi" → send commands list ───
    const helpRegex = /^(ajuda|help|comandos?|\?|oi\s+levi|ol[áa]\s+levi|levi)\s*[!?.]*$/i;
    if (helpRegex.test((text || "").trim())) {
      await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp, `Olá *${firstName}*!\n\n${LEVI_COMMANDS_HINT}`);
      return reply({ ok: true, handled: "help" });
    }

    // ─── "apoiar" → link de apoio ───
    if (/^(apoiar|apoio|doar|doacao|pix)$/.test(cmd)) {
      await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp, buildSupportOnlyMessage(profile.name || "", profile.whatsapp));
      return reply({ ok: true, handled: "support" });
    }

    // Helper: future blackout dates per department
    const loadBlackouts = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data: prefs } = await supabase
        .from("member_preferences")
        .select("id, department_id, blackout_dates, departments(name)")
        .eq("user_id", profile.id);
      return (prefs ?? []).map((p: any) => {
        const all = ((p.blackout_dates as string[]) ?? []).map((d) => String(d).slice(0, 10));
        return { id: p.id, deptName: p.departments?.name || "—", all, future: all.filter((d) => d >= today).sort() };
      });
    };

    // ─── "bloqueios" → listar dias bloqueados ───
    if (/^(bloqueios|meus bloqueios|dias bloqueados|bloqueados)$/.test(cmd)) {
      const rows = (await loadBlackouts()).filter((r) => r.future.length > 0);
      const msg = rows.length === 0
        ? `Olá *${firstName}*! Você não tem nenhum dia bloqueado no momento. 🙌`
        : `📅 *Seus dias bloqueados, ${firstName}:*\n${rows.map((r) => `\n*${r.deptName}*\n${r.future.map((d) => `• ${fmt(d)}`).join("\n")}`).join("\n")}\n\nPara liberar todos, responda *desbloquear*.`;
      await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp, msg);
      return reply({ ok: true, handled: "list_blackouts" });
    }

    // ─── "bloquear <datas>" → bloqueia dias específicos (só datas: 10/10, 10-10) ───
    // Weekday requests ("bloquear domingos de manhã") fall through to the
    // blackout-prompt parser, which supports weekdays and shifts.
    if (/^bloquear\b/.test(cmd)) {
      const today0 = new Date(); today0.setHours(0, 0, 0, 0);
      const found = new Set<string>();
      const ddmm = /(\b\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/g;
      let mm: RegExpExecArray | null;
      while ((mm = ddmm.exec(cmd)) !== null) {
        const day = parseInt(mm[1], 10);
        const mon = parseInt(mm[2], 10) - 1;
        let yr = mm[3] ? parseInt(mm[3], 10) : today0.getFullYear();
        if (yr < 100) yr += 2000;
        if (day < 1 || day > 31 || mon < 0 || mon > 11) continue;
        const d = new Date(yr, mon, day);
        if (d.getDate() !== day || d.getMonth() !== mon) continue;
        if (d < today0) {
          // Sem ano informado e a data já passou: assume o próximo ano.
          if (!mm[3]) { d.setFullYear(d.getFullYear() + 1); if (d < today0) continue; }
          else continue;
        }
        found.add(d.toISOString().slice(0, 10));
      }
      // Weekday names without explicit dates ("bloquear domingo") block the
      // matching days in the next 30 days.
      if (found.size === 0) {
        const WD: Array<[RegExp, number]> = [
          [/domingo/, 0], [/segunda/, 1], [/ter[cç]a/, 2], [/quarta/, 3],
          [/quinta/, 4], [/sexta/, 5], [/s[áa]bado/, 6],
        ];
        const dows = new Set(WD.filter(([r]) => r.test(cmd)).map(([, d]) => d));
        for (let i = 0; i < 30 && dows.size > 0; i++) {
          const d = new Date(today0); d.setDate(d.getDate() + i);
          if (dows.has(d.getDay())) found.add(d.toISOString().slice(0, 10));
        }
      }
      if (found.size === 0) {
        await sendConfirmation(
          supabaseUrl, serviceRoleKey, profile.whatsapp,
          `🤔 *${firstName}*, para bloquear dias me envie as datas no formato *dia/mês*.\n\nExemplos:\n• *bloquear 10/10*\n• *bloquear 10-10, 25/10*\n\nPara ver seus bloqueios, responda *bloqueios*.`,
        );
        return reply({ ok: true, handled: "block_no_dates" });
      }
      const { data: blkMemberships } = await supabase
        .from("members").select("department_id").eq("user_id", profile.id);
      const blkDeptIds = (blkMemberships ?? []).map((m: any) => m.department_id);
      if (blkDeptIds.length === 0) {
        await sendConfirmation(
          supabaseUrl, serviceRoleKey, profile.whatsapp,
          `Olá *${firstName}*! Você não está em nenhum departamento ativo. Procure seu líder.`,
        );
        return reply({ ok: true, no_depts: true });
      }
      // No block limit: every requested date is saved in every department.
      const todayIso = new Date().toISOString().slice(0, 10);
      for (const deptId of blkDeptIds) {
        const { data: existing } = await supabase
          .from("member_preferences").select("blackout_dates")
          .eq("user_id", profile.id).eq("department_id", deptId).maybeSingle();
        const merged = new Set<string>(((existing?.blackout_dates as string[]) ?? [])
          .map((d) => String(d).slice(0, 10)).filter((d) => d >= todayIso));
        for (const ds of found) merged.add(ds);
        await supabase.from("member_preferences").upsert(
          { user_id: profile.id, department_id: deptId, blackout_dates: Array.from(merged).sort() },
          { onConflict: "user_id,department_id" },
        );
      }
      const accepted = Array.from(found).sort();
      const msg = `🔴 *Anotado, ${firstName}!*\n━━━━━━━━━━━━━━━━━━━━\n\n🚫 *Dias bloqueados:*\n${accepted.map(fmt).join(", ")}\n\nPara liberar, responda *desbloquear*.\n\n_LEVI_`;
      await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp, msg);
      return reply({ ok: true, handled: "block_dates", accepted });
    }

    // ─── "desbloquear <datas|dias da semana>" → libera só os dias pedidos ───
    if (/^(desbloquear|desbloqueio|desbloq|liberar)\s+\S/.test(cmd) && !/^liberar (todos|dias|meu bloqueio)$/.test(cmd)) {
      const DOWS: Array<[RegExp, number]> = [
        [/domingo/, 0], [/segunda/, 1], [/ter[cç]a/, 2], [/quarta/, 3],
        [/quinta/, 4], [/sexta/, 5], [/s[áa]bado/, 6],
      ];
      const dows = new Set(DOWS.filter(([r]) => r.test(cmd)).map(([, d]) => d));
      const dates = new Set<string>();
      const re = /(\b\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/g;
      let mm: RegExpExecArray | null;
      while ((mm = re.exec(cmd)) !== null) {
        const day = +mm[1], mon = +mm[2] - 1;
        let yr = mm[3] ? +mm[3] : new Date().getFullYear();
        if (yr < 100) yr += 2000;
        const d = new Date(Date.UTC(yr, mon, day));
        if (d.getUTCDate() !== day || d.getUTCMonth() !== mon) continue;
        dates.add(d.toISOString().slice(0, 10));
        if (!mm[3]) { d.setUTCFullYear(yr + 1); dates.add(d.toISOString().slice(0, 10)); }
      }
      if (dows.size === 0 && dates.size === 0) {
        await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp,
          `Olá *${firstName}*! Não entendi quais dias liberar. Exemplos: *desbloquear domingo*, *desbloquear 10/10* ou só *desbloquear* para liberar todos.`);
        return reply({ ok: true, handled: "unblock_specific_invalid" });
      }
      try {
        const rows = await loadBlackouts();
        const freed: string[] = [];
        for (const r of rows) {
          const hit = r.future.filter((d) =>
            dates.has(d) || dows.has(new Date(d + "T12:00:00Z").getUTCDay()));
          if (hit.length === 0) continue;
          const keep = r.all.filter((d) => !hit.includes(d));
          await supabase.from("member_preferences").update({ blackout_dates: keep }).eq("id", r.id);
          freed.push(`*${r.deptName}*: ${hit.map(fmt).join(", ")}`);
        }
        const msg = freed.length === 0
          ? `Olá *${firstName}*! Não encontrei bloqueio nesses dias, então nada foi alterado. Envie *bloqueios* para ver seus dias bloqueados.`
          : `✅ *Desbloqueado, ${firstName}!*\n\nDias liberados:\n${freed.map((l) => `• ${l}`).join("\n")}\n\nSeu líder já pode te escalar nesses dias.`;
        await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp, msg);
      } catch (e) {
        console.error("unblock specific error:", e);
        await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp,
          `Olá *${firstName}*! Não consegui desbloquear agora. Tente novamente em instantes.`);
      }
      return reply({ ok: true, handled: "unblock_specific" });
    }

    // ─── "desbloquear" → libera dias bloqueados + bloqueio do líder ───
    if (/^(desbloquear|desbloqueio|desbloq|voltar|voltar a servir|liberar meu bloqueio|liberar dias)$/.test(cmd)) {
      try {
        const rows = await loadBlackouts();
        const freed: string[] = [];
        for (const r of rows) {
          if (r.future.length === 0) continue;
          const keep = r.all.filter((d) => !r.future.includes(d));
          await supabase.from("member_preferences").update({ blackout_dates: keep }).eq("id", r.id);
          freed.push(`*${r.deptName}*: ${r.future.map(fmt).join(", ")}`);
        }
        const { data: unblocked } = await supabase.rpc("unblock_member_by_phone", { p_phone: profile.whatsapp });
        const depts = (unblocked ?? []) as Array<{ department_name: string }>;

        let msg: string;
        if (freed.length === 0 && depts.length === 0) {
          msg = `Olá *${firstName}*! Você não tem nenhum dia bloqueado, então não havia nada para desbloquear. 🙌`;
        } else {
          msg = `✅ *Desbloqueado, ${firstName}!*`;
          if (freed.length) msg += `\n\nDias liberados:\n${freed.map((l) => `• ${l}`).join("\n")}`;
          if (depts.length) msg += `\n\nVocê voltou a ficar disponível em:\n${depts.map((d) => `• ${d.department_name}`).join("\n")}`;
          msg += `\n\nSeu líder já pode te escalar nesses dias.`;
        }
        await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp, msg);
      } catch (e) {
        console.error("unblock error:", e);
        await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp,
          `Olá *${firstName}*! Não consegui desbloquear agora. Tente novamente em instantes.`);
      }
      return reply({ ok: true, handled: "unblock" });
    }

    const lang = detectLang(profile.whatsapp);
    const L = (o: { pt: string; es: string; en: string }) => o[lang];
    const LINE = "━━━━━━━━━━━━━━━";
    const dateLabel = (iso: string) => {
      const d = new Date(iso + "T00:00:00");
      const [, m, dd] = iso.split("-");
      return `${DOW[lang][d.getDay()]}, ${dd}/${m}`;
    };
    const sectorNames = async (deptIds: string[]) => {
      const map: Record<string, string> = {};
      if (!deptIds.length) return map;
      const { data } = await supabase.from("sectors").select("id, name").in("department_id", deptIds);
      for (const s of data ?? []) map[s.id] = s.name;
      const { data: roles } = await supabase.from("assignment_roles").select("id, name").in("department_id", deptIds);
      for (const r of roles ?? []) map["role:" + r.id] = r.name;
      return map;
    };
    const schedDetails = (s: any, sectors: Record<string, string>) => {
      const ids: string[] = [...new Set([...(s.sector_ids ?? []), ...(s.sector_id ? [s.sector_id] : [])])];
      const sec = ids.map((i) => sectors[i]).filter(Boolean).join(", ");
      const role = s.assignment_role ? (sectors["role:" + s.assignment_role] ?? translateRole(s.assignment_role, lang)) : "";
      const icon = s.assignment_role === "on_duty" ? "🛡️" : "🙌";
      return [role ? `${icon} ${role}` : "", sec ? `📍 ${sec}` : ""].filter(Boolean).join("  ·  ");
    };
    const ledDepts = async () => {
      const [{ data: own }, { data: co }] = await Promise.all([
        supabase.from("departments").select("id, name").eq("leader_id", profile.id),
        supabase.from("members").select("department_id, departments(id, name)").eq("user_id", profile.id).in("role", ["leader", "coleader"]),
      ]);
      const map = new Map<string, any>();
      for (const d of own ?? []) map.set(d.id, d);
      for (const m of (co ?? []) as any[]) if (m.departments) map.set(m.departments.id, m.departments);
      return [...map.values()];
    };

    // ─── "db" (líderes) → dias bloqueados da equipe ───
    if (/^(db|dias bloqueados da equipe|bloqueios da equipe)$/.test(cmd)) {
      const depts = await ledDepts();
      if (!depts.length) {
        await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp, L({
          pt: `🔒 *${firstName}*, o comando *DB* é só para líderes de departamento.`,
          es: `🔒 *${firstName}*, el comando *DB* es solo para líderes de departamento.`,
          en: `🔒 *${firstName}*, the *DB* command is for department leaders only.`,
        }));
        return reply({ ok: true, handled: "team_blackouts_denied" });
      }
      const today = new Date().toISOString().slice(0, 10);
      let msg = L({ pt: `🗓️ *Bloqueios da equipe*`, es: `🗓️ *Bloqueos del equipo*`, en: `🗓️ *Team blocked days*` }) + `\n${LINE}\n`;
      for (const d of depts) {
        const { data: prefs } = await supabase.from("member_preferences")
          .select("user_id, blackout_dates").eq("department_id", d.id);
        const rows = (prefs ?? []).map((p: any) => ({
          uid: p.user_id,
          dates: ((p.blackout_dates as string[]) ?? []).map((x) => String(x).slice(0, 10)).filter((x) => x >= today).sort(),
        })).filter((r) => r.dates.length);
        const { data: names } = rows.length
          ? await supabase.from("profiles").select("id, name").in("id", rows.map((r) => r.uid))
          : { data: [] as any[] };
        const nm: Record<string, string> = {};
        for (const n of names ?? []) nm[n.id] = n.name;
        msg += `\n🏷️ *${d.name}*\n`;
        msg += rows.length
          ? rows.sort((a, b) => (nm[a.uid] || "").localeCompare(nm[b.uid] || ""))
              .map((r) => `👤 *${nm[r.uid] || "—"}* (${r.dates.length})\n   ${r.dates.map(dateLabel).join(" • ")}`).join("\n") + "\n"
          : L({ pt: "✅ Ninguém bloqueou dias.\n", es: "✅ Nadie bloqueó días.\n", en: "✅ No blocked days.\n" });
      }
      await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp, msg);
      return reply({ ok: true, handled: "team_blackouts" });
    }

    // ─── "colider [N]" (líder principal) → tornar/remover co-líder ───
    const col = /^(?:co-?lider|colíder|co-líder)\s*(\d{1,3})?$/.exec(cmd);
    if (col) {
      const { data: owned } = await supabase.from("departments").select("id, name").eq("leader_id", profile.id).order("name");
      if (!owned?.length) {
        await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp, L({
          pt: `🔒 *${firstName}*, só o líder principal do departamento pode definir co-líderes.`,
          es: `🔒 *${firstName}*, solo el líder principal puede definir co-líderes.`,
          en: `🔒 *${firstName}*, only the main department leader can set co-leaders.`,
        }));
        return reply({ ok: true, handled: "coleader_denied" });
      }
      const { data: mem } = await supabase.from("members")
        .select("id, user_id, role, department_id, profiles(name)")
        .in("department_id", owned.map((d) => d.id)).neq("user_id", profile.id).neq("role", "leader");
      const dn: Record<string, string> = {};
      for (const d of owned) dn[d.id] = d.name;
      const list = ((mem ?? []) as any[]).map((m) => ({ ...m, name: m.profiles?.name || "—" }))
        .sort((a, b) => dn[a.department_id].localeCompare(dn[b.department_id]) || a.name.localeCompare(b.name));
      const n = col[1] !== undefined ? parseInt(col[1], 10) : NaN;
      if (!Number.isFinite(n) || n < 1 || n > list.length) {
        let msg = L({ pt: `⭐ *Co-líderes*`, es: `⭐ *Co-líderes*`, en: `⭐ *Co-leaders*` }) + `\n${LINE}\n`;
        let last = "";
        list.forEach((m, i) => {
          if (m.department_id !== last) { msg += `\n🏷️ *${dn[m.department_id]}*\n`; last = m.department_id; }
          msg += `${i + 1}. ${m.name}${m.role === "coleader" ? " ⭐" : ""}\n`;
        });
        if (!list.length) msg += L({ pt: "Nenhum membro na equipe ainda.\n", es: "Aún no hay miembros.\n", en: "No members yet.\n" });
        msg += `\n${LINE}\n` + L({
          pt: "Envie *colider* + o número da pessoa (ex.: *colider 3*). Se ela já for co-líder (⭐), o papel é removido.",
          es: "Envía *colider* + el número de la persona (ej.: *colider 3*). Si ya es co-líder (⭐), se quita.",
          en: "Send *colider* + the person's number (e.g. *colider 3*). If already co-leader (⭐), it's removed.",
        });
        await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp, msg);
        return reply({ ok: true, handled: "coleader_list" });
      }
      const t = list[n - 1];
      const make = t.role !== "coleader";
      const { error: cErr } = await supabase.from("members").update({ role: make ? "coleader" : "member" }).eq("id", t.id);
      await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp, cErr
        ? L({ pt: "❌ Não consegui alterar agora. Tente de novo.", es: "❌ No pude cambiarlo ahora.", en: "❌ Couldn't change it now." })
        : make
          ? L({ pt: `✅ *${t.name}* agora é co-líder de *${dn[t.department_id]}* ⭐`, es: `✅ *${t.name}* ahora es co-líder de *${dn[t.department_id]}* ⭐`, en: `✅ *${t.name}* is now co-leader of *${dn[t.department_id]}* ⭐` })
          : L({ pt: `✅ *${t.name}* voltou a ser membro em *${dn[t.department_id]}*.`, es: `✅ *${t.name}* volvió a ser miembro en *${dn[t.department_id]}*.`, en: `✅ *${t.name}* is a member again in *${dn[t.department_id]}*.` }));
      return reply({ ok: true, handled: make ? "coleader_set" : "coleader_removed" });
    }

    // ─── "escala todos" → próxima escala de cada departamento do usuário ───
    if (/^(escalas? (de )?todos|escala geral|escala da equipe|escala do departamento|turnos? (de )?todos|team schedule)$/.test(cmd)) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: mems } = await supabase
        .from("members").select("department_id, departments(name)").eq("user_id", profile.id);
      const sectors = await sectorNames((mems ?? []).map((m: any) => m.department_id));
      let msg = L({ pt: `👥 *Próximas escalas da equipe*`, es: `👥 *Próximos turnos del equipo*`, en: `👥 *Upcoming team shifts*` }) + `\n${LINE}\n`;
      let any = false;
      for (const m of (mems ?? []) as any[]) {
        const { data: next } = await supabase
          .from("schedules").select("date").eq("department_id", m.department_id)
          .gte("date", today).order("date").limit(1);
        const date = next?.[0]?.date;
        if (!date) continue;
        const { data: rows } = await supabase
          .from("schedules").select("time_start, time_end, assignment_role, sector_id, sector_ids, user_id, profiles!schedules_user_id_fkey(name)")
          .eq("department_id", m.department_id).eq("date", date).order("time_start");
        any = true;
        msg += `\n🏷️ *${m.departments?.name || "—"}*\n📆 *${dateLabel(date)}*\n`;
        let lastSlot = "";
        for (const r of (rows ?? []) as any[]) {
          const slot = `${fmtTime(r.time_start)}–${fmtTime(r.time_end)}`;
          if (slot !== lastSlot) { msg += `\n⏰ *${slot}*\n`; lastSlot = slot; }
          const det = schedDetails(r, sectors);
          msg += `${r.user_id === profile.id ? "⭐" : "👤"} ${r.profiles?.name || "—"}${det ? `\n     ${det}` : ""}\n`;
        }
      }
      msg = any
        ? msg + `\n${LINE}\n` + L({ pt: "⭐ = você", es: "⭐ = tú", en: "⭐ = you" })
        : L({
            pt: `🙌 *${firstName}*, não há escalas futuras nos seus departamentos.`,
            es: `🙌 *${firstName}*, no hay turnos futuros en tus departamentos.`,
            en: `🙌 *${firstName}*, there are no upcoming shifts in your departments.`,
          });
      await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp, msg);
      return reply({ ok: true, handled: "team_schedule" });
    }

    // ─── "escala" command: list user's upcoming schedules ───
    try {
      if (isScheduleListCommand(text)) {
        const today = new Date().toISOString().slice(0, 10);
        const { data: scheds } = await supabase
          .from("schedules")
          .select("date, time_start, time_end, assignment_role, department_id, sector_id, sector_ids")
          .eq("user_id", profile.id)
          .gte("date", today)
          .order("date", { ascending: true })
          .order("time_start", { ascending: true });

        const fname = (profile.name || "").split(" ")[0] || "👋";

        if (!scheds || scheds.length === 0) {
          await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp, t(lang, "no_future_schedules", { fname }));
        } else {
          const deptIdsSet = Array.from(new Set(scheds.map((s: any) => s.department_id)));
          const { data: deptRows } = await supabase.from("departments").select("id, name").in("id", deptIdsSet);
          const deptName: Record<string, string> = {};
          for (const d of deptRows ?? []) deptName[d.id] = d.name;
          const sectors = await sectorNames(deptIdsSet as string[]);

          const grouped: Record<string, string[]> = {};
          for (const s of scheds as any[]) {
            const det = schedDetails(s, sectors);
            const line = `📆 *${dateLabel(s.date)}*  ⏰ ${fmtTime(s.time_start)}–${fmtTime(s.time_end)}${det ? `\n     ${det}` : ""}`;
            (grouped[deptName[s.department_id] || "—"] ||= []).push(line);
          }

          let msg = t(lang, "list_header", { fname });
          for (const [dn, lines] of Object.entries(grouped)) {
            msg += `\n🏷️ *${dn}*\n${lines.join("\n")}\n`;
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
    console.log(`[router] profile=${profile.id} trying swap`);
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

    // Latest monthly prompt, even if already answered — the user may send a
    // correction ("Se errei alguma data, é só me responder novamente").
    // The response window check below keeps old prompts from being reused.
    const { data: prompts } = await supabase
      .from("blackout_collection_prompts")
      .select("*")
      .eq("user_id", profile.id)
      .order("sent_at", { ascending: false })
      .limit(1);

    const prompt = prompts?.[0];
    // Only act when the user sends an EXPLICIT command at the start of the message
    // (bloquear / servir / nenhum / liberar). Free conversation like
    // "qualquer dia tá bom, desde que seja domingo de manhã" must NEVER change data.
    const lowerText = (text || "").toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const explicitCommand =
      /^(bloquear|bloqueia|bloqueio|servir|vou servir|posso servir|nenhum|nenhuma|liberar|liberar todos)\b/.test(lowerText);
    if (!explicitCommand) {
      return new Response(JSON.stringify({ ignored: true, reason: "no explicit command" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const now = new Date();
    let targetMonth: Date | null = null;
    let activePrompt: any = null;
    if (prompt) {
      const tm = new Date(prompt.target_month + "T00:00:00");
      const windowStart = new Date(tm.getFullYear(), tm.getMonth() - 1, 28);
      const windowEnd = new Date(tm.getFullYear(), tm.getMonth(), 5, 23, 59, 59);
      if (now >= windowStart && now <= windowEnd) {
        targetMonth = tm;
        activePrompt = prompt;
      }
    }
    if (!targetMonth) {
      // Outside the monthly collection window, "servir <datas>" still works at
      // any time: the month comes from the first dd/mm date (or the current month).
      if (!/^(servir|vou servir|posso servir)\b/.test(lowerText)) {
        return new Response(JSON.stringify({ ignored: true, reason: prompt ? "outside window" : "no active prompt" }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      const dm = /(\b\d{1,2})[/\-.](\d{1,2})/.exec(lowerText);
      const mon = dm ? Math.min(11, Math.max(0, parseInt(dm[2], 10) - 1)) : now.getMonth();
      const yr = mon < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
      targetMonth = new Date(yr, mon, 1);
    }

    const parsed = parseUserResponse(text, targetMonth);
    const fname = (profile.name || "").split(" ")[0] || "amigo(a)";

    // If user is replying to the prompt but we couldn't extract dates AND it's not "liberar todos",
    // send a friendly "não entendi" + commands hint instead of silently doing nothing.
    if (parsed.mode !== "none" && parsed.dates.length === 0 && (parsed.weeklyBlocks?.length ?? 0) === 0) {
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
      .select("id, name")
      .in("id", deptIds);

    // Compute target blackout list per mode
    let blackoutDateStrings: string[] = [];
    let serveOnlyDates: string[] = [];
    if (parsed.mode === "none") {
      blackoutDateStrings = [];
    } else if (parsed.mode === "block") {
      blackoutDateStrings = parsed.dates;
    } else {
      // serve_only: every remaining day of the month is blocked except the
      // chosen dates, in every department, regardless of weekly availability.
      const y = targetMonth.getFullYear();
      const mIdx = targetMonth.getMonth();
      const lastDay = new Date(y, mIdx + 1, 0).getDate();
      const todayIso = new Date().toISOString().slice(0, 10);
      const chosen = new Set(parsed.dates);
      for (let d = 1; d <= lastDay; d++) {
        const iso = `${y}-${String(mIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (iso >= todayIso && !chosen.has(iso)) blackoutDateStrings.push(iso);
      }
      serveOnlyDates = parsed.dates;
    }

    // No per-department block limit: every requested day is applied.
    const monthPrefix = `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, "0")}`;
    for (const dept of depts ?? []) {
      const { data: existing } = await supabase
        .from("member_preferences")
        .select("blackout_dates")
        .eq("user_id", profile.id)
        .eq("department_id", dept.id)
        .maybeSingle();

      // Replace this month's list; keep dates from other months.
      const priorOtherMonths = ((existing?.blackout_dates as string[]) ?? [])
        .map((d) => String(d).slice(0, 10))
        .filter((iso) => !iso.startsWith(monthPrefix));
      const finalDates = parsed.mode === "none"
        ? priorOtherMonths
        : Array.from(new Set([...priorOtherMonths, ...blackoutDateStrings])).sort();


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

    // Weekly-shift keywords ("domingos de manhã", "quartas", etc.) are month-only —
    // the parser already expanded them into `parsed.dates`. Track for the reply text.
    const appliedWeekly: WeeklyBlock[] = parsed.weeklyBlocks ?? [];

    if (activePrompt) {
      await supabase
        .from("blackout_collection_prompts")
        .update({ responded_at: new Date().toISOString(), parsed_dates: parsed.dates })
        .eq("id", activePrompt.id);
    }

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
      const acceptedIso = blackoutDateStrings;
      const acceptedList = acceptedIso.map(fmt).join(", ");
      let msg =
`🔴 *Anotado, ${fname}!*
━━━━━━━━━━━━━━━━━━━━

📖 _Leia com atenção:_${acceptedIso.length > 0 ? `

🚫 *Dias bloqueados:*
${acceptedList}` : ""}${appliedWeekly.length > 0 ? `

🔁 *Turnos bloqueados neste mês:*
${appliedWeekly.map((w) => `• ${w.label}`).join("\n")}
_(vale só para o mês em curso; se quiser bloquear no próximo mês, me responda de novo quando eu perguntar)_` : ""}${acceptedIso.length === 0 && appliedWeekly.length === 0 ? "\n\n(nenhuma data válida)" : ""}`;
      msg += `\n\n━━━━━━━━━━━━━━━━━━━━\nSe errei alguma data, é só me responder novamente.\n\n_LEVI_`;
      confirmMsg = msg;
    } else {
      // serve_only
      const serveList = serveOnlyDates.map(fmt).join(", ") || "(nenhuma)";
      confirmMsg =
`🟢 *Anotado, ${fname}!*
━━━━━━━━━━━━━━━━━━━━

📖 _Leia com atenção:_

✅ *Você servirá apenas em:*
${serveList}

🚫 Os demais dias do mês ficaram *bloqueados* (${blackoutDateStrings.length} dia(s)).

━━━━━━━━━━━━━━━━━━━━
Se errei alguma data, é só me responder novamente.

_LEVI_`;
    }

    await sendConfirmation(supabaseUrl, serviceRoleKey, profile.whatsapp, confirmMsg);

    return new Response(
      JSON.stringify({
        ok: true,
        mode: parsed.mode,
        accepted: parsed.dates,
        blackouts_applied: blackoutDateStrings,

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

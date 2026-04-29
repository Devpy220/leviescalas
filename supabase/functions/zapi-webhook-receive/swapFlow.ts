// Swap flow over WhatsApp.
// Handles a stateful menu-based conversation for schedule swaps.

const MAX_ATTEMPTS = 3;
const MAX_MY_SCHEDULES = 5;
const MAX_CANDIDATES = 5;

export interface Profile {
  id: string;
  name: string;
  whatsapp: string;
}

export interface SwapFlowDeps {
  supabase: any;
  supabaseUrl: string;
  serviceRoleKey: string;
}

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm} (${DOW[d.getDay()]})`;
}

function fmtTime(t: string): string {
  return t.slice(0, 5);
}

async function sendWA(
  deps: SwapFlowDeps,
  phone: string,
  message: string,
): Promise<void> {
  try {
    await fetch(`${deps.supabaseUrl}/functions/v1/send-whatsapp-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deps.serviceRoleKey}`,
      },
      body: JSON.stringify({
        phone,
        message,
        delayTyping: Math.floor(Math.random() * 4) + 2,
      }),
    });
  } catch (e) {
    console.error("swapFlow sendWA error:", e);
  }
}

// Detect intent: "troca", "trocar", "troca escala"
export function isSwapInitiation(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t === "troca" ||
    t === "trocar" ||
    t === "troca escala" ||
    t === "trocar escala" ||
    /^troca\b/.test(t) && t.length < 40
  );
}

export function isCancel(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === "cancelar" || t === "cancela" || t === "sair";
}

export function isYes(text: string): boolean {
  const t = text.trim().toLowerCase();
  return ["sim", "s", "aceito", "ok", "claro", "pode", "yes"].includes(t);
}

export function isNo(text: string): boolean {
  const t = text.trim().toLowerCase();
  return ["nao", "não", "n", "negativo", "no", "recuso"].includes(t);
}

function parseNumberPick(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2})\b/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return isNaN(n) ? null : n;
}

// ─────────────────────────────────────────────────────────────────────
// Active session lookups
// ─────────────────────────────────────────────────────────────────────

async function findActiveSession(deps: SwapFlowDeps, userId: string) {
  const { data } = await deps.supabase
    .from("whatsapp_swap_sessions")
    .select("*")
    .eq("user_id", userId)
    .in("state", ["awaiting_schedule_pick", "awaiting_target_pick"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

async function findPendingResponseSession(deps: SwapFlowDeps, targetUserId: string) {
  const { data } = await deps.supabase
    .from("whatsapp_swap_sessions")
    .select("*")
    .eq("current_target_user_id", targetUserId)
    .eq("state", "awaiting_response")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

async function cancelOldSessions(deps: SwapFlowDeps, userId: string) {
  await deps.supabase
    .from("whatsapp_swap_sessions")
    .update({ state: "cancelled" })
    .eq("user_id", userId)
    .in("state", ["awaiting_schedule_pick", "awaiting_target_pick", "awaiting_response"]);
}

// ─────────────────────────────────────────────────────────────────────
// Step 1: User says "troca" → list their next schedules
// ─────────────────────────────────────────────────────────────────────

async function startSwap(deps: SwapFlowDeps, profile: Profile): Promise<void> {
  const fname = (profile.name || "amigo(a)").split(" ")[0];

  // Departments where user is member
  const { data: memberships } = await deps.supabase
    .from("members")
    .select("department_id")
    .eq("user_id", profile.id);
  const deptIds = (memberships ?? []).map((m: any) => m.department_id);
  if (deptIds.length === 0) {
    await sendWA(
      deps,
      profile.whatsapp,
      `Olá *${fname}*! Você não está em nenhum departamento ativo.\n\n_LEVI_`,
    );
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: schedules } = await deps.supabase
    .from("schedules")
    .select("id, date, time_start, time_end, department_id, departments(name)")
    .eq("user_id", profile.id)
    .in("department_id", deptIds)
    .gte("date", today)
    .order("date", { ascending: true })
    .order("time_start", { ascending: true })
    .limit(MAX_MY_SCHEDULES);

  if (!schedules || schedules.length === 0) {
    await sendWA(
      deps,
      profile.whatsapp,
      `Olá *${fname}*! Você não tem escalas futuras para trocar.\n\n_LEVI_`,
    );
    return;
  }

  await cancelOldSessions(deps, profile.id);

  let msg = `🔄 *Troca de Escala*\n━━━━━━━━━━━━━━━━━━━━\n\nOlá *${fname}*! 👋\n\n📖 _Leia com atenção:_\nQual escala você quer trocar? Responda com o *número* correspondente.\n\n━━━━━━━━━━━━━━━━━━━━\n📆 *Suas próximas escalas:*\n\n`;
  schedules.forEach((s: any, i: number) => {
    const deptName = s.departments?.name ?? "";
    msg += `*${i + 1})* ${fmtDate(s.date)} ${fmtTime(s.time_start)}-${fmtTime(s.time_end)}\n     ${deptName}\n\n`;
  });
  msg += `━━━━━━━━━━━━━━━━━━━━\n✍️ Responda com o *número* da escala\n   (ou envie "cancelar")\n\n💡 _Dica: configure um som personalizado para o LEVI em "Notificações personalizadas" da nossa conversa — assim você nunca perde uma escala._\n\n_LEVI_`;

  await deps.supabase.from("whatsapp_swap_sessions").insert({
    user_id: profile.id,
    phone: profile.whatsapp,
    state: "awaiting_schedule_pick",
    candidate_target_schedule_ids: schedules.map((s: any) => s.id),
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });

  await sendWA(deps, profile.whatsapp, msg);
}

// ─────────────────────────────────────────────────────────────────────
// Step 2: User picked a schedule → find candidates
// ─────────────────────────────────────────────────────────────────────

async function getEligibleCandidates(
  deps: SwapFlowDeps,
  reqSchedule: { id: string; date: string; time_start: string; time_end: string; department_id: string; user_id: string },
): Promise<Array<{ user_id: string; name: string; whatsapp: string; schedule_id: string; date: string; time_start: string; time_end: string }>> {
  const today = new Date().toISOString().slice(0, 10);

  // 1. All members of the department
  const { data: members } = await deps.supabase
    .from("members")
    .select("user_id")
    .eq("department_id", reqSchedule.department_id)
    .neq("user_id", reqSchedule.user_id);

  const memberIds = (members ?? []).map((m: any) => m.user_id);
  if (memberIds.length === 0) return [];

  // 2. Filter out: blocked on req date (member_preferences.blackout_dates)
  const { data: prefs } = await deps.supabase
    .from("member_preferences")
    .select("user_id, blackout_dates")
    .eq("department_id", reqSchedule.department_id)
    .in("user_id", memberIds);

  const blockedSet = new Set<string>();
  for (const p of prefs ?? []) {
    const dates: string[] = (p.blackout_dates as string[]) ?? [];
    if (dates.includes(reqSchedule.date)) blockedSet.add(p.user_id);
  }

  // 3. Filter out: already scheduled at conflicting time on that date in this dept
  const { data: conflicts } = await deps.supabase
    .from("schedules")
    .select("user_id")
    .eq("department_id", reqSchedule.department_id)
    .eq("date", reqSchedule.date)
    .lt("time_start", reqSchedule.time_end)
    .gt("time_end", reqSchedule.time_start)
    .in("user_id", memberIds);

  for (const c of conflicts ?? []) blockedSet.add(c.user_id);

  const eligibleIds = memberIds.filter((id: string) => !blockedSet.has(id));
  if (eligibleIds.length === 0) return [];

  // 4. Each must have at least one *future* schedule in same dept (their counterpart)
  //    that the requester (reqSchedule.user_id) does NOT have a conflict with.
  const { data: theirSchedules } = await deps.supabase
    .from("schedules")
    .select("id, date, time_start, time_end, user_id")
    .eq("department_id", reqSchedule.department_id)
    .in("user_id", eligibleIds)
    .gte("date", today)
    .neq("date", reqSchedule.date)
    .order("date", { ascending: true });

  // Requester's blackout
  const { data: reqPref } = await deps.supabase
    .from("member_preferences")
    .select("blackout_dates")
    .eq("department_id", reqSchedule.department_id)
    .eq("user_id", reqSchedule.user_id)
    .maybeSingle();
  const reqBlackouts: string[] = (reqPref?.blackout_dates as string[]) ?? [];

  // Requester's other schedules (to detect conflicts when they take counterpart)
  const { data: reqOther } = await deps.supabase
    .from("schedules")
    .select("date, time_start, time_end")
    .eq("user_id", reqSchedule.user_id)
    .neq("id", reqSchedule.id)
    .gte("date", today);

  const reqOtherList = reqOther ?? [];

  const candidates: Array<{ user_id: string; schedule_id: string; date: string; time_start: string; time_end: string }> = [];
  const usedUsers = new Set<string>();
  for (const s of theirSchedules ?? []) {
    if (usedUsers.has(s.user_id)) continue;
    if (reqBlackouts.includes(s.date)) continue;
    // Check conflict for requester
    const conflict = reqOtherList.some(
      (o: any) =>
        o.date === s.date &&
        o.time_start < s.time_end &&
        o.time_end > s.time_start,
    );
    if (conflict) continue;
    candidates.push({
      user_id: s.user_id,
      schedule_id: s.id,
      date: s.date,
      time_start: s.time_start,
      time_end: s.time_end,
    });
    usedUsers.add(s.user_id);
    if (candidates.length >= MAX_CANDIDATES) break;
  }

  if (candidates.length === 0) return [];

  // 5. Get profiles
  const { data: profiles } = await deps.supabase
    .from("profiles")
    .select("id, name, whatsapp")
    .in("id", candidates.map((c) => c.user_id));

  return candidates.map((c) => {
    const p = (profiles ?? []).find((pp: any) => pp.id === c.user_id);
    return {
      user_id: c.user_id,
      name: p?.name ?? "Voluntário",
      whatsapp: p?.whatsapp ?? "",
      schedule_id: c.schedule_id,
      date: c.date,
      time_start: c.time_start,
      time_end: c.time_end,
    };
  });
}

async function handleSchedulePick(
  deps: SwapFlowDeps,
  profile: Profile,
  session: any,
  pick: number,
): Promise<void> {
  const ids: string[] = session.candidate_target_schedule_ids ?? [];
  if (pick < 1 || pick > ids.length) {
    await sendWA(
      deps,
      profile.whatsapp,
      `Número inválido. Responda entre 1 e ${ids.length}, ou "cancelar".\n\n_LEVI_`,
    );
    return;
  }
  const reqScheduleId = ids[pick - 1];

  const { data: reqSchedule } = await deps.supabase
    .from("schedules")
    .select("id, date, time_start, time_end, department_id, user_id")
    .eq("id", reqScheduleId)
    .maybeSingle();

  if (!reqSchedule) {
    await sendWA(deps, profile.whatsapp, `Escala não encontrada. Envie "troca" para começar de novo.\n\n_LEVI_`);
    await deps.supabase.from("whatsapp_swap_sessions").update({ state: "cancelled" }).eq("id", session.id);
    return;
  }

  const candidates = await getEligibleCandidates(deps, reqSchedule);
  if (candidates.length === 0) {
    await sendWA(
      deps,
      profile.whatsapp,
      `❌ Nenhum colega disponível para trocar essa escala.\nFale com seu líder para resolver.\n\n_LEVI_`,
    );
    await deps.supabase.from("whatsapp_swap_sessions").update({ state: "cancelled" }).eq("id", session.id);
    await notifyLeader(deps, reqSchedule.department_id, profile.name, fmtDate(reqSchedule.date));
    return;
  }

  let msg = `🔄 *Escolha o colega*\n━━━━━━━━━━━━━━━━━━━━\n\n📖 _Leia com atenção:_\n\nVocê quer trocar a escala:\n📆 *${fmtDate(reqSchedule.date)}*\n⏰ ${fmtTime(reqSchedule.time_start)}-${fmtTime(reqSchedule.time_end)}\n\n━━━━━━━━━━━━━━━━━━━━\n👥 *Com quem você quer trocar?*\n\n`;
  candidates.forEach((c, i) => {
    msg += `*${i + 1})* ${c.name}\n     escala em ${fmtDate(c.date)} ${fmtTime(c.time_start)}-${fmtTime(c.time_end)}\n\n`;
  });
  msg += `━━━━━━━━━━━━━━━━━━━━\n✍️ Responda com o *número* (ou "cancelar").\n\n_LEVI_`;

  await deps.supabase
    .from("whatsapp_swap_sessions")
    .update({
      state: "awaiting_target_pick",
      requester_schedule_id: reqScheduleId,
      candidate_target_user_ids: candidates.map((c) => c.user_id),
      candidate_target_schedule_ids: candidates.map((c) => c.schedule_id),
      attempts_count: 0,
    })
    .eq("id", session.id);

  await sendWA(deps, profile.whatsapp, msg);
}

// ─────────────────────────────────────────────────────────────────────
// Step 3: Requester picked a target → ask target via WhatsApp
// ─────────────────────────────────────────────────────────────────────

async function handleTargetPick(
  deps: SwapFlowDeps,
  profile: Profile,
  session: any,
  pick: number,
): Promise<void> {
  const userIds: string[] = session.candidate_target_user_ids ?? [];
  const schIds: string[] = session.candidate_target_schedule_ids ?? [];
  if (pick < 1 || pick > userIds.length) {
    await sendWA(
      deps,
      profile.whatsapp,
      `Número inválido. Responda entre 1 e ${userIds.length}, ou "cancelar".\n\n_LEVI_`,
    );
    return;
  }

  const targetUserId = userIds[pick - 1];
  const targetScheduleId = schIds[pick - 1];

  await askTarget(deps, profile, session, targetUserId, targetScheduleId);
}

async function askTarget(
  deps: SwapFlowDeps,
  requester: Profile,
  session: any,
  targetUserId: string,
  targetScheduleId: string,
): Promise<void> {
  // Fetch all the data we need
  const { data: reqSchedule } = await deps.supabase
    .from("schedules")
    .select("id, date, time_start, time_end, department_id, departments(name)")
    .eq("id", session.requester_schedule_id)
    .maybeSingle();

  const { data: tgtSchedule } = await deps.supabase
    .from("schedules")
    .select("id, date, time_start, time_end")
    .eq("id", targetScheduleId)
    .maybeSingle();

  const { data: tgtProfile } = await deps.supabase
    .from("profiles")
    .select("id, name, whatsapp")
    .eq("id", targetUserId)
    .maybeSingle();

  if (!reqSchedule || !tgtSchedule || !tgtProfile?.whatsapp) {
    await sendWA(requester.whatsapp ? deps : deps, requester.whatsapp, `Erro ao montar a troca. Envie "troca" novamente.\n\n_LEVI_`);
    return;
  }

  // Create swap_swaps record (pending)
  const { data: swapRow, error: swapErr } = await deps.supabase
    .from("schedule_swaps")
    .insert({
      department_id: reqSchedule.department_id,
      requester_schedule_id: reqSchedule.id,
      target_schedule_id: targetScheduleId,
      requester_user_id: requester.id,
      target_user_id: targetUserId,
      reason: "Solicitação via WhatsApp",
    })
    .select("id")
    .single();

  if (swapErr) {
    console.error("Error creating swap:", swapErr);
    await sendWA(deps, requester.whatsapp, `Erro ao criar a solicitação. Tente novamente mais tarde.\n\n_LEVI_`);
    return;
  }

  // Update session
  await deps.supabase
    .from("whatsapp_swap_sessions")
    .update({
      state: "awaiting_response",
      current_target_user_id: targetUserId,
      current_target_schedule_id: targetScheduleId,
      swap_id: swapRow.id,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .eq("id", session.id);

  const reqFname = (requester.name || "").split(" ")[0] || "Um voluntário";
  const tgtFname = (tgtProfile.name || "").split(" ")[0] || "amigo(a)";
  const deptName = reqSchedule.departments?.name ?? "";

  // Notify target
  const msg =
    `🔄 *Pedido de Troca de Escala*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Oi *${tgtFname}*! 👋\n\n` +
    `📖 *Leia com atenção, por favor.*\n\n` +
    `*${reqFname}* pediu para trocar de escala com você no departamento *${deptName}*.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📥 *Você assumiria:*\n` +
    `   📆 ${fmtDate(reqSchedule.date)}\n` +
    `   ⏰ ${fmtTime(reqSchedule.time_start)}-${fmtTime(reqSchedule.time_end)}\n\n` +
    `📤 *${reqFname} assume a sua:*\n` +
    `   📆 ${fmtDate(tgtSchedule.date)}\n` +
    `   ⏰ ${fmtTime(tgtSchedule.time_start)}-${fmtTime(tgtSchedule.time_end)}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `✍️ *Responda agora:*\n` +
    `   ✅ *"sim"* — para aceitar\n` +
    `   ❌ *"não"* — para recusar\n\n` +
    `_LEVI_`;
  await sendWA(deps, tgtProfile.whatsapp, msg);

  // Confirm to requester
  await sendWA(
    deps,
    requester.whatsapp,
    `✉️ *Solicitação enviada!*\n━━━━━━━━━━━━━━━━━━━━\n\nPedido enviado para *${tgtFname}*.\n\n⏳ Aguarde a resposta — assim que ${tgtFname} responder, eu te aviso aqui.\n\n_LEVI_`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 4: Target responds sim/não
// ─────────────────────────────────────────────────────────────────────

async function handleTargetResponse(
  deps: SwapFlowDeps,
  target: Profile,
  session: any,
  accept: boolean,
): Promise<void> {
  const swapId = session.swap_id;

  // Get requester
  const { data: reqProfile } = await deps.supabase
    .from("profiles")
    .select("id, name, whatsapp")
    .eq("id", session.user_id)
    .maybeSingle();

  if (accept) {
    // Update swap status & execute
    await deps.supabase
      .from("schedule_swaps")
      .update({ status: "accepted", resolved_at: new Date().toISOString() })
      .eq("id", swapId);

    const { error: execErr } = await deps.supabase.rpc("execute_schedule_swap", { swap_id: swapId });
    if (execErr) {
      console.error("execute_schedule_swap error:", execErr);
      await sendWA(deps, target.whatsapp, `❌ Erro ao concluir a troca. Avise seu líder.\n\n_LEVI_`);
      if (reqProfile?.whatsapp) {
        await sendWA(deps, reqProfile.whatsapp, `❌ Erro ao concluir a troca com ${target.name}. Avise seu líder.\n\n_LEVI_`);
      }
      return;
    }

    await deps.supabase
      .from("whatsapp_swap_sessions")
      .update({ state: "done" })
      .eq("id", session.id);

    await sendWA(deps, target.whatsapp, `✅ *Troca confirmada!*\n━━━━━━━━━━━━━━━━━━━━\n\n📖 _Leia com atenção:_\nSuas escalas já foram *atualizadas* no sistema.\n\n_LEVI_`);
    if (reqProfile?.whatsapp) {
      const tgtFname = (target.name || "").split(" ")[0];
      await sendWA(
        deps,
        reqProfile.whatsapp,
        `✅ *Troca confirmada!*\n━━━━━━━━━━━━━━━━━━━━\n\n📖 _Leia com atenção:_\n*${tgtFname}* aceitou a troca. Suas escalas já foram *atualizadas*.\n\n_LEVI_`,
      );
    }
    return;
  }

  // Rejected
  await deps.supabase
    .from("schedule_swaps")
    .update({ status: "rejected", resolved_at: new Date().toISOString() })
    .eq("id", swapId);

  await sendWA(deps, target.whatsapp, `Tudo bem, recusa registrada.\n\n_LEVI_`);

  // Try next candidate (up to MAX_ATTEMPTS)
  const userIds: string[] = session.candidate_target_user_ids ?? [];
  const schIds: string[] = session.candidate_target_schedule_ids ?? [];
  const currentIdx = userIds.indexOf(session.current_target_user_id);
  const remaining = userIds.slice(currentIdx + 1);
  const remainingSch = schIds.slice(currentIdx + 1);
  const nextAttempt = (session.attempts_count ?? 0) + 1;

  if (remaining.length === 0 || nextAttempt >= MAX_ATTEMPTS) {
    // Give up
    await deps.supabase
      .from("whatsapp_swap_sessions")
      .update({ state: "cancelled" })
      .eq("id", session.id);

    if (reqProfile?.whatsapp) {
      await sendWA(
        deps,
        reqProfile.whatsapp,
        `❌ Não foi possível encontrar substituto após ${nextAttempt} tentativa(s).\nFale com seu líder para resolver.\n\n_LEVI_`,
      );
    }

    // Notify leader
    const { data: reqSchedule } = await deps.supabase
      .from("schedules")
      .select("date, department_id")
      .eq("id", session.requester_schedule_id)
      .maybeSingle();
    if (reqSchedule && reqProfile) {
      await notifyLeader(deps, reqSchedule.department_id, reqProfile.name, fmtDate(reqSchedule.date));
    }
    return;
  }

  // Auto-try the next candidate
  const nextUserId = remaining[0];
  const nextSchId = remainingSch[0];
  await deps.supabase
    .from("whatsapp_swap_sessions")
    .update({ attempts_count: nextAttempt })
    .eq("id", session.id);

  if (reqProfile) {
    await askTarget(
      deps,
      reqProfile as Profile,
      { ...session, attempts_count: nextAttempt },
      nextUserId,
      nextSchId,
    );
  }
}

async function notifyLeader(
  deps: SwapFlowDeps,
  departmentId: string,
  requesterName: string,
  dateStr: string,
): Promise<void> {
  const { data: dept } = await deps.supabase
    .from("departments")
    .select("name, leader_id")
    .eq("id", departmentId)
    .maybeSingle();
  if (!dept?.leader_id) return;
  const { data: leader } = await deps.supabase
    .from("profiles")
    .select("name, whatsapp")
    .eq("id", dept.leader_id)
    .maybeSingle();
  if (!leader?.whatsapp) return;
  const msg =
    `🔔 *${requesterName}* tentou trocar a escala de *${dateStr}* (${dept.name}) pelo WhatsApp e não encontrou substituto.\nPor favor, ajude a resolver.\n\n_LEVI_`;
  await sendWA(deps, leader.whatsapp, msg);
}

// ─────────────────────────────────────────────────────────────────────
// Main entry point — returns true if it handled the message.
// ─────────────────────────────────────────────────────────────────────

export async function tryHandleSwapMessage(
  deps: SwapFlowDeps,
  profile: Profile,
  text: string,
): Promise<boolean> {
  // 1. Initiation keyword
  if (isSwapInitiation(text)) {
    await startSwap(deps, profile);
    return true;
  }

  // 2. Active session for the sender as initiator?
  const initSession = await findActiveSession(deps, profile.id);
  if (initSession) {
    if (isCancel(text)) {
      await deps.supabase
        .from("whatsapp_swap_sessions")
        .update({ state: "cancelled" })
        .eq("id", initSession.id);
      await sendWA(deps, profile.whatsapp, `Troca cancelada.\n\n_LEVI_`);
      return true;
    }

    const pick = parseNumberPick(text);
    if (pick === null) {
      await sendWA(
        deps,
        profile.whatsapp,
        `Não entendi. Responda com um *número* da lista, ou "cancelar".\n\n_LEVI_`,
      );
      return true;
    }

    if (initSession.state === "awaiting_schedule_pick") {
      await handleSchedulePick(deps, profile, initSession, pick);
      return true;
    }
    if (initSession.state === "awaiting_target_pick") {
      await handleTargetPick(deps, profile, initSession, pick);
      return true;
    }
  }

  // 3. Active session where sender is the target awaiting response?
  const respSession = await findPendingResponseSession(deps, profile.id);
  if (respSession) {
    if (isYes(text)) {
      await handleTargetResponse(deps, profile, respSession, true);
      return true;
    }
    if (isNo(text)) {
      await handleTargetResponse(deps, profile, respSession, false);
      return true;
    }
    await sendWA(
      deps,
      profile.whatsapp,
      `Responda *"sim"* ou *"não"* para a troca.\n\n_LEVI_`,
    );
    return true;
  }

  return false;
}

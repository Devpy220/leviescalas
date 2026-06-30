// Swap flow over WhatsApp.
// Handles a stateful menu-based conversation for schedule swaps.
// Localized via DDI (PT/ES/EN) — see _shared/whatsappI18n.ts

import {
  detectLang,
  t,
  fmtTime,
  fmtDateLang,
  isSwapInitiationMulti,
  isCancelMulti,
  isYesMulti,
  isNoMulti,
} from "../_shared/whatsappI18n.ts";

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

// Backward-compat exports (still used elsewhere if any)
export const isSwapInitiation = isSwapInitiationMulti;
export const isCancel = isCancelMulti;
export const isYes = isYesMulti;
export const isNo = isNoMulti;

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
  console.log(`[startSwap] user=${profile.id}`);
  const lang = detectLang(profile.whatsapp);
  const fname = (profile.name || "").split(" ")[0] || "👋";

  const { data: memberships, error: memErr } = await deps.supabase
    .from("members")
    .select("department_id")
    .eq("user_id", profile.id);
  if (memErr) console.error("[startSwap] memberships error:", memErr);
  const deptIds = (memberships ?? []).map((m: any) => m.department_id);
  console.log(`[startSwap] deptIds=${JSON.stringify(deptIds)}`);
  if (deptIds.length === 0) {
    await sendWA(deps, profile.whatsapp, t(lang, "no_active_dept", { fname }));
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
    await sendWA(deps, profile.whatsapp, t(lang, "no_swap_schedules", { fname }));
    return;
  }

  await cancelOldSessions(deps, profile.id);

  const igLine = "📲 Siga a ELSD no Instagram:\nhttps://instagram.com/elsdigital_tech";

  let msg =
    `${t(lang, "swap_start_title")}\n━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${t(lang, "swap_start_intro", { fname })}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n${t(lang, "swap_start_list_title")}\n\n`;
  schedules.forEach((s: any, i: number) => {
    msg += t(lang, "line_schedule", {
      i: i + 1,
      date: fmtDateLang(s.date, lang),
      ts: fmtTime(s.time_start),
      te: fmtTime(s.time_end),
      dept: s.departments?.name ?? "",
    }) + "\n\n";
  });
  msg += `━━━━━━━━━━━━━━━━━━━━\n${t(lang, "swap_start_footer")}\n\n${igLine}\n\n_LEVI_`;

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

  const { data: members } = await deps.supabase
    .from("members")
    .select("user_id")
    .eq("department_id", reqSchedule.department_id)
    .neq("user_id", reqSchedule.user_id);

  const memberIds = (members ?? []).map((m: any) => m.user_id);
  if (memberIds.length === 0) return [];

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

  const { data: theirSchedules } = await deps.supabase
    .from("schedules")
    .select("id, date, time_start, time_end, user_id")
    .eq("department_id", reqSchedule.department_id)
    .in("user_id", eligibleIds)
    .gte("date", today)
    .neq("date", reqSchedule.date)
    .order("date", { ascending: true });

  const { data: reqPref } = await deps.supabase
    .from("member_preferences")
    .select("blackout_dates")
    .eq("department_id", reqSchedule.department_id)
    .eq("user_id", reqSchedule.user_id)
    .maybeSingle();
  const reqBlackouts: string[] = (reqPref?.blackout_dates as string[]) ?? [];

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

  const { data: profiles } = await deps.supabase
    .from("profiles")
    .select("id, name, whatsapp")
    .in("id", candidates.map((c) => c.user_id));

  return candidates.map((c) => {
    const p = (profiles ?? []).find((pp: any) => pp.id === c.user_id);
    return {
      user_id: c.user_id,
      name: p?.name ?? "—",
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
  const lang = detectLang(profile.whatsapp);
  const ids: string[] = session.candidate_target_schedule_ids ?? [];
  if (pick < 1 || pick > ids.length) {
    await sendWA(deps, profile.whatsapp, t(lang, "swap_pick_invalid", { max: ids.length }));
    return;
  }
  const reqScheduleId = ids[pick - 1];

  const { data: reqSchedule } = await deps.supabase
    .from("schedules")
    .select("id, date, time_start, time_end, department_id, user_id")
    .eq("id", reqScheduleId)
    .maybeSingle();

  if (!reqSchedule) {
    await sendWA(deps, profile.whatsapp, t(lang, "swap_not_found"));
    await deps.supabase.from("whatsapp_swap_sessions").update({ state: "cancelled" }).eq("id", session.id);
    return;
  }

  const candidates = await getEligibleCandidates(deps, reqSchedule);
  if (candidates.length === 0) {
    await sendWA(deps, profile.whatsapp, t(lang, "swap_no_candidates"));
    await deps.supabase.from("whatsapp_swap_sessions").update({ state: "cancelled" }).eq("id", session.id);
    await notifyLeader(deps, reqSchedule.department_id, profile.name, fmtDateLang(reqSchedule.date, lang));
    return;
  }

  let msg =
    `${t(lang, "swap_target_title")}\n━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${t(lang, "swap_target_intro", {
      date: fmtDateLang(reqSchedule.date, lang),
      ts: fmtTime(reqSchedule.time_start),
      te: fmtTime(reqSchedule.time_end),
    })}\n\n━━━━━━━━━━━━━━━━━━━━\n${t(lang, "swap_target_list_title")}\n\n`;
  candidates.forEach((c, i) => {
    msg += t(lang, "line_target", {
      i: i + 1,
      name: c.name,
      date: fmtDateLang(c.date, lang),
      ts: fmtTime(c.time_start),
      te: fmtTime(c.time_end),
    }) + "\n\n";
  });
  const igLine2 = "📲 Siga a ELSD no Instagram:\nhttps://instagram.com/elsdigital_tech";
  msg += `━━━━━━━━━━━━━━━━━━━━\n${t(lang, "swap_target_footer")}\n\n${igLine2}\n\n_LEVI_`;

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
  const lang = detectLang(profile.whatsapp);
  const userIds: string[] = session.candidate_target_user_ids ?? [];
  const schIds: string[] = session.candidate_target_schedule_ids ?? [];
  if (pick < 1 || pick > userIds.length) {
    await sendWA(deps, profile.whatsapp, t(lang, "swap_pick_invalid", { max: userIds.length }));
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
  const reqLang = detectLang(requester.whatsapp);

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
    await sendWA(deps, requester.whatsapp, t(reqLang, "swap_error_create"));
    return;
  }

  const tgtLang = detectLang(tgtProfile.whatsapp);

  const { data: swapRow, error: swapErr } = await deps.supabase
    .from("schedule_swaps")
    .insert({
      department_id: reqSchedule.department_id,
      requester_schedule_id: reqSchedule.id,
      target_schedule_id: targetScheduleId,
      requester_user_id: requester.id,
      target_user_id: targetUserId,
      reason: "WhatsApp swap request",
    })
    .select("id")
    .single();

  if (swapErr) {
    console.error("Error creating swap:", swapErr);
    await sendWA(deps, requester.whatsapp, t(reqLang, "swap_error_create"));
    return;
  }

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

  const reqFname = (requester.name || "").split(" ")[0] || "—";
  const tgtFname = (tgtProfile.name || "").split(" ")[0] || "👋";
  const deptName = reqSchedule.departments?.name ?? "";

  // Notify target — in target's language
  const igLine3 = "📲 Siga a ELSD no Instagram:\nhttps://instagram.com/elsdigital_tech";
  const msg =
    `${t(tgtLang, "swap_request_title")}\n━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${t(tgtLang, "swap_request_body", { tgt: tgtFname, req: reqFname, dept: deptName })}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${t(tgtLang, "swap_assume_yours", {
      date: fmtDateLang(reqSchedule.date, tgtLang),
      ts: fmtTime(reqSchedule.time_start),
      te: fmtTime(reqSchedule.time_end),
    })}\n\n` +
    `${t(tgtLang, "swap_assume_theirs", {
      req: reqFname,
      date: fmtDateLang(tgtSchedule.date, tgtLang),
      ts: fmtTime(tgtSchedule.time_start),
      te: fmtTime(tgtSchedule.time_end),
    })}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${t(tgtLang, "swap_request_actions")}\n\n${igLine3}\n\n_LEVI_`;
  await sendWA(deps, tgtProfile.whatsapp, msg);

  // Confirm to requester — in requester's language
  await sendWA(deps, requester.whatsapp, t(reqLang, "swap_sent", { tgt: tgtFname }));
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
  const tgtLang = detectLang(target.whatsapp);
  const swapId = session.swap_id;

  const { data: reqProfile } = await deps.supabase
    .from("profiles")
    .select("id, name, whatsapp")
    .eq("id", session.user_id)
    .maybeSingle();

  const reqLang = reqProfile?.whatsapp ? detectLang(reqProfile.whatsapp) : "pt";

  if (accept) {
    await deps.supabase
      .from("schedule_swaps")
      .update({ status: "accepted", resolved_at: new Date().toISOString() })
      .eq("id", swapId);

    const { error: execErr } = await deps.supabase.rpc("execute_schedule_swap", { swap_id: swapId });
    if (execErr) {
      console.error("execute_schedule_swap error:", execErr);
      await sendWA(deps, target.whatsapp, t(tgtLang, "swap_error"));
      if (reqProfile?.whatsapp) {
        await sendWA(deps, reqProfile.whatsapp, t(reqLang, "swap_error_with", { name: target.name }));
      }
      return;
    }

    await deps.supabase
      .from("whatsapp_swap_sessions")
      .update({ state: "done" })
      .eq("id", session.id);

    await sendWA(deps, target.whatsapp, t(tgtLang, "swap_confirmed_target"));
    if (reqProfile?.whatsapp) {
      const tgtFname = (target.name || "").split(" ")[0];
      await sendWA(deps, reqProfile.whatsapp, t(reqLang, "swap_confirmed_requester", { tgt: tgtFname }));
    }
    return;
  }

  // Rejected
  await deps.supabase
    .from("schedule_swaps")
    .update({ status: "rejected", resolved_at: new Date().toISOString() })
    .eq("id", swapId);

  await sendWA(deps, target.whatsapp, t(tgtLang, "swap_rejected"));

  // Try next candidate
  const userIds: string[] = session.candidate_target_user_ids ?? [];
  const schIds: string[] = session.candidate_target_schedule_ids ?? [];
  const currentIdx = userIds.indexOf(session.current_target_user_id);
  const remaining = userIds.slice(currentIdx + 1);
  const remainingSch = schIds.slice(currentIdx + 1);
  const nextAttempt = (session.attempts_count ?? 0) + 1;

  if (remaining.length === 0 || nextAttempt >= MAX_ATTEMPTS) {
    await deps.supabase
      .from("whatsapp_swap_sessions")
      .update({ state: "cancelled" })
      .eq("id", session.id);

    if (reqProfile?.whatsapp) {
      await sendWA(deps, reqProfile.whatsapp, t(reqLang, "swap_no_substitute", { n: nextAttempt }));
    }

    const { data: reqSchedule } = await deps.supabase
      .from("schedules")
      .select("date, department_id")
      .eq("id", session.requester_schedule_id)
      .maybeSingle();
    if (reqSchedule && reqProfile) {
      await notifyLeader(deps, reqSchedule.department_id, reqProfile.name, fmtDateLang(reqSchedule.date, reqLang));
    }
    return;
  }

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
  const lang = detectLang(leader.whatsapp);
  await sendWA(
    deps,
    leader.whatsapp,
    t(lang, "leader_alert", { name: requesterName, date: dateStr, dept: dept.name }),
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main entry point — returns true if it handled the message.
// ─────────────────────────────────────────────────────────────────────

export async function tryHandleSwapMessage(
  deps: SwapFlowDeps,
  profile: Profile,
  text: string,
): Promise<boolean> {
  const lang = detectLang(profile.whatsapp);

  if (isSwapInitiationMulti(text)) {
    await startSwap(deps, profile);
    return true;
  }

  const initSession = await findActiveSession(deps, profile.id);
  if (initSession) {
    if (isCancelMulti(text)) {
      await deps.supabase
        .from("whatsapp_swap_sessions")
        .update({ state: "cancelled" })
        .eq("id", initSession.id);
      await sendWA(deps, profile.whatsapp, t(lang, "swap_cancelled"));
      return true;
    }

    const pick = parseNumberPick(text);
    if (pick === null) {
      await sendWA(deps, profile.whatsapp, t(lang, "swap_invalid_pick"));
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

  const respSession = await findPendingResponseSession(deps, profile.id);
  if (respSession) {
    if (isYesMulti(text)) {
      await handleTargetResponse(deps, profile, respSession, true);
      return true;
    }
    if (isNoMulti(text)) {
      await handleTargetResponse(deps, profile, respSession, false);
      return true;
    }
    await sendWA(deps, profile.whatsapp, t(lang, "swap_yes_no"));
    return true;
  }

  return false;
}

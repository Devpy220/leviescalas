// Avisos de WhatsApp do LeviKids (check-in, check-out e chamada de responsável).
//
// Segurança: a função NÃO confia no que o app envia. Recebe só { event, checkin_id }
// e valida no servidor quem está chamando:
//   - checkin:      quem fez o check-in (checkin_by), nos primeiros 10 min
//   - checkout:     quem fez o check-out (checkout_by), nos primeiros 10 min
//   - teacher_call: líder da página ou professor escalado hoje na sala, criança ainda presente
// Cada aviso de check-in/check-out é "reservado" no banco antes do envio (checkin_notified_at /
// checkout_notified_at), então repetir a chamada nunca duplica mensagem.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendUazapiText } from "../_shared/uazapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EventType = "checkin" | "checkout" | "teacher_call";
const EVENTS: EventType[] = ["checkin", "checkout", "teacher_call"];
const FRESH_MS = 10 * 60 * 1000;
const CALL_COOLDOWN_MS = 2 * 60 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Remove marcação do WhatsApp e quebras de linha de textos digitados por pessoas.
const clean = (s: string | null | undefined) =>
  (s ?? "").replace(/[*_~`>\r\n]+/g, " ").replace(/\s+/g, " ").trim();
const first = (s: string) => clean(s).split(" ")[0] || "";

const timeBR = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const todayBR = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const digits = (p: string) => p.replace(/\D/g, "");

interface Recipient { name: string; phone: string; role: "guardian" | "teacher" }

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let claimedColumn: "checkin_notified_at" | "checkout_notified_at" | null = null;
  let claimedId = "";
  let admin: ReturnType<typeof createClient> | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: auth, error: authErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const callerId = auth?.claims?.sub as string | undefined;
    if (authErr || !callerId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null) as { event?: string; checkin_id?: string } | null;
    const event = body?.event as EventType | undefined;
    const checkinId = body?.checkin_id;
    if (!event || !EVENTS.includes(event) || !checkinId || !/^[0-9a-f-]{36}$/i.test(checkinId)) {
      return json({ error: "invalid_body" }, 400);
    }

    admin = createClient(url, service);

    // ---- Check-in alvo ------------------------------------------------------
    const { data: ci } = await admin
      .from("kids_checkins")
      .select(`id, child_id, room_id, checkin_at, checkin_by, checkout_at, checkout_by,
               pickup_person_name, pickup_is_registered, checkin_notified_at, checkout_notified_at,
               kids_children(full_name, page_id),
               kids_rooms(name, page_id)`)
      .eq("id", checkinId)
      .maybeSingle();
    if (!ci) return json({ error: "checkin_not_found" }, 404);

    const child = (ci as any).kids_children as { full_name: string; page_id: string } | null;
    const room = (ci as any).kids_rooms as { name: string; page_id: string } | null;
    if (!child || !room) return json({ error: "checkin_not_found" }, 404);

    // ---- Autorização do chamador -------------------------------------------
    const now = Date.now();
    if (event === "checkin") {
      if (ci.checkin_by !== callerId || now - new Date(ci.checkin_at).getTime() > FRESH_MS) {
        return json({ error: "forbidden" }, 403);
      }
    } else if (event === "checkout") {
      if (!ci.checkout_at || ci.checkout_by !== callerId || now - new Date(ci.checkout_at).getTime() > FRESH_MS) {
        return json({ error: "forbidden" }, 403);
      }
    } else {
      if (ci.checkout_at) return json({ error: "already_checked_out" }, 409);
      const { data: isLeader } = await admin.rpc("is_kids_leader", { _user_id: callerId, _page_id: room.page_id });
      const { data: isScheduled } = await admin.rpc("is_kids_teacher_scheduled_today", { _user_id: callerId, _room_id: ci.room_id });
      if (!isLeader && !isScheduled) return json({ error: "forbidden" }, 403);
    }

    // ---- Idempotência (check-in / check-out) -------------------------------
    if (event === "checkin" || event === "checkout") {
      const col = event === "checkin" ? "checkin_notified_at" : "checkout_notified_at";
      const { data: claimed } = await admin
        .from("kids_checkins")
        .update({ [col]: new Date().toISOString() })
        .eq("id", ci.id)
        .is(col, null)
        .select("id");
      if (!claimed || claimed.length === 0) return json({ sent: 0, total: 0, duplicate: true });
      claimedColumn = col;
      claimedId = ci.id;
    }

    // ---- Dados da igreja / página ------------------------------------------
    const { data: page } = await admin
      .from("kids_pages")
      .select("name, churches(name)")
      .eq("id", child.page_id)
      .maybeSingle();
    const churchName = clean((page as any)?.churches?.name) || "Igreja";
    const pageName = clean((page as any)?.name) || "LeviKids";
    const childName = clean(child.full_name);
    const roomName = clean(room.name) || "Sala";
    const header = `*${pageName} — ${churchName}*`;

    // ---- Destinatários ------------------------------------------------------
    const { data: gcs } = await admin
      .from("kids_guardian_children")
      .select("kids_guardians(user_id, full_name, phone)")
      .eq("child_id", ci.child_id);

    const guardianRows = (gcs ?? [])
      .map((gc: any) => gc.kids_guardians)
      .filter((g: any) => g?.phone) as Array<{ user_id: string; full_name: string; phone: string }>;

    // Respeita quem pediu SAIR (opt-out) no WhatsApp.
    const optedOut = new Set<string>();
    const guardianUserIds = guardianRows.map((g) => g.user_id);

    let teacherRows: Array<{ id: string; name: string | null; whatsapp: string | null }> = [];
    if (event !== "teacher_call") {
      const { data: sched } = await admin
        .from("kids_room_schedules")
        .select("user_id")
        .eq("room_id", ci.room_id)
        .eq("service_date", todayBR());
      const teacherIds = [...new Set((sched ?? []).map((s: any) => s.user_id as string))];
      if (teacherIds.length) {
        const { data: tp } = await admin.from("profiles").select("id, name, whatsapp").in("id", teacherIds);
        teacherRows = (tp ?? []) as typeof teacherRows;
      }
    }

    const allIds = [...new Set([...guardianUserIds, ...teacherRows.map((t) => t.id)])];
    if (allIds.length) {
      const { data: oo } = await admin.from("profiles").select("id").in("id", allIds).not("whatsapp_opt_out_at", "is", null);
      (oo ?? []).forEach((p: any) => optedOut.add(p.id));
    }

    // Quem fez o check-in (para a mensagem do professor)
    let checkinByName = "";
    if (event === "checkin") {
      const { data: who } = await admin.from("kids_guardians").select("full_name").eq("user_id", ci.checkin_by).maybeSingle();
      checkinByName = clean(who?.full_name);
    }

    const recipients: Recipient[] = [];
    const seen = new Set<string>();
    const push = (name: string, phone: string | null | undefined, role: Recipient["role"], userId?: string) => {
      if (!phone || (userId && optedOut.has(userId))) return;
      const d = digits(phone);
      if (d.length < 8 || seen.has(d)) return;
      seen.add(d);
      recipients.push({ name, phone, role });
    };
    guardianRows.forEach((g) => push(g.full_name, g.phone, "guardian", g.user_id));
    teacherRows.forEach((t) => push(t.name || "Professor(a)", t.whatsapp, "teacher", t.id));

    // ---- Mensagens ---------------------------------------------------------
    const pickupName = clean(ci.pickup_person_name);
    const pickupRegistered = ci.pickup_is_registered === true;
    const when = ci.checkout_at ? timeBR(ci.checkout_at) : timeBR(ci.checkin_at);

    const buildMessage = (r: Recipient): string => {
      const hi = `Olá ${first(r.name)},`;
      if (event === "teacher_call") {
        return `${hi}\n\n🔔 ${header}\n\nFavor comparecer à sala *${roomName}* para atender *${childName}*.\n\nAguardamos você.`;
      }
      if (event === "checkin") {
        return r.role === "guardian"
          ? `${hi}\n\n👶 ${header}\n\nCheck-in confirmado às ${when}: *${childName}* está na sala *${roomName}*.\n\nVocê será avisado(a) quando a retirada for feita.`
          : `${hi}\n\n👶 ${header}\n\nCheck-in às ${when}: *${childName}* chegou na sala *${roomName}*${checkinByName ? `, trazido(a) por *${checkinByName}*` : ""}.`;
      }
      // checkout
      const base = `✅ ${header}\n\n*${childName}* foi retirado(a) da sala *${roomName}* às ${when} por *${pickupName}*.`;
      if (r.role === "guardian") {
        return pickupRegistered
          ? `${hi}\n\n${base}\n\nObrigado por confiar em nós!`
          : `${hi}\n\n${base}\n\n⚠️ Essa pessoa *não está cadastrada* como responsável no app. Se você não reconhece ou não autorizou essa retirada, fale com a liderança do LeviKids agora.`;
      }
      return `${hi}\n\n${base}${pickupRegistered ? "" : "\n\n⚠️ Retirada por pessoa não cadastrada como responsável."}`;
    };

    // ---- Envio -------------------------------------------------------------
    let sent = 0;
    for (const r of recipients) {
      if (event === "teacher_call") {
        // Evita spam: no máximo 1 chamada a cada 2 min para o mesmo número.
        const since = new Date(Date.now() - CALL_COOLDOWN_MS).toISOString();
        const { count } = await admin
          .from("whatsapp_logs")
          .select("id", { count: "exact", head: true })
          .eq("phone", r.phone)
          .eq("origin", "kids-teacher_call")
          .eq("status", "sent")
          .gte("created_at", since);
        if ((count ?? 0) > 0) continue;
      }
      const msg = buildMessage(r);
      const res = await sendUazapiText(r.phone, msg, 1);
      if (res.ok) sent++;
      await admin.from("whatsapp_logs").insert({
        phone: r.phone,
        message: msg,
        status: res.ok ? "sent" : "failed",
        error: res.ok ? null : (typeof res.response === "string" ? res.response : JSON.stringify(res.response ?? res.error ?? null)),
        origin: `kids-${event}`,
        zapi_response: { provider: "uazapi", ...((res.response as object) ?? {}) },
      });
    }

    // Se nada foi entregue, libera a reserva para permitir nova tentativa.
    if (claimedColumn && recipients.length > 0 && sent === 0) {
      await admin.from("kids_checkins").update({ [claimedColumn]: null }).eq("id", claimedId);
    }

    return json({ sent, total: recipients.length });
  } catch (e) {
    if (admin && claimedColumn && claimedId) {
      try {
        await admin.from("kids_checkins").update({ [claimedColumn]: null }).eq("id", claimedId);
      } catch { /* libera reserva em melhor esforço */ }
    }
    console.error("kids-notify-whatsapp error:", e instanceof Error ? e.message : e);
    return json({ error: "internal_error" }, 500);
  }
});

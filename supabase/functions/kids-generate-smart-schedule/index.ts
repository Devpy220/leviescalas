// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supa = createClient(url, service, { auth: { persistSession: false } });

    // valida usuário
    const { data: u } = await supa.auth.getUser(jwt);
    const userId = u?.user?.id;
    if (!userId) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const pageId = body.page_id as string;
    const targetDate = body.service_date as string; // YYYY-MM-DD
    if (!pageId || !targetDate) return json({ error: "page_id e service_date são obrigatórios" }, 400);

    // valida se é líder da página
    const { data: leader } = await supa.from("kids_leaders").select("id").eq("page_id", pageId).eq("user_id", userId).maybeSingle();
    if (!leader) return json({ error: "Somente o líder do LeviKids pode gerar escala" }, 403);

    // valida se a data cai em algum service day ativo
    const jsDate = new Date(targetDate + "T12:00:00");
    const weekday = jsDate.getUTCDay();
    const { data: sds } = await supa.from("kids_service_days").select("*").eq("page_id", pageId).eq("active", true);
    const validForDate = (sds || []).some((s: any) => s.specific_date === targetDate || (s.specific_date === null && s.weekday === weekday));
    if (!validForDate) return json({ error: "Nenhum dia de aula ativo cadastrado para esta data" }, 400);

    // carrega salas ativas
    const { data: rooms } = await supa.from("kids_rooms").select("id, name, page_id, active").eq("page_id", pageId).eq("active", true);
    if (!rooms || rooms.length === 0) return json({ error: "Sem salas ativas" }, 400);

    // carrega pool de professores por sala
    const roomIds = rooms.map((r: any) => r.id);
    const { data: pool } = await supa.from("kids_teacher_rooms").select("user_id, room_id").in("room_id", roomIds);

    // remove escalas anteriores desta data para reconstruir
    await supa.from("kids_room_schedules").delete().eq("service_date", targetDate).in("room_id", roomIds);

    // conta atribuições por professor no mês (para balanceamento)
    const firstOfMonth = targetDate.slice(0, 8) + "01";
    const lastOfMonth = new Date(jsDate.getUTCFullYear(), jsDate.getUTCMonth() + 1, 0).toISOString().slice(0, 10);
    const { data: monthCounts } = await supa
      .from("kids_room_schedules")
      .select("user_id")
      .in("room_id", roomIds)
      .gte("service_date", firstOfMonth)
      .lte("service_date", lastOfMonth);
    const countMap = new Map<string, number>();
    (monthCounts || []).forEach((r: any) => countMap.set(r.user_id, (countMap.get(r.user_id) || 0) + 1));

    // distribuição: para cada sala, pega o(s) prof(s) menos escalado(s) no mês
    const inserts: { room_id: string; user_id: string; service_date: string }[] = [];
    const assignedToday = new Set<string>();

    for (const room of rooms) {
      const candidates = (pool || []).filter((p: any) => p.room_id === room.id).map((p: any) => p.user_id);
      if (candidates.length === 0) continue;
      // ordena por menor contagem no mês, prefere quem ainda não está escalado hoje
      candidates.sort((a: string, b: string) => {
        const aToday = assignedToday.has(a) ? 1 : 0;
        const bToday = assignedToday.has(b) ? 1 : 0;
        if (aToday !== bToday) return aToday - bToday;
        return (countMap.get(a) || 0) - (countMap.get(b) || 0);
      });
      // atribui 1 professor (ou 2 se houver ≥ 2 disponíveis e a sala parece precisar — regra simples)
      const need = candidates.length >= 2 ? 2 : 1;
      for (let i = 0; i < Math.min(need, candidates.length); i++) {
        const uid = candidates[i];
        inserts.push({ room_id: room.id, user_id: uid, service_date: targetDate });
        assignedToday.add(uid);
        countMap.set(uid, (countMap.get(uid) || 0) + 1);
      }
    }

    if (inserts.length > 0) {
      const { error } = await supa.from("kids_room_schedules").insert(inserts);
      if (error) return json({ error: error.message }, 500);
    }

    return json({ assigned: inserts.length, rooms: rooms.length });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronAuth } from "../_shared/cronAuth.ts";
import { sendUazapiText } from "../_shared/uazapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAY = 24 * 60 * 60 * 1000;

async function isOptedOut(supabase: any, phone: string) {
  const tail = phone.replace(/\D/g, "").slice(-8);
  if (tail.length < 8) return true;
  const { data } = await supabase.from("profiles").select("whatsapp").not("whatsapp_opt_out_at", "is", null);
  return (data ?? []).some((o: { whatsapp: string | null }) => (o.whatsapp || "").replace(/\D/g, "").endsWith(tail));
}

// Departments with no schedule activity in the last 60 days get a 5-day warning
// (daily WhatsApp to the leader). If still inactive, the department is deleted.
// If every department of a church was removed this way and the church has no
// LeviKids page, the church is deleted too.
async function cleanupInactiveDepartments(supabase: any) {
  const now = Date.now();
  const cutoff = now - 60 * DAY;
  const cutoffDate = new Date(cutoff).toISOString().slice(0, 10);
  let deptDeleted = 0, deptNotified = 0, churchDeleted = 0;
  const touchedChurches = new Set<string>();

  const { data: depts, error } = await supabase
    .from("departments")
    .select("id, name, church_id, leader_id, created_at, inactivity_deadline, inactivity_last_notice_at");
  if (error) throw error;

  for (const d of depts ?? []) {
    const [{ count: recentByDate }, { count: recentByCreate }] = await Promise.all([
      supabase.from("schedules").select("id", { count: "exact", head: true }).eq("department_id", d.id).gte("date", cutoffDate),
      supabase.from("schedules").select("id", { count: "exact", head: true }).eq("department_id", d.id).gte("created_at", new Date(cutoff).toISOString()),
    ]);
    const active = (recentByDate ?? 0) > 0 || (recentByCreate ?? 0) > 0 || new Date(d.created_at).getTime() > cutoff;
    if (active) {
      if (d.inactivity_deadline) await supabase.from("departments").update({ inactivity_deadline: null, inactivity_last_notice_at: null }).eq("id", d.id);
      continue;
    }

    let deadline = d.inactivity_deadline ? new Date(d.inactivity_deadline).getTime() : 0;
    if (!deadline) {
      deadline = now + 5 * DAY;
      await supabase.from("departments").update({ inactivity_deadline: new Date(deadline).toISOString() }).eq("id", d.id);
    }

    if (now >= deadline) {
      await supabase.from("notifications").delete().eq("department_id", d.id);
      await supabase.from("schedules").delete().eq("department_id", d.id);
      await supabase.from("members").delete().eq("department_id", d.id);
      const { error: delErr } = await supabase.from("departments").delete().eq("id", d.id);
      if (delErr) console.error("delete dept failed", d.id, delErr);
      else { deptDeleted++; if (d.church_id) touchedChurches.add(d.church_id); console.log(`Deleted inactive department ${d.name}`); }
      continue;
    }

    if (d.inactivity_last_notice_at && now - new Date(d.inactivity_last_notice_at).getTime() < 20 * 60 * 60 * 1000) continue;
    const { data: p } = await supabase.from("profiles").select("name, whatsapp").eq("id", d.leader_id).maybeSingle();
    const phone = p?.whatsapp || "";
    if (!phone || await isOptedOut(supabase, phone)) continue;

    const daysLeft = Math.max(1, Math.ceil((deadline - now) / DAY));
    const first = (p?.name || "").trim().split(/\s+/)[0] || "líder";
    const text =
      `Olá, ${first}! 👋\n\n` +
      `O departamento *${d.name}* não tem nenhuma escala nos últimos 60 dias.\n\n` +
      `⏳ Faltam *${daysLeft} dia(s)*. Se nenhuma escala for criada até lá, o departamento será excluído automaticamente. ` +
      `Se todos os departamentos da igreja forem excluídos, a igreja também será.\n\n` +
      `Crie uma escala em:\nhttps://leviescalas.com.br/dashboard\n\n` +
      `Responda *SAIR* para não receber mais mensagens.`;
    const r = await sendUazapiText(phone, text);
    await supabase.from("whatsapp_logs").insert({
      phone, message: text, status: r.ok ? "sent" : "failed",
      error: r.ok ? null : r.error ?? null, origin: "department-inactivity-reminder", zapi_response: r.response ?? null,
    });
    if (r.ok) { deptNotified++; await supabase.from("departments").update({ inactivity_last_notice_at: new Date().toISOString() }).eq("id", d.id); }
  }

  for (const churchId of touchedChurches) {
    const [{ count: left }, { count: kids }] = await Promise.all([
      supabase.from("departments").select("id", { count: "exact", head: true }).eq("church_id", churchId),
      supabase.from("kids_pages").select("id", { count: "exact", head: true }).eq("church_id", churchId),
    ]);
    if ((left ?? 0) > 0 || (kids ?? 0) > 0) continue;
    const { error: e } = await supabase.from("churches").delete().eq("id", churchId);
    if (e) console.error("delete church failed", churchId, e); else churchDeleted++;
  }
  return { deptDeleted, deptNotified, churchDeleted };
}

// Churches without departments get 5 days (cleanup_deadline) to create one.
// Every day until the deadline the leader/registrant gets a WhatsApp reminder.
// After the deadline the church and everything linked to it is deleted.
// Churches using LeviKids (kids_pages) are considered active and never deleted here.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authFail = await requireCronAuth(req, corsHeaders);
  if (authFail) return authFail;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const deptResult = await cleanupInactiveDepartments(supabase);

    const { data: churches, error } = await supabase
      .from("churches")
      .select("id, name, code, leader_id, registrant_name, registrant_phone, phone, created_at, cleanup_deadline, cleanup_last_notice_at");
    if (error) throw error;

    const now = Date.now();
    let deleted = 0, notified = 0, failed = 0;

    for (const c of churches ?? []) {
      const [{ count: deptCount }, { count: kidsCount }] = await Promise.all([
        supabase.from("departments").select("id", { count: "exact", head: true }).eq("church_id", c.id),
        supabase.from("kids_pages").select("id", { count: "exact", head: true }).eq("church_id", c.id),
      ]);
      if ((deptCount ?? 0) > 0 || (kidsCount ?? 0) > 0) continue;

      const deadline = c.cleanup_deadline
        ? new Date(c.cleanup_deadline).getTime()
        : new Date(c.created_at).getTime() + 5 * DAY;

      if (now >= deadline) {
        const { error: delErr } = await supabase.from("churches").delete().eq("id", c.id);
        if (delErr) { console.error("delete church failed", c.id, delErr); failed++; }
        else { console.log(`Deleted inactive church ${c.name} (${c.id})`); deleted++; }
        continue;
      }

      // One reminder per day
      if (c.cleanup_last_notice_at && now - new Date(c.cleanup_last_notice_at).getTime() < 20 * 60 * 60 * 1000) continue;

      let phone = "";
      let name = c.registrant_name || "";
      if (c.leader_id) {
        const { data: p } = await supabase.from("profiles").select("name, whatsapp").eq("id", c.leader_id).maybeSingle();
        if (p?.whatsapp) { phone = p.whatsapp; name = p.name || name; }
      }
      if (!phone) phone = c.registrant_phone || c.phone || "";
      if (!phone) continue;

      // RGPD: respect SAIR opt-out
      if (await isOptedOut(supabase, phone)) continue;

      const daysLeft = Math.max(1, Math.ceil((deadline - now) / DAY));
      const first = (name || "").trim().split(/\s+/)[0] || "líder";
      const text =
        `Olá, ${first}! 👋\n\n` +
        `A igreja *${c.name}* foi cadastrada no LEVI, mas ainda não tem nenhum departamento.\n\n` +
        `⏳ Faltam *${daysLeft} dia(s)*. Se nenhum departamento for criado até lá, o cadastro da igreja será excluído automaticamente.\n\n` +
        `Crie o primeiro departamento pelo link:\nhttps://leviescalas.com.br/join?code=${c.code}\n\n` +
        `Responda *SAIR* para não receber mais mensagens.`;

      const r = await sendUazapiText(phone, text);
      await supabase.from("whatsapp_logs").insert({
        phone, message: text, status: r.ok ? "sent" : "failed",
        error: r.ok ? null : r.error ?? null, origin: "church-cleanup-reminder", zapi_response: r.response ?? null,
      });
      if (r.ok) {
        notified++;
        await supabase.from("churches").update({ cleanup_last_notice_at: new Date().toISOString() }).eq("id", c.id);
      } else failed++;
    }

    return new Response(JSON.stringify({ deleted, notified, failed, checked: churches?.length ?? 0, departments: deptResult }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("cleanup-inactive-churches error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

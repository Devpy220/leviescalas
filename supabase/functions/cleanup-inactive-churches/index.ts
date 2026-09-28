import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronAuth } from "../_shared/cronAuth.ts";
import { sendUazapiText } from "../_shared/uazapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAY = 24 * 60 * 60 * 1000;

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

    return new Response(JSON.stringify({ deleted, notified, failed, checked: churches?.length ?? 0 }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("cleanup-inactive-churches error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

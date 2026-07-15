// Sends WhatsApp notifications for LeviKids events via existing UAZAPI helper.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendUazapiText } from "../_shared/uazapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EventType = "checkin" | "checkout" | "teacher_call";

interface Body {
  event: EventType;
  child_id: string;
  room_id: string;
  pickup_code?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: auth, error: authErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (authErr || !auth?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.event || !body.child_id || !body.room_id) {
      return new Response(JSON.stringify({ error: "invalid_body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, service);

    // Fetch child + room + all guardian phones
    const { data: child, error: cErr } = await admin
      .from("kids_children")
      .select("id, full_name, page_id")
      .eq("id", body.child_id)
      .maybeSingle();
    if (cErr || !child) throw new Error("child_not_found");

    const { data: room } = await admin
      .from("kids_rooms")
      .select("id, name, page_id")
      .eq("id", body.room_id)
      .maybeSingle();

    const { data: page } = await admin
      .from("kids_pages")
      .select("id, name, church_id, churches(name)")
      .eq("id", child.page_id)
      .maybeSingle();

    const { data: gcs } = await admin
      .from("kids_guardian_children")
      .select("kids_guardians(full_name, phone)")
      .eq("child_id", body.child_id);

    const churchName = (page as any)?.churches?.name || "Igreja";
    const pageName = (page as any)?.name || "LeviKids";
    const roomName = room?.name || "Sala";

    let template = "";
    if (body.event === "checkin") {
      template = `👶 *${pageName} — ${churchName}*\n\nCheck-in confirmado para *${child.full_name}* na sala *${roomName}*.\n\n🔐 Código de retirada: *${body.pickup_code || "----"}*\n\nGuarde este código — ele é necessário para retirar a criança.`;
    } else if (body.event === "checkout") {
      template = `✅ *${pageName} — ${churchName}*\n\n*${child.full_name}* foi retirado(a) da sala *${roomName}* com sucesso.\n\nObrigado por confiar em nós!`;
    } else if (body.event === "teacher_call") {
      template = `🔔 *${pageName} — ${churchName}*\n\nFavor comparecer à sala *${roomName}* para atender *${child.full_name}*.\n\nAguardamos você.`;
    }

    const recipients: Array<{ name: string; phone: string }> = [];
    for (const gc of gcs || []) {
      const g = (gc as any).kids_guardians;
      if (g?.phone) recipients.push({ name: g.full_name, phone: g.phone });
    }

    let sent = 0;
    for (const r of recipients) {
      const msg = `Olá ${r.name.split(" ")[0]},\n\n${template}`;
      const res = await sendUazapiText(r.phone, msg);
      if (res.ok) sent++;
      await admin.from("whatsapp_logs").insert({
        phone: r.phone, message: msg,
        status: res.ok ? "sent" : "failed",
        error: res.ok ? null : (typeof res.response === "string" ? res.response : JSON.stringify(res.response)),
        origin: `kids-${body.event}`,
        zapi_response: { provider: "uazapi", ...(res.response as object ?? {}) },
      });
    }

    return new Response(JSON.stringify({ sent, total: recipients.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

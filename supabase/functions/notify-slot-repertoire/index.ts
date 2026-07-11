import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { fetchSlotNotesBlock } from "../_shared/slotNotesMessage.ts";
import { scheduleBatch } from "../_shared/whatsapp-queue.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const bodySchema = z.object({
  department_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  time_end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

const WEEKDAYS_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const normTime = (t: string) => (t.length === 5 ? `${t}:00` : t);
const fmtTime = (t: string) => t.slice(0, 5);

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS_PT[date.getUTCDay()]}, ${d} de ${MONTHS_PT[m - 1]}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    const { department_id, date } = parsed.data;
    const time_start = normTime(parsed.data.time_start);
    const time_end = normTime(parsed.data.time_end);

    // Permission: leader or scheduled at this slot
    const { data: dept } = await admin
      .from("departments")
      .select("id, name, leader_id")
      .eq("id", department_id)
      .maybeSingle();
    if (!dept) {
      return new Response(JSON.stringify({ error: "Department not found" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    let allowed = dept.leader_id === caller.id;
    if (!allowed) {
      const { data: mySched } = await admin
        .from("schedules")
        .select("id")
        .eq("department_id", department_id)
        .eq("date", date)
        .eq("time_start", time_start)
        .eq("time_end", time_end)
        .eq("user_id", caller.id)
        .limit(1);
      allowed = !!(mySched && mySched.length);
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Build message body
    const repertoireBlock = await fetchSlotNotesBlock(
      SUPABASE_URL, SERVICE_ROLE_KEY,
      department_id, date, time_start, time_end,
    );

    if (!repertoireBlock) {
      return new Response(JSON.stringify({ sent: false, reason: "empty_repertoire" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Fetch scheduled users
    const { data: schedules } = await admin
      .from("schedules")
      .select("user_id")
      .eq("department_id", department_id)
      .eq("date", date)
      .eq("time_start", time_start)
      .eq("time_end", time_end);

    const userIds = Array.from(new Set((schedules ?? []).map((s: any) => s.user_id).filter(Boolean)));
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: "no_scheduled_users" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, name, whatsapp")
      .in("id", userIds);

    const header =
      `🎤 *${dept.name}*\n` +
      `📅 ${formatDate(date)} — ⏰ ${fmtTime(time_start)} às ${fmtTime(time_end)}\n\n` +
      `_O repertório foi atualizado pelo Ministro de Louvor:_\n`;

    const recipients = (profiles ?? [])
      .filter((p: any) => p.whatsapp)
      .map((p: any) => ({
        phone: p.whatsapp as string,
        message: `Olá, ${(p.name || '').split(' ')[0] || 'irmão(ã)'}!\n\n${header}${repertoireBlock}`,
      }));

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: "no_phones" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const { promise, queued, backgrounded } = scheduleBatch(
      SUPABASE_URL, SERVICE_ROLE_KEY, recipients,
      { origin: "notify-slot-repertoire" },
    );
    // @ts-ignore - EdgeRuntime available in Supabase Deno
    if (typeof EdgeRuntime !== 'undefined' && (EdgeRuntime as any).waitUntil) {
      // @ts-ignore
      (EdgeRuntime as any).waitUntil(promise);
    }

    return new Response(
      JSON.stringify({ sent: true, recipients: recipients.length, queued, backgrounded }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("notify-slot-repertoire error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});

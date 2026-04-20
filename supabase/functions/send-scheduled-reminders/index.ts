import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppBatch, scheduleBatch, type WhatsAppRecipient } from "../_shared/whatsapp-queue.ts";
import { pickVariant, GREETINGS, CLOSINGS, REMINDER_EMOJIS } from "../_shared/messageVariants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatTime = (time: string): string => time.slice(0, 5);
const WEEKDAYS_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MONTHS_SHORT_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const ROLE_LABELS: Record<string, string> = { on_duty: 'Plantão', participant: 'Culto' };

// Single reminder window: 12h before schedule start.
// All departments are merged and shuffled into one humanized batch.
const REMINDER_WINDOWS = [
  { type: '12h', hoursAhead: 12, label: 'em 12 horas' },
];

const WINDOW_MARGIN_MINUTES = 35;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const BRAZIL_TZ = 'America/Sao_Paulo';
    const now = new Date();
    let totalSent = 0;
    let totalErrors = 0;

    const toBrazilParts = (date: Date) => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: BRAZIL_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }).formatToParts(date);
      const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
      return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}:${get('second')}` };
    };

    for (const window of REMINDER_WINDOWS) {
      const targetTime = new Date(now.getTime() + window.hoursAhead * 60 * 60 * 1000);
      const marginMs = WINDOW_MARGIN_MINUTES * 60 * 1000;
      const windowStart = new Date(targetTime.getTime() - marginMs);
      const windowEnd = new Date(targetTime.getTime() + marginMs);

      const brStart = toBrazilParts(windowStart);
      const brEnd = toBrazilParts(windowEnd);

      const { data: schedules, error: schedulesError } = await supabaseAdmin
        .from('schedules')
        .select('id, date, time_start, time_end, user_id, department_id, sector_id, assignment_role, sector:sectors(name)')
        .gte('date', brStart.date)
        .lte('date', brEnd.date);

      if (schedulesError || !schedules?.length) continue;

      const wStartStr = `${brStart.date}T${brStart.time}`;
      const wEndStr = `${brEnd.date}T${brEnd.time}`;
      const matchingSchedules = schedules.filter(s => {
        const sDateTime = `${s.date}T${s.time_start}`;
        return sDateTime >= wStartStr && sDateTime <= wEndStr;
      });
      if (!matchingSchedules.length) continue;

      const scheduleIds = matchingSchedules.map(s => s.id);
      const { data: alreadySent } = await supabaseAdmin
        .from('schedule_reminders_sent')
        .select('schedule_id')
        .in('schedule_id', scheduleIds)
        .eq('reminder_type', window.type);

      const alreadySentIds = new Set((alreadySent || []).map(r => r.schedule_id));
      const pendingSchedules = matchingSchedules.filter(s => !alreadySentIds.has(s.id));
      if (!pendingSchedules.length) continue;

      const userIds = [...new Set(pendingSchedules.map(s => s.user_id))];
      const deptIds = [...new Set(pendingSchedules.map(s => s.department_id))];

      const [profilesRes, deptsRes] = await Promise.all([
        supabaseAdmin.from('profiles').select('id, name, whatsapp').in('id', userIds),
        supabaseAdmin.from('departments').select('id, name').in('id', deptIds),
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]));
      const deptMap = new Map((deptsRes.data || []).map(d => [d.id, d]));

      const waRecipients: WhatsAppRecipient[] = [];

      for (const schedule of pendingSchedules) {
        try {
          const dept = deptMap.get(schedule.department_id);
          const profile = profileMap.get(schedule.user_id);
          if (!dept || !profile) continue;

          const sectorName = (schedule as any).sector?.name || null;
          const roleLabel = schedule.assignment_role ? (ROLE_LABELS[schedule.assignment_role] || schedule.assignment_role) : null;
          const dateObj = new Date(schedule.date + 'T12:00:00');
          const weekday = WEEKDAYS_PT[dateObj.getDay()];
          const dayNum = dateObj.getDate();
          const monthShort = MONTHS_SHORT_PT[dateObj.getMonth()];
          const monthFull = MONTHS_PT[dateObj.getMonth()];
          const detailsParts = [sectorName, roleLabel].filter(Boolean).join(' - ');
          const detailsSuffix = detailsParts ? ` | ${detailsParts}` : '';

          const body = `${dept.name}: ${weekday.split('-')[0]}, ${dayNum}/${monthShort} às ${formatTime(schedule.time_start)}${detailsSuffix}`;

          const metadata = {
            user_name: profile.name,
            department_name: dept.name,
            date: schedule.date,
            time_start: schedule.time_start,
            time_end: schedule.time_end,
            sector_name: sectorName,
            role_label: roleLabel,
          };

          await supabaseAdmin
            .from('notifications')
            .insert({
              user_id: schedule.user_id,
              department_id: schedule.department_id,
              schedule_id: schedule.id,
              type: 'schedule_reminder',
              message: body,
              status: 'sent',
              sent_at: new Date().toISOString(),
              metadata,
            } as any);

          await supabaseAdmin.from('schedule_reminders_sent').insert({
            schedule_id: schedule.id,
            reminder_type: window.type,
          });

          if ((profile as any).whatsapp) {
            const sectorSuffix = sectorName ? `\n📍 ${sectorName}` : '';
            const roleSuffix = roleLabel ? `\n💼 ${roleLabel}` : '';
            const seed = `${schedule.id}-${window.type}`;
            const emoji = pickVariant(seed + "e", REMINDER_EMOJIS);
            const greeting = pickVariant(seed + "g", GREETINGS);
            const closing = pickVariant(seed + "c", CLOSINGS);
            const whatsappMsg = `${emoji} *Lembrete — ${dept.name}*\n\n${greeting}, *${profile.name}*!\n\n📆 ${weekday}, ${dayNum} de ${monthFull}\n⏰ ${formatTime(schedule.time_start)} às ${formatTime(schedule.time_end)}${sectorSuffix}${roleSuffix}\n\n${closing}`;

            waRecipients.push({ phone: (profile as any).whatsapp, message: whatsappMsg });
          } else {
            totalSent++;
          }
        } catch (err) {
          console.error(`Error processing schedule ${schedule.id}:`, err);
          totalErrors++;
        }
      }

      if (waRecipients.length > 0) {
        // Shuffle so messages from different departments are interleaved
        for (let i = waRecipients.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [waRecipients[i], waRecipients[j]] = [waRecipients[j], waRecipients[i]];
        }
        const { backgrounded, promise } = scheduleBatch(supabaseUrl, serviceRoleKey, waRecipients);
        if (!backgrounded) {
          const result = await promise;
          totalSent += result.sent;
          totalErrors += result.errors;
        } else {
          totalSent += waRecipients.length; // queued
          console.log(`Queued ${waRecipients.length} reminders in background`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, errors: totalErrors }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

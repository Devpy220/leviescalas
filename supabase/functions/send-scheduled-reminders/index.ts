import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatTime = (time: string): string => time.slice(0, 5);

const WEEKDAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS_SHORT_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const formatShortDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00');
  const weekday = WEEKDAYS_PT[date.getDay()];
  const day = date.getDate();
  const month = MONTHS_SHORT_PT[date.getMonth()];
  return `${weekday}, ${day}/${month}`;
};

const buildDetailsSuffix = (sectorName?: string | null, roleLabel?: string | null): string => {
  const details = [sectorName, roleLabel].filter(Boolean).join(' - ');
  return details ? ` | ${details}` : '';
};

// Map assignment role keys to labels
const ROLE_LABELS: Record<string, string> = {
  on_duty: 'Plantão',
  participant: 'Culto',
};

interface ReminderWindow {
  type: string;
  hoursAhead: number;
  titleFn: (dept: string, time: string, dateSuffix: string) => string;
  bodyFn: (dept: string, time: string, dateSuffix: string) => string;
}

const REMINDER_WINDOWS: ReminderWindow[] = [
  {
    type: '72h',
    hoursAhead: 72,
    titleFn: () => '📅 Escala em 3 dias',
    bodyFn: (dept, time, dateSuffix) => `Escala em 3 dias: ${dateSuffix} às ${time} - ${dept}`,
  },
  {
    type: '48h',
    hoursAhead: 48,
    titleFn: () => '📋 Escala em 2 dias',
    bodyFn: (dept, time, dateSuffix) => `Escala em 2 dias: ${dateSuffix} às ${time} - ${dept}`,
  },
  {
    type: '12h',
    hoursAhead: 12,
    titleFn: () => '⏰ Escala amanhã!',
    bodyFn: (dept, time, dateSuffix) => `Escala amanhã: ${dateSuffix} às ${time} - ${dept}`,
  },
  {
    type: '3h',
    hoursAhead: 3,
    titleFn: () => '🔔 Escala em 3 horas!',
    bodyFn: (dept, time, dateSuffix) => `Em 3 horas: ${dateSuffix} às ${time} - ${dept}`,
  },
];

const WINDOW_MARGIN_MINUTES = 20;

const sendPushNotification = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> => {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ userId, title, body, data })
    });

    if (!response.ok) {
      console.error('Push failed:', await response.text());
      return false;
    }

    const result = await response.json();
    return result.sent > 0;
  } catch (error) {
    console.error('Error sending push:', error);
    return false;
  }
};

const sendTelegramNotification = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  message: string
): Promise<boolean> => {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-telegram-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ userId, message })
    });
    const result = await response.json();
    return result.sent > 0;
  } catch (error) {
    console.error('Error sending telegram:', error);
    return false;
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-scheduled-reminders (multi-interval) called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Use Brazil timezone (America/Sao_Paulo) as the reference for all time calculations
    const BRAZIL_TZ = 'America/Sao_Paulo';
    const now = new Date();
    let totalSent = 0;
    let totalErrors = 0;

    // Helper to get date/time parts in Brazil timezone
    const toBrazilParts = (date: Date) => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: BRAZIL_TZ,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      }).formatToParts(date);
      const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
      return {
        date: `${get('year')}-${get('month')}-${get('day')}`,
        time: `${get('hour')}:${get('minute')}:${get('second')}`,
      };
    };

    for (const window of REMINDER_WINDOWS) {
      const targetTime = new Date(now.getTime() + window.hoursAhead * 60 * 60 * 1000);
      const marginMs = WINDOW_MARGIN_MINUTES * 60 * 1000;
      const windowStart = new Date(targetTime.getTime() - marginMs);
      const windowEnd = new Date(targetTime.getTime() + marginMs);

      // Extract date/time range in Brazil timezone
      const brStart = toBrazilParts(windowStart);
      const brEnd = toBrazilParts(windowEnd);
      const startDate = brStart.date;
      const endDate = brEnd.date;

      // Fetch schedules in this window
      let query = supabaseAdmin
        .from('schedules')
        .select('id, date, time_start, time_end, user_id, department_id, sector_id, assignment_role, sector:sectors(name)')
        .gte('date', startDate)
        .lte('date', endDate);

      const { data: schedules, error: schedulesError } = await query;

      if (schedulesError) {
        console.error(`Error fetching schedules for ${window.type}:`, schedulesError);
        continue;
      }

      if (!schedules || schedules.length === 0) continue;

      // Filter schedules whose actual datetime (in Brazil TZ) falls within our window
      const wStartStr = `${brStart.date}T${brStart.time}`;
      const wEndStr = `${brEnd.date}T${brEnd.time}`;
      const matchingSchedules = schedules.filter(s => {
        const sDateTime = `${s.date}T${s.time_start}`;
        return sDateTime >= wStartStr && sDateTime <= wEndStr;
      });

      if (matchingSchedules.length === 0) continue;

      const scheduleIds = matchingSchedules.map(s => s.id);

      // Check which reminders have already been sent
      const { data: alreadySent } = await supabaseAdmin
        .from('schedule_reminders_sent')
        .select('schedule_id')
        .in('schedule_id', scheduleIds)
        .eq('reminder_type', window.type);

      const alreadySentIds = new Set((alreadySent || []).map(r => r.schedule_id));
      const pendingSchedules = matchingSchedules.filter(s => !alreadySentIds.has(s.id));

      if (pendingSchedules.length === 0) continue;

      console.log(`[${window.type}] Found ${pendingSchedules.length} pending reminders`);

      // Batch fetch all needed profiles and departments
      const userIds = [...new Set(pendingSchedules.map(s => s.user_id))];
      const deptIds = [...new Set(pendingSchedules.map(s => s.department_id))];

      const [profilesRes, deptsRes] = await Promise.all([
        supabaseAdmin.from('profiles').select('id, name, whatsapp').in('id', userIds),
        supabaseAdmin.from('departments').select('id, name').in('id', deptIds),
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]));
      const deptMap = new Map((deptsRes.data || []).map(d => [d.id, d]));

      for (const schedule of pendingSchedules) {
        try {
          const dept = deptMap.get(schedule.department_id);
          const profile = profileMap.get(schedule.user_id);
          if (!dept || !profile) continue;

          const time = formatTime(schedule.time_start);
          const shortDate = formatShortDate(schedule.date);
          const sectorName = (schedule as any).sector?.name || null;
          const roleLabel = schedule.assignment_role ? (ROLE_LABELS[schedule.assignment_role] || schedule.assignment_role) : null;
          const detailsSuffix = buildDetailsSuffix(sectorName, roleLabel);
          const dateSuffix = `${shortDate}${detailsSuffix}`;
          
          const title = window.titleFn(dept.name, time, dateSuffix);
          const body = window.bodyFn(dept.name, time, dateSuffix);

          // Send push + telegram + whatsapp in parallel
          const telegramMsg = `${title}\n${body}`;
          const whatsappMsg = `${title}\n\n${body}`;
          const [pushSent] = await Promise.all([
            sendPushNotification(
              supabaseUrl, serviceRoleKey,
              schedule.user_id, title, body,
              {
                type: 'schedule_reminder',
                reminder_type: window.type,
                department_id: schedule.department_id,
                date: schedule.date,
                url: '/my-schedules'
              }
            ),
            sendTelegramNotification(
              supabaseUrl, serviceRoleKey,
              schedule.user_id, telegramMsg
            ),
            (profile as any).whatsapp
              ? fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${serviceRoleKey}`,
                  },
                  body: JSON.stringify({
                    phone: (profile as any).whatsapp,
                    message: whatsappMsg,
                  }),
                }).then(r => r.json()).then(d => d.sent === true).catch(() => false)
              : Promise.resolve(false),
          ]);

          // Record reminder as sent (even if push failed, to avoid spam)
          await supabaseAdmin
            .from('schedule_reminders_sent')
            .insert({
              schedule_id: schedule.id,
              reminder_type: window.type,
            });

          // Create in-app notification
          await supabaseAdmin
            .from('notifications')
            .insert({
              user_id: schedule.user_id,
              department_id: schedule.department_id,
              schedule_id: schedule.id,
              type: 'schedule_reminder',
              message: body,
              status: pushSent ? 'sent' : 'pending',
              sent_at: new Date().toISOString()
            });

          if (pushSent) totalSent++;
          else totalErrors++;
        } catch (err) {
          console.error(`Error processing schedule ${schedule.id}:`, err);
          totalErrors++;
        }
      }
    }

    console.log(`Done. Sent: ${totalSent}, Errors: ${totalErrors}`);

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, errors: totalErrors }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in send-scheduled-reminders:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

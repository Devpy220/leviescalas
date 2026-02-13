import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatTime = (time: string): string => time.slice(0, 5);

interface ReminderWindow {
  type: string;
  hoursAhead: number;
  titleFn: (dept: string, time: string) => string;
  bodyFn: (dept: string, time: string) => string;
}

const REMINDER_WINDOWS: ReminderWindow[] = [
  {
    type: '72h',
    hoursAhead: 72,
    titleFn: () => '📅 Escala em 3 dias',
    bodyFn: (dept, time) => `Você tem escala em 3 dias em ${dept} às ${time}`,
  },
  {
    type: '48h',
    hoursAhead: 48,
    titleFn: () => '📋 Escala em 2 dias',
    bodyFn: (dept, time) => `Lembrete: escala em 2 dias em ${dept} às ${time}`,
  },
  {
    type: '12h',
    hoursAhead: 12,
    titleFn: () => '⏰ Escala amanhã!',
    bodyFn: (dept, time) => `Sua escala é amanhã! ${dept} às ${time}`,
  },
  {
    type: '3h',
    hoursAhead: 3,
    titleFn: () => '🔔 Escala em 3 horas!',
    bodyFn: (dept, time) => `Em 3 horas: ${dept} às ${time}`,
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

    const now = new Date();
    let totalSent = 0;
    let totalErrors = 0;

    for (const window of REMINDER_WINDOWS) {
      const targetTime = new Date(now.getTime() + window.hoursAhead * 60 * 60 * 1000);
      const marginMs = WINDOW_MARGIN_MINUTES * 60 * 1000;
      const windowStart = new Date(targetTime.getTime() - marginMs);
      const windowEnd = new Date(targetTime.getTime() + marginMs);

      // Extract date range - could span two days
      const startDate = windowStart.toISOString().split('T')[0];
      const endDate = windowEnd.toISOString().split('T')[0];
      const startTimeStr = windowStart.toTimeString().slice(0, 8);
      const endTimeStr = windowEnd.toTimeString().slice(0, 8);

      // Fetch schedules in this window
      // We need to combine date + time_start to check if it falls within our window
      let query = supabaseAdmin
        .from('schedules')
        .select('id, date, time_start, time_end, user_id, department_id')
        .gte('date', startDate)
        .lte('date', endDate);

      const { data: schedules, error: schedulesError } = await query;

      if (schedulesError) {
        console.error(`Error fetching schedules for ${window.type}:`, schedulesError);
        continue;
      }

      if (!schedules || schedules.length === 0) continue;

      // Filter schedules whose actual datetime falls within our window
      const matchingSchedules = schedules.filter(s => {
        const scheduleDateTime = new Date(`${s.date}T${s.time_start}`);
        return scheduleDateTime >= windowStart && scheduleDateTime <= windowEnd;
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
        supabaseAdmin.from('profiles').select('id, name').in('id', userIds),
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
          const title = window.titleFn(dept.name, time);
          const body = window.bodyFn(dept.name, time);

          // Send push + telegram in parallel
          const telegramMsg = `${title}\n${body}`;
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
            )
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

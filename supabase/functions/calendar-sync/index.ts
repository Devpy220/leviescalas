import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeICalText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function formatICalDate(date: string, time: string): string {
  // date: YYYY-MM-DD, time: HH:MM:SS or HH:MM
  const d = date.replace(/-/g, '');
  const t = time.replace(/:/g, '').substring(0, 6).padEnd(6, '0');
  return `${d}T${t}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('Missing token', { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up user by token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('calendar_sync_tokens')
      .select('user_id')
      .eq('token', token)
      .single();

    if (tokenError || !tokenRecord) {
      return new Response('Invalid token', { status: 401, headers: corsHeaders });
    }

    const userId = tokenRecord.user_id;

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single();

    // Get all schedules for this user (future and recent past)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateFilter = threeMonthsAgo.toISOString().split('T')[0];

    const { data: schedules, error: schedulesError } = await supabase
      .from('schedules')
      .select('id, date, time_start, time_end, notes, department_id, departments(name)')
      .eq('user_id', userId)
      .gte('date', dateFilter)
      .order('date', { ascending: true });

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError);
      return new Response('Error fetching schedules', { status: 500, headers: corsHeaders });
    }

    // Build iCal
    const calName = `Escalas - ${profile?.name || 'Levi'}`;
    let ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Levi Escalas//Calendar Sync//PT',
      `X-WR-CALNAME:${escapeICalText(calName)}`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    for (const s of (schedules || [])) {
      const deptName = (s as any).departments?.name || 'Departamento';
      const dtStart = formatICalDate(s.date, s.time_start);
      const dtEnd = formatICalDate(s.date, s.time_end);
      const summary = `Escala: ${deptName}`;
      const description = s.notes ? escapeICalText(s.notes) : '';

      ical.push('BEGIN:VEVENT');
      ical.push(`UID:${s.id}@leviescalas.lovable.app`);
      ical.push(`DTSTART:${dtStart}`);
      ical.push(`DTEND:${dtEnd}`);
      ical.push(`SUMMARY:${escapeICalText(summary)}`);
      if (description) ical.push(`DESCRIPTION:${description}`);
      ical.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
      ical.push('END:VEVENT');
    }

    ical.push('END:VCALENDAR');

    return new Response(ical.join('\r\n'), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="escalas.ics"',
      },
    });
  } catch (error) {
    console.error('Calendar sync error:', error);
    return new Response('Internal error', { status: 500, headers: corsHeaders });
  }
});

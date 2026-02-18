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
      .select('id, date, time_start, time_end, notes, department_id, sector_id, assignment_role, departments(name), sectors(name)')
      .eq('user_id', userId)
      .gte('date', dateFilter)
      .order('date', { ascending: true });

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError);
      return new Response('Error fetching schedules', { status: 500, headers: corsHeaders });
    }

    // Fetch assignment roles for all departments the user has schedules in
    const deptIds = [...new Set((schedules || []).map((s: any) => s.department_id))];
    const { data: assignmentRoles } = deptIds.length > 0
      ? await supabase
          .from('assignment_roles')
          .select('id, name, department_id')
          .in('department_id', deptIds)
      : { data: [] };

    const roleMap = new Map<string, string>();
    for (const r of (assignmentRoles || [])) {
      roleMap.set(r.id, r.name);
    }

    // Build iCal output
    const ical: string[] = [];
    ical.push('BEGIN:VCALENDAR');
    ical.push('VERSION:2.0');
    ical.push('PRODID:-//LeviEscalas//Calendar//PT');
    ical.push('CALSCALE:GREGORIAN');
    ical.push('METHOD:PUBLISH');
    ical.push(`X-WR-CALNAME:Escalas - ${profile?.name || 'Levi'}`);

    // Day names in Portuguese
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    for (const s of (schedules || [])) {
      const deptName = (s as any).departments?.name || 'Departamento';
      const sectorName = (s as any).sectors?.name || null;
      const roleName = s.assignment_role ? (roleMap.get(s.assignment_role) || s.assignment_role) : null;
      
      const dtStart = formatICalDate(s.date, s.time_start);
      const dtEnd = formatICalDate(s.date, s.time_end);

      // Format: "Dia, DD/Mês às HH:mm | Setor - Função" (same as push/telegram)
      const dateObj = new Date(s.date + 'T12:00:00');
      const dayName = dayNames[dateObj.getDay()];
      const day = dateObj.getDate().toString().padStart(2, '0');
      const month = monthNames[dateObj.getMonth()];
      const timeFormatted = s.time_start.substring(0, 5);

      let summary = `📅 ${deptName} | ${dayName}, ${day}/${month} às ${timeFormatted}`;
      const details: string[] = [];
      if (sectorName) details.push(sectorName);
      if (roleName) details.push(roleName);
      if (details.length > 0) {
        summary += ` | ${details.join(' - ')}`;
      }

      const descParts: string[] = [];
      descParts.push(`Departamento: ${deptName}`);
      if (sectorName) descParts.push(`Setor: ${sectorName}`);
      if (roleName) descParts.push(`Função: ${roleName}`);
      descParts.push(`Horário: ${s.time_start.substring(0, 5)} - ${s.time_end.substring(0, 5)}`);
      if (s.notes) descParts.push(`Obs: ${s.notes}`);
      const description = escapeICalText(descParts.join('\\n'));

      ical.push('BEGIN:VEVENT');
      ical.push(`UID:${s.id}@leviescalas.lovable.app`);
      ical.push(`DTSTART:${dtStart}`);
      ical.push(`DTEND:${dtEnd}`);
      ical.push(`SUMMARY:${escapeICalText(summary)}`);
      ical.push(`DESCRIPTION:${description}`);
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

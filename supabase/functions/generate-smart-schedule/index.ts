import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FixedSlot {
  id: string;
  dayOfWeek: number;
  timeStart: string;
  timeEnd: string;
  label: string;
  membersCount: number;
}

interface ScheduleRequest {
  department_id: string;
  start_date: string;
  end_date: string;
  sector_id?: string;
  fixed_slots?: FixedSlot[];
}

interface MemberDateAvailability {
  user_id: string;
  date: string;
}

interface MemberPreference {
  user_id: string;
  max_schedules_per_month: number;
  min_days_between_schedules: number;
  blackout_dates: string[];
}

interface SuggestedSchedule {
  date: string;
  user_id: string;
  name: string;
  time_start: string;
  time_end: string;
  sector_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fixedSlotSchema = z.object({
      id: z.string().max(100),
      dayOfWeek: z.number().int().min(0).max(6),
      timeStart: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
      timeEnd: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
      label: z.string().max(100),
      membersCount: z.number().int().min(1).max(50),
    });

    const scheduleRequestSchema = z.object({
      department_id: z.string().uuid("Invalid department ID"),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
      sector_id: z.string().uuid("Invalid sector ID").optional(),
      fixed_slots: z.array(fixedSlotSchema).max(20).optional().default([]),
      selected_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(100).optional(),
    });

    const rawBody = await req.json();
    const validationResult = scheduleRequestSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      return new Response(JSON.stringify({ 
        error: 'Dados inválidos', 
        details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { department_id, start_date, end_date, sector_id, fixed_slots, selected_dates } = validationResult.data;

    console.log('Generating schedule for period:', start_date, 'to', end_date);
    console.log('Fixed slots config:', JSON.stringify(fixed_slots));

    // Verify user is leader
    const { data: dept } = await supabase
      .from('departments')
      .select('leader_id')
      .eq('id', department_id)
      .single();

    if (!dept || dept.leader_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Apenas líderes podem gerar escalas' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch members
    const { data: members } = await supabase
      .rpc('get_department_member_profiles', { dept_id: department_id });

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum membro encontrado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Exclude blocked volunteers (leader-blocked; only self-unblock via WhatsApp restores)
    const { data: blockedRows } = await supabase
      .from('members')
      .select('user_id')
      .eq('department_id', department_id)
      .eq('is_blocked', true);
    const blockedSet = new Set((blockedRows ?? []).map((r: any) => r.user_id));
    const filteredMembers = blockedSet.size > 0
      ? (members as any[]).filter((m: any) => !blockedSet.has(m.id))
      : (members as any[]);
    if (filteredMembers.length === 0) {
      return new Response(JSON.stringify({ error: 'Todos os voluntários estão bloqueados no momento' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Reassign so downstream logic uses the filtered list
    (members as any).length = 0;
    (members as any).push(...filteredMembers);


    // Fetch date-specific availability (opt-in extras)
    const { data: dateAvailabilities } = await supabase
      .from('member_date_availability')
      .select('user_id, date, is_available')
      .eq('department_id', department_id)
      .gte('date', start_date)
      .lte('date', end_date);

    console.log('Found date availabilities:', dateAvailabilities?.length || 0);

    // Fetch weekly permanent availability (opt-out model: available unless explicitly false)
    const { data: weeklyAvailability } = await supabase
      .from('member_availability')
      .select('user_id, day_of_week, time_start, time_end, is_available')
      .eq('department_id', department_id);

    console.log('Found weekly availability rows:', weeklyAvailability?.length || 0);

    // Fetch preferences
    const { data: preferences } = await supabase
      .from('member_preferences')
      .select('user_id, max_schedules_per_month, min_days_between_schedules, blackout_dates')
      .eq('department_id', department_id);

    // Fetch historical schedules (last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const { data: historicalSchedules } = await supabase
      .from('schedules')
      .select('user_id, date')
      .eq('department_id', department_id)
      .gte('date', threeMonthsAgo.toISOString().split('T')[0]);

    // Fetch cross-department schedules for all members in the requested period
    const memberUserIds = members.map((m: any) => m.id);
    const { data: crossDeptSchedules } = await supabase
      .from('schedules')
      .select('user_id, date, time_start, time_end, department_id')
      .in('user_id', memberUserIds)
      .neq('department_id', department_id)
      .gte('date', start_date)
      .lte('date', end_date);

    console.log('Found cross-department schedules:', crossDeptSchedules?.length || 0);

    // Build context
    const membersList = members.map((m: any) => ({
      user_id: m.id,
      name: m.name
    }));

    const norm = (t?: string) => (t ?? '').slice(0, 5);

    // Build weekly opt-out map: key `${user_id}|${dow}|${HH:mm}|${HH:mm}` => is_available
    const weeklyMap = new Map<string, boolean>();
    (weeklyAvailability || []).forEach((w: any) => {
      const key = `${w.user_id}|${w.day_of_week}|${norm(w.time_start)}|${norm(w.time_end)}`;
      weeklyMap.set(key, w.is_available !== false);
    });

    // Build date-specific overrides
    const dateOverride = new Map<string, boolean>(); // `${user_id}|${date}` => is_available
    (dateAvailabilities || []).forEach((a: any) => {
      dateOverride.set(`${a.user_id}|${a.date}`, a.is_available !== false);
    });

    const preferencesMap: Record<string, MemberPreference> = {};
    (preferences || []).forEach((p: any) => {
      preferencesMap[p.user_id] = {
        user_id: p.user_id,
        max_schedules_per_month: p.max_schedules_per_month,
        min_days_between_schedules: p.min_days_between_schedules,
        blackout_dates: (p.blackout_dates || []).map((d: any) => typeof d === 'string' ? d : new Date(d).toISOString().split('T')[0])
      };
    });

    const scheduleCountByMember: Record<string, number> = {};
    const lastScheduleByMember: Record<string, string> = {};
    (historicalSchedules || []).forEach((s: any) => {
      scheduleCountByMember[s.user_id] = (scheduleCountByMember[s.user_id] || 0) + 1;
      if (!lastScheduleByMember[s.user_id] || s.date > lastScheduleByMember[s.user_id]) {
        lastScheduleByMember[s.user_id] = s.date;
      }
    });

    // Generate dates in range, respecting leader-selected dates if provided
    const selectedDatesSet = selected_dates && selected_dates.length > 0 ? new Set(selected_dates) : null;
    const datesToFill: string[] = [];
    // Iterate by parsing the YYYY-MM-DD strings to avoid timezone issues
    const [sy, sm, sd] = start_date.split('-').map(Number);
    const [ey, em, ed] = end_date.split('-').map(Number);
    const current = new Date(sy, sm - 1, sd);
    const endDateObj = new Date(ey, em - 1, ed);

    while (current <= endDateObj) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const dayOfWeek = current.getDay();

      const matchingSlot = fixed_slots.find(s => s.dayOfWeek === dayOfWeek);
      if (matchingSlot && (!selectedDatesSet || selectedDatesSet.has(dateStr))) {
        datesToFill.push(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }

    // Compute availability per date using weekly opt-out + date overrides + blackout
    // A member is available for a date if:
    //  - NOT in their blackout_dates
    //  - AND for at least one slot matching that day: weekly opt-out is not false (default true)
    //    OR a date-specific override is true
    //  - AND date-specific override is not false
    const availabilityByDate: Record<string, string[]> = {};
    const availabilityByMember: Record<string, string[]> = {};

    for (const date of datesToFill) {
      const dateObj = new Date(date + 'T12:00:00');
      const dow = dateObj.getDay();
      const slotsForDay = fixed_slots.filter(s => s.dayOfWeek === dow);
      availabilityByDate[date] = [];

      for (const m of membersList) {
        const pref = preferencesMap[m.user_id];
        if (pref?.blackout_dates?.includes(date)) continue;

        const override = dateOverride.get(`${m.user_id}|${date}`);
        if (override === false) continue;

        // Available if override true, OR weekly says available for any slot of that day
        const weeklyAvailableForAnySlot = slotsForDay.some(slot => {
          const key = `${m.user_id}|${dow}|${slot.timeStart}|${slot.timeEnd}`;
          const v = weeklyMap.get(key);
          return v === undefined ? true : v; // default available if no record
        });

        if (override === true || weeklyAvailableForAnySlot) {
          availabilityByDate[date].push(m.name);
          if (!availabilityByMember[m.user_id]) availabilityByMember[m.user_id] = [];
          availabilityByMember[m.user_id].push(date);
        }
      }
    }

    const datesWithAvailability = datesToFill.filter(date =>
      (availabilityByDate[date]?.length || 0) > 0
    );

    if (datesWithAvailability.length === 0) {
      return new Response(JSON.stringify({
        error: 'Nenhum membro disponível para os dias selecionados. Verifique as disponibilidades semanais ou selecione outros dias.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build slot configuration description
    const slotConfigDescription = fixed_slots.map(slot => 
      `${slot.label}: ${slot.membersCount} pessoa(s) - horário ${slot.timeStart}-${slot.timeEnd}`
    ).join('\n');

    // Build availability description for AI
    const availabilityDescription = Object.entries(availabilityByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, names]) => {
        const dateObj = new Date(date + 'T12:00:00');
        const dayOfWeek = dateObj.getDay();
        const matchingSlots = fixed_slots.filter(s => s.dayOfWeek === dayOfWeek);
        const slotsInfo = matchingSlots.map(s => `${s.label} (${s.membersCount}p)`).join(', ');
        return `${date} [${slotsInfo}]: ${names.join(', ')}`;
      })
      .join('\n');

    const memberAvailabilityDescription = membersList.map((m: any) => {
      const dates = availabilityByMember[m.user_id] || [];
      return `${m.name}: ${dates.length > 0 ? dates.join(', ') : 'Nenhuma data marcada'}`;
    }).join('\n');

    // Build cross-department conflict description
    const crossDeptDescription = (crossDeptSchedules || []).length > 0
      ? (crossDeptSchedules || []).map((s: any) => {
          const member = membersList.find((m: any) => m.user_id === s.user_id);
          return `${member?.name || s.user_id}: ${s.date} ${s.time_start}-${s.time_end}`;
        }).join('\n')
      : 'Nenhum conflito cross-departamento.';

    // Build prompt for AI
    const prompt = `Você é um assistente de geração de escalas para ministérios de igreja.

MEMBROS DISPONÍVEIS:
${membersList.map((m: any) => `- ${m.name} (ID: ${m.user_id})`).join('\n')}

PERÍODO: ${start_date} a ${end_date}

CONFIGURAÇÃO DOS HORÁRIOS FIXOS (IMPORTANTE - respeitar quantidade por slot):
${slotConfigDescription}

DISPONIBILIDADE POR DATA (apenas datas em que há membros disponíveis):
${availabilityDescription || 'Nenhuma disponibilidade registrada'}

DISPONIBILIDADE POR MEMBRO:
${memberAvailabilityDescription}

PREFERÊNCIAS DOS MEMBROS:
${Object.entries(preferencesMap).length > 0
  ? Object.entries(preferencesMap).map(([userId, pref]) => {
      const member = membersList.find((m: any) => m.user_id === userId);
      const p = pref as MemberPreference;
      return `${member?.name || userId}: máx ${p.max_schedules_per_month} escalas/mês, mín ${p.min_days_between_schedules} dias entre escalas${p.blackout_dates.length > 0 ? `, bloqueado: ${p.blackout_dates.join(', ')}` : ''}`;
    }).join('\n')
  : 'Nenhuma preferência registrada - use padrão de 4 escalas/mês e 3 dias entre escalas.'
}

HISTÓRICO (últimos 3 meses):
${Object.entries(scheduleCountByMember).length > 0
  ? Object.entries(scheduleCountByMember).map(([userId, count]) => {
      const member = membersList.find((m: any) => m.user_id === userId);
      return `${member?.name || userId}: ${count} escalas, última em ${lastScheduleByMember[userId] || 'N/A'}`;
    }).join('\n')
  : 'Nenhum histórico - distribuição livre.'
}

ESCALAS EM OUTROS DEPARTAMENTOS (CONFLITOS - NÃO ESCALAR NESSES HORÁRIOS):
${crossDeptDescription}

REGRAS IMPORTANTES:
1. APENAS escale membros em datas onde eles marcaram disponibilidade
2. RESPEITE A QUANTIDADE DE MEMBROS POR SLOT conforme a configuração acima:
   - Domingo Manhã e Quarta-feira: 3 pessoas cada
   - Domingo Noite: 5 pessoas
3. Para cada data/horário, gere exatamente o número de entradas especificado
4. Distribua as escalas de forma JUSTA e EQUILIBRADA entre todos os membros
5. Evite escalar a mesma pessoa em dias consecutivos
6. Priorize quem tem menos escalas no histórico
7. Respeite o máximo de escalas por mês de cada pessoa
8. NÃO escale ninguém em datas onde não marcaram disponibilidade
9. NÃO escale um membro em data/horário onde ele já está escalado em OUTRO DEPARTAMENTO (veja seção ESCALAS EM OUTROS DEPARTAMENTOS)
10. EXCLUSIVIDADE DOMINGO: Um membro NÃO pode ser escalado nos dois turnos de domingo (Manhã e Noite) no MESMO dia. Se escalou de manhã, NÃO escalar à noite e vice-versa.

IMPORTANTE: Cada entrada no array "schedules" deve representar UMA pessoa para UMA data/horário específico.
Por exemplo, se Domingo Manhã precisa de 3 pessoas, crie 3 entradas separadas com a mesma data e horário.

Retorne APENAS um JSON válido no formato:
{
  "schedules": [
    {"date": "YYYY-MM-DD", "user_id": "uuid", "name": "Nome", "time_start": "HH:MM", "time_end": "HH:MM"}
  ],
  "reasoning": "Breve explicação da lógica usada"
}`;
    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'API key não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Calling Lovable AI with prompt length:', prompt.length);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um assistente especializado em criar escalas justas e equilibradas para ministérios de igreja. Sempre retorne JSON válido.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes. Entre em contato com o suporte.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'Erro ao gerar escalas com IA' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    console.log('AI response received, parsing...');

    // Extract JSON from response
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return new Response(JSON.stringify({ error: 'Erro ao processar resposta da IA', raw: content }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format the suggested schedules
    const rawSchedules: SuggestedSchedule[] = (result.schedules || []).map((s: any) => ({
      date: s.date,
      user_id: s.user_id,
      name: s.name,
      time_start: s.time_start,
      time_end: s.time_end,
      sector_id
    }));

    // ────────────────────────────────────────────────────────────────────────
    // DETERMINISTIC POST-FILTER — não confia no LLM. Remove qualquer entrada
    // que viole disponibilidade semanal, blackout, override de data ou
    // conflito cross-departamento. Antes só validava em prompt.
    // ────────────────────────────────────────────────────────────────────────
    const validUserIds = new Set(membersList.map((m: any) => m.user_id));
    const memberAvailDates = new Map<string, Set<string>>();
    for (const [uid, dates] of Object.entries(availabilityByMember)) {
      memberAvailDates.set(uid, new Set(dates));
    }
    // Index cross-dept conflicts: key = `${user_id}|${date}` -> intervals
    const crossConflicts = new Map<string, Array<{ start: string; end: string }>>();
    for (const s of crossDeptSchedules || []) {
      const k = `${s.user_id}|${s.date}`;
      const arr = crossConflicts.get(k) ?? [];
      arr.push({ start: norm(s.time_start), end: norm(s.time_end) });
      crossConflicts.set(k, arr);
    }

    const rejectedLog: string[] = [];
    const stage1: SuggestedSchedule[] = [];
    for (const sch of rawSchedules) {
      if (!validUserIds.has(sch.user_id)) {
        rejectedLog.push(`${sch.name} ${sch.date}: user_id desconhecido`);
        continue;
      }
      const pref = preferencesMap[sch.user_id];
      if (pref?.blackout_dates?.includes(sch.date)) {
        rejectedLog.push(`${sch.name} ${sch.date}: data bloqueada (blackout)`);
        continue;
      }
      const override = dateOverride.get(`${sch.user_id}|${sch.date}`);
      if (override === false) {
        rejectedLog.push(`${sch.name} ${sch.date}: marcou indisponível neste dia`);
        continue;
      }
      // Must be in availabilityByMember (which already considers weekly opt-out)
      const allowedDates = memberAvailDates.get(sch.user_id);
      if (!allowedDates || !allowedDates.has(sch.date)) {
        rejectedLog.push(`${sch.name} ${sch.date}: fora da disponibilidade semanal`);
        continue;
      }
      // Cross-dept conflict on overlapping interval
      const conflicts = crossConflicts.get(`${sch.user_id}|${sch.date}`) ?? [];
      const ts = norm(sch.time_start);
      const te = norm(sch.time_end);
      const hasConflict = conflicts.some(c => c.start < te && c.end > ts);
      if (hasConflict) {
        rejectedLog.push(`${sch.name} ${sch.date} ${ts}: conflito em outro departamento`);
        continue;
      }
      stage1.push(sch);
    }

    if (rejectedLog.length > 0) {
      console.log(`[smart-schedule] Filtro determinístico removeu ${rejectedLog.length} entrada(s):`);
      rejectedLog.slice(0, 30).forEach(l => console.log(`  - ${l}`));
    }

    // Enforce Sunday exclusivity: a member cannot be scheduled for both morning and night on the same Sunday
    const sundayMorningSlots = fixed_slots.filter(s => s.dayOfWeek === 0 && s.timeStart < '12:00');
    const sundayNightSlots = fixed_slots.filter(s => s.dayOfWeek === 0 && s.timeStart >= '12:00');
    const sundayMorningTimes = new Set(sundayMorningSlots.map(s => s.timeStart));
    const sundayNightTimes = new Set(sundayNightSlots.map(s => s.timeStart));

    const suggestedSchedules: SuggestedSchedule[] = [];
    const sundayAssignments: Record<string, { morning: Set<string>; night: Set<string> }> = {};

    for (const schedule of stage1) {
      const dateObj = new Date(schedule.date + 'T12:00:00');
      const dayOfWeek = dateObj.getDay();

      if (dayOfWeek === 0) {
        if (!sundayAssignments[schedule.date]) {
          sundayAssignments[schedule.date] = { morning: new Set(), night: new Set() };
        }
        const assignment = sundayAssignments[schedule.date];
        const isMorning = sundayMorningTimes.has(schedule.time_start);
        const isNight = sundayNightTimes.has(schedule.time_start);

        if (isMorning && assignment.night.has(schedule.user_id)) {
          console.log(`Sunday exclusivity: removing ${schedule.name} from morning ${schedule.date} (already on night)`);
          continue;
        }
        if (isNight && assignment.morning.has(schedule.user_id)) {
          console.log(`Sunday exclusivity: removing ${schedule.name} from night ${schedule.date} (already on morning)`);
          continue;
        }

        if (isMorning) assignment.morning.add(schedule.user_id);
        if (isNight) assignment.night.add(schedule.user_id);
      }

      suggestedSchedules.push(schedule);
    }

    console.log('Generated', suggestedSchedules.length, 'schedules (raw', rawSchedules.length, ', after filter', stage1.length, ')');

    return new Response(JSON.stringify({
      success: true,
      schedules: suggestedSchedules,
      reasoning: result.reasoning || 'Escalas geradas com base na disponibilidade e histórico dos membros.',
      total: suggestedSchedules.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-smart-schedule:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

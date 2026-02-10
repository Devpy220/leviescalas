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

    const { department_id, start_date, end_date, sector_id, fixed_slots } = validationResult.data;

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

    // Fetch date-specific availability
    const { data: dateAvailabilities } = await supabase
      .from('member_date_availability')
      .select('user_id, date')
      .eq('department_id', department_id)
      .eq('is_available', true)
      .gte('date', start_date)
      .lte('date', end_date);

    console.log('Found date availabilities:', dateAvailabilities?.length || 0);

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

    // Group availability by date
    const availabilityByDate: Record<string, string[]> = {};
    (dateAvailabilities || []).forEach((a: any) => {
      if (!availabilityByDate[a.date]) {
        availabilityByDate[a.date] = [];
      }
      const member = membersList.find((m: any) => m.user_id === a.user_id);
      if (member) {
        availabilityByDate[a.date].push(member.name);
      }
    });

    // Group availability by member
    const availabilityByMember: Record<string, string[]> = {};
    (dateAvailabilities || []).forEach((a: any) => {
      if (!availabilityByMember[a.user_id]) {
        availabilityByMember[a.user_id] = [];
      }
      availabilityByMember[a.user_id].push(a.date);
    });

    const preferencesMap: Record<string, MemberPreference> = {};
    (preferences || []).forEach((p: any) => {
      preferencesMap[p.user_id] = {
        user_id: p.user_id,
        max_schedules_per_month: p.max_schedules_per_month,
        min_days_between_schedules: p.min_days_between_schedules,
        blackout_dates: p.blackout_dates || []
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

    // Generate dates in range
    const datesToFill: string[] = [];
    const current = new Date(start_date);
    const endDateObj = new Date(end_date);
    
    while (current <= endDateObj) {
      const dateStr = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay();
      
      // Only include dates that match fixed slots
      const matchingSlot = fixed_slots.find(s => s.dayOfWeek === dayOfWeek);
      if (matchingSlot) {
        datesToFill.push(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }

    // Filter to only dates where at least one member is available
    const datesWithAvailability = datesToFill.filter(date => 
      (availabilityByDate[date]?.length || 0) > 0
    );

    if (datesWithAvailability.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Nenhum membro marcou disponibilidade para o período selecionado. Peça aos membros que marquem suas disponibilidades no calendário.' 
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
    const suggestedSchedules: SuggestedSchedule[] = (result.schedules || []).map((s: any) => ({
      date: s.date,
      user_id: s.user_id,
      name: s.name,
      time_start: s.time_start,
      time_end: s.time_end,
      sector_id
    }));

    console.log('Generated', suggestedSchedules.length, 'schedules');

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

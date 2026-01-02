import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
}

// Horários fixos padrão
const DEFAULT_FIXED_SLOTS: FixedSlot[] = [
  { id: 'wed-night', dayOfWeek: 3, timeStart: '19:20', timeEnd: '22:00', label: 'Quarta 19:20-22:00' },
  { id: 'sun-morning', dayOfWeek: 0, timeStart: '08:00', timeEnd: '11:30', label: 'Domingo Manhã' },
  { id: 'sun-night', dayOfWeek: 0, timeStart: '18:00', timeEnd: '22:00', label: 'Domingo Noite' },
];

interface ScheduleRequest {
  department_id: string;
  start_date: string;
  end_date: string;
  members_per_day: number;
  sector_id?: string;
  fixed_slots?: FixedSlot[];
}

interface MemberAvailability {
  user_id: string;
  name: string;
  day_of_week: number;
  time_start: string;
  time_end: string;
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
  slot_label?: string;
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

    const body: ScheduleRequest = await req.json();
    const { department_id, start_date, end_date, members_per_day, sector_id, fixed_slots } = body;

    const SLOTS = fixed_slots || DEFAULT_FIXED_SLOTS;

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

    // Fetch availability
    const { data: availabilities } = await supabase
      .from('member_availability')
      .select('user_id, day_of_week, time_start, time_end, is_available')
      .eq('department_id', department_id)
      .eq('is_available', true);

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

    // Build context
    const membersList = members.map((m: any) => ({
      user_id: m.id,
      name: m.name
    }));

    const availabilityMap: Record<string, MemberAvailability[]> = {};
    (availabilities || []).forEach((a: any) => {
      const member = membersList.find((m: any) => m.user_id === a.user_id);
      if (member) {
        if (!availabilityMap[a.user_id]) {
          availabilityMap[a.user_id] = [];
        }
        availabilityMap[a.user_id].push({
          user_id: a.user_id,
          name: member.name,
          day_of_week: a.day_of_week,
          time_start: a.time_start.slice(0, 5),
          time_end: a.time_end.slice(0, 5)
        });
      }
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

    // Generate dates and slots in range (only days that match fixed slots)
    const slotsToFill: { date: string; slot: FixedSlot }[] = [];
    const current = new Date(start_date);
    const endDateObj = new Date(end_date);
    
    while (current <= endDateObj) {
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().split('T')[0];
      
      // Find matching fixed slots for this day
      const matchingSlots = SLOTS.filter(s => s.dayOfWeek === dayOfWeek);
      matchingSlots.forEach(slot => {
        slotsToFill.push({ date: dateStr, slot });
      });
      
      current.setDate(current.getDate() + 1);
    }

    if (slotsToFill.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum dia válido encontrado no período selecionado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build slot descriptions
    const slotDescriptions = slotsToFill.map(s => 
      `${s.date} (${s.slot.label}) - ${s.slot.timeStart} às ${s.slot.timeEnd}`
    ).join('\n');

    // Build prompt for AI
    const prompt = `Você é um assistente de geração de escalas para ministérios de igreja.

MEMBROS DISPONÍVEIS:
${membersList.map((m: any) => `- ${m.name} (ID: ${m.user_id})`).join('\n')}

HORÁRIOS FIXOS A PREENCHER:
${slotDescriptions}

DISPONIBILIDADE DOS MEMBROS (dia 0=domingo, 3=quarta):
${Object.entries(availabilityMap).length > 0 
  ? Object.entries(availabilityMap).map(([userId, avails]) => {
      const member = membersList.find((m: any) => m.user_id === userId);
      return `${member?.name || userId}: ${(avails as MemberAvailability[]).map(a => `dia ${a.day_of_week} (${a.time_start}-${a.time_end})`).join(', ')}`;
    }).join('\n')
  : 'Nenhuma disponibilidade registrada - considere todos os membros disponíveis para todos os horários.'
}

PREFERÊNCIAS:
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

REQUISITOS:
- Membros por horário: ${members_per_day}
- Total de slots a preencher: ${slotsToFill.length}

REGRAS IMPORTANTES:
1. Para cada horário, escale ${members_per_day} membros que tenham disponibilidade para aquele dia/horário
2. Distribua as escalas de forma JUSTA e EQUILIBRADA entre todos os membros
3. Evite escalar a mesma pessoa no mesmo dia para múltiplos horários (se possível)
4. Evite escalar a mesma pessoa em dias consecutivos
5. Respeite as disponibilidades informadas (se membro não tem disponibilidade para domingo, não escale no domingo)
6. Priorize quem tem menos escalas no histórico
7. Respeite o máximo de escalas por mês de cada pessoa

IMPORTANTE: Cada entrada no array "schedules" deve representar UMA pessoa para UM horário específico.
Se um horário precisa de 2 pessoas, crie 2 entradas separadas com o mesmo date/time_start/time_end.

Retorne APENAS um JSON válido no formato:
{
  "schedules": [
    {"date": "YYYY-MM-DD", "user_id": "uuid", "name": "Nome", "time_start": "HH:MM", "time_end": "HH:MM", "slot_label": "Label do horário"}
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
      time_start: s.time_start || '19:00',
      time_end: s.time_end || '22:00',
      sector_id,
      slot_label: s.slot_label
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

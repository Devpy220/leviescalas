import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduleRequest {
  department_id: string;
  start_date: string;
  end_date: string;
  members_per_day: number;
  sector_id?: string;
  time_start?: string;
  time_end?: string;
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

    const body: ScheduleRequest = await req.json();
    const { 
      department_id, 
      start_date, 
      end_date, 
      members_per_day, 
      sector_id,
      time_start = '19:00',
      time_end = '22:00'
    } = body;

    console.log('Generating schedule for period:', start_date, 'to', end_date);

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
      datesToFill.push(dateStr);
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

    // Build availability description for AI
    const availabilityDescription = Object.entries(availabilityByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, names]) => `${date}: ${names.join(', ')}`)
      .join('\n');

    const memberAvailabilityDescription = membersList.map((m: any) => {
      const dates = availabilityByMember[m.user_id] || [];
      return `${m.name}: ${dates.length > 0 ? dates.join(', ') : 'Nenhuma data marcada'}`;
    }).join('\n');

    // Build prompt for AI
    const prompt = `Você é um assistente de geração de escalas para ministérios de igreja.

MEMBROS DISPONÍVEIS:
${membersList.map((m: any) => `- ${m.name} (ID: ${m.user_id})`).join('\n')}

PERÍODO: ${start_date} a ${end_date}
HORÁRIO PADRÃO: ${time_start} às ${time_end}

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

REQUISITOS:
- Membros por data: ${members_per_day}
- Datas com disponibilidade: ${datesWithAvailability.length}

REGRAS IMPORTANTES:
1. APENAS escale membros em datas onde eles marcaram disponibilidade
2. Para cada data, escale até ${members_per_day} membros que tenham marcado disponibilidade naquela data
3. Distribua as escalas de forma JUSTA e EQUILIBRADA entre todos os membros
4. Evite escalar a mesma pessoa em dias consecutivos
5. Priorize quem tem menos escalas no histórico
6. Respeite o máximo de escalas por mês de cada pessoa
7. NÃO escale ninguém em datas onde não marcaram disponibilidade

IMPORTANTE: Cada entrada no array "schedules" deve representar UMA pessoa para UMA data específica.
Se uma data precisa de 2 pessoas, crie 2 entradas separadas com a mesma data.

Retorne APENAS um JSON válido no formato:
{
  "schedules": [
    {"date": "YYYY-MM-DD", "user_id": "uuid", "name": "Nome", "time_start": "${time_start}", "time_end": "${time_end}"}
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
      time_start: s.time_start || time_start,
      time_end: s.time_end || time_end,
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

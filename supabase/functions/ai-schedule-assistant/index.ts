import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  department_id: string;
  intent: 'chat' | 'generate';
  messages: ChatMessage[];
  start_date?: string; // YYYY-MM-DD
  end_date?: string;
  slots?: Array<{
    dayOfWeek: number;
    timeStart: string;
    timeEnd: string;
    label: string;
    membersCount: number;
  }>;
  member_ids_filter?: string[];
  explicit_dates?: string[]; // YYYY-MM-DD list to restrict generation
}

const norm = (t?: string) => (t ?? '').slice(0, 5);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json() as RequestBody;
    const { department_id, intent, messages } = body;

    if (!department_id || !intent || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Dados inválidos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify leader
    const { data: dept } = await supabase
      .from('departments').select('leader_id, name').eq('id', department_id).single();
    if (!dept || dept.leader_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Apenas líderes podem usar o assistente' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'API key não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Helper: today in São Paulo TZ
    const todayBR = () => {
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
      });
      return fmt.format(new Date()); // YYYY-MM-DD
    };

    // ============ CHAT MODE ============
    if (intent === 'chat') {
      const today = todayBR();
      const systemPrompt = `Você é um assistente especialista em montar escalas de voluntários para igrejas (departamento: ${dept.name}).

Hoje é ${today} (fuso America/Sao_Paulo). Sempre interprete datas relativas ("amanhã", "essa sexta", "próximo domingo", "esta semana", "próximo mês") a partir desta data.

Seu papel: extrair do líder as condições da escala que ele quer gerar. Confirme:
1. **PERÍODO EXATO**: data única, intervalo de datas, semana ou mês — sempre repita as datas resolvidas ("entendi: domingo 22/06 a 28/06").
2. Quantas pessoas por slot (se diferente do padrão).
3. Regras especiais (evitar pares, priorizar quem está pouco escalado, etc).

IMPORTANTE:
- NÃO pergunte sobre bloqueios diários, disponibilidade semanal ou conflitos — o sistema respeita isso automaticamente.
- Se o líder pedir um dia específico, NÃO assuma o mês inteiro — confirme o dia exato.
- Quando tiver tudo, diga: "Posso gerar a escala agora? Clique em **Gerar escala**." e pare.

Seja conciso, amigável, português brasileiro, markdown leve.`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
        }),
      });

      if (!aiResponse.ok) {
        const txt = await aiResponse.text();
        console.error('AI chat error:', aiResponse.status, txt);
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: 'Muitas requisições. Aguarde alguns instantes.' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: 'Créditos da IA esgotados.' }), {
            status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: 'Erro ao conversar com IA' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await aiResponse.json();
      const reply = data.choices?.[0]?.message?.content || '';
      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ GENERATE MODE ============
    let { start_date, end_date, slots } = body;
    if (!slots || slots.length === 0) {
      return new Response(JSON.stringify({ error: 'Horários (slots) são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try to extract date range from conversation; fall back to provided defaults
    const today = todayBR();
    try {
      const userTurns = messages.filter(m => m.role === 'user').map(m => m.content).join('\n');
      if (userTurns.trim().length > 0) {
        const extractRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `Hoje é ${today} (America/Sao_Paulo). Extraia o intervalo de datas pedido pelo líder. Se ele pediu um único dia, start_date == end_date. Se pediu uma semana, retorne os 7 dias correspondentes. Se pediu o "mês" sem especificar, retorne o mês inteiro. Se NÃO há data explícita ou inferível, retorne null para ambos. Período padrão entre ${start_date || 'null'} e ${end_date || 'null'}.\nResponda APENAS JSON: {"start_date":"YYYY-MM-DD"|null,"end_date":"YYYY-MM-DD"|null}`,
              },
              { role: 'user', content: userTurns },
            ],
            response_format: { type: 'json_object' },
          }),
        });
        if (extractRes.ok) {
          const ed = await extractRes.json();
          const raw = ed.choices?.[0]?.message?.content || '{}';
          const m = raw.match(/\{[\s\S]*\}/);
          const parsed = m ? JSON.parse(m[0]) : {};
          if (parsed.start_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.start_date)) {
            start_date = parsed.start_date;
          }
          if (parsed.end_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.end_date)) {
            end_date = parsed.end_date;
          }
          if (start_date && !end_date) end_date = start_date;
          if (end_date && !start_date) start_date = end_date;
        }
      }
    } catch (e) {
      console.warn('Date extraction failed, using defaults:', e);
    }

    if (!start_date || !end_date) {
      return new Response(JSON.stringify({ error: 'Período não identificado. Diga as datas no chat ou escolha um mês.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (start_date > end_date) {
      const tmp = start_date; start_date = end_date; end_date = tmp;
    }

    // Fetch members
    const { data: members } = await supabase
      .rpc('get_department_member_profiles', { dept_id: department_id });
    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum membro no departamento' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const membersList = members.map((m: any) => ({ user_id: m.id, name: m.name }));
    const memberIds = membersList.map(m => m.user_id);

    // Fetch availability data
    const { data: weeklyAvail } = await supabase
      .from('member_availability')
      .select('user_id, day_of_week, time_start, time_end, is_available')
      .eq('department_id', department_id);

    const { data: dateAvail } = await supabase
      .from('member_date_availability')
      .select('user_id, date, is_available')
      .eq('department_id', department_id)
      .gte('date', start_date).lte('date', end_date);

    const { data: prefs } = await supabase
      .from('member_preferences')
      .select('user_id, max_schedules_per_month, blackout_dates')
      .eq('department_id', department_id);

    // Cross-department conflicts in the same period
    const { data: crossDept } = await supabase
      .from('schedules')
      .select('user_id, date, time_start, time_end')
      .in('user_id', memberIds)
      .neq('department_id', department_id)
      .gte('date', start_date).lte('date', end_date);

    // Existing schedules in this department (for sunday exclusivity + slot already filled)
    const { data: existingHere } = await supabase
      .from('schedules')
      .select('user_id, date, time_start, time_end')
      .eq('department_id', department_id)
      .gte('date', start_date).lte('date', end_date);

    // Department allow_sunday_double
    const { data: deptCfg } = await supabase
      .from('departments').select('allow_sunday_double').eq('id', department_id).single();
    const allowSundayDouble = deptCfg?.allow_sunday_double === true;

    // Historic count last 60d for balancing
    const sixtyAgo = new Date();
    sixtyAgo.setDate(sixtyAgo.getDate() - 60);
    const { data: historic } = await supabase
      .from('schedules').select('user_id')
      .eq('department_id', department_id)
      .gte('date', sixtyAgo.toISOString().split('T')[0]);
    const countByMember: Record<string, number> = {};
    (historic || []).forEach((s: any) => {
      countByMember[s.user_id] = (countByMember[s.user_id] || 0) + 1;
    });

    // Build lookup maps
    const weeklyMap = new Map<string, boolean>();
    (weeklyAvail || []).forEach((w: any) => {
      const key = `${w.user_id}|${w.day_of_week}|${norm(w.time_start)}|${norm(w.time_end)}`;
      weeklyMap.set(key, w.is_available !== false);
    });
    const dateOverride = new Map<string, boolean>();
    (dateAvail || []).forEach((a: any) => {
      dateOverride.set(`${a.user_id}|${a.date}`, a.is_available !== false);
    });
    const blackoutByUser: Record<string, Set<string>> = {};
    const maxByUser: Record<string, number> = {};
    (prefs || []).forEach((p: any) => {
      const dates = (p.blackout_dates || []).map((d: any) =>
        typeof d === 'string' ? d : new Date(d).toISOString().split('T')[0]
      );
      blackoutByUser[p.user_id] = new Set(dates);
      maxByUser[p.user_id] = p.max_schedules_per_month || 99;
    });

    // Enumerate target slots (date + slot)
    const [sy, sm, sd] = start_date.split('-').map(Number);
    const [ey, em, ed] = end_date.split('-').map(Number);
    const current = new Date(sy, sm - 1, sd);
    const endObj = new Date(ey, em - 1, ed);
    const targetSlots: Array<{
      date: string; dow: number; label: string;
      timeStart: string; timeEnd: string; membersCount: number;
      eligible: Array<{ user_id: string; name: string; recent_count: number }>;
    }> = [];

    while (current <= endObj) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const dow = current.getDay();

      for (const slot of slots.filter(s => s.dayOfWeek === dow)) {
        const eligible: Array<{ user_id: string; name: string; recent_count: number }> = [];
        for (const m of membersList) {
          // blackout
          if (blackoutByUser[m.user_id]?.has(dateStr)) continue;
          // date override
          const override = dateOverride.get(`${m.user_id}|${dateStr}`);
          if (override === false) continue;
          // weekly availability for this exact slot
          const wk = weeklyMap.get(`${m.user_id}|${dow}|${slot.timeStart}|${slot.timeEnd}`);
          const weeklyAvailable = wk === undefined ? true : wk;
          if (override !== true && !weeklyAvailable) continue;
          // cross-department conflict
          const hasCrossConflict = (crossDept || []).some((s: any) =>
            s.user_id === m.user_id && s.date === dateStr &&
            norm(s.time_start) < slot.timeEnd && norm(s.time_end) > slot.timeStart
          );
          if (hasCrossConflict) continue;
          // already scheduled in this exact slot
          const alreadyHere = (existingHere || []).some((s: any) =>
            s.user_id === m.user_id && s.date === dateStr &&
            norm(s.time_start) === slot.timeStart && norm(s.time_end) === slot.timeEnd
          );
          if (alreadyHere) continue;
          // sunday exclusivity
          if (dow === 0 && !allowSundayDouble) {
            const otherShift = (existingHere || []).some((s: any) => {
              if (s.user_id !== m.user_id || s.date !== dateStr) return false;
              const ts = norm(s.time_start);
              const isOther = slot.timeStart < '13:00' ? ts >= '13:00' : ts < '13:00';
              return isOther;
            });
            if (otherShift) continue;
          }

          eligible.push({
            user_id: m.user_id,
            name: m.name,
            recent_count: countByMember[m.user_id] || 0,
          });
        }
        targetSlots.push({
          date: dateStr, dow, label: slot.label,
          timeStart: slot.timeStart, timeEnd: slot.timeEnd,
          membersCount: slot.membersCount, eligible,
        });
      }
      current.setDate(current.getDate() + 1);
    }

    if (targetSlots.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum slot encontrado no período/configuração.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build compact context for AI
    const conversationContext = messages
      .filter(m => m.role !== 'system')
      .map(m => `${m.role === 'user' ? 'LÍDER' : 'IA'}: ${m.content}`)
      .join('\n');

    const slotsContext = targetSlots.map((s, idx) => {
      const elig = s.eligible
        .sort((a, b) => a.recent_count - b.recent_count)
        .map(e => `${e.name}[${e.user_id}](${e.recent_count}esc)`)
        .join(', ');
      return `#${idx} ${s.date} ${s.label} ${s.timeStart}-${s.timeEnd} (${s.membersCount}p) elegíveis: ${elig || 'NENHUM'}`;
    }).join('\n');

    const maxLimits = Object.entries(maxByUser)
      .map(([uid, max]) => {
        const name = membersList.find(m => m.user_id === uid)?.name;
        return name ? `${name}: máx ${max}/mês` : null;
      })
      .filter(Boolean).join('; ');

    const generatePrompt = `Você é um assistente que distribui voluntários em escalas de igreja.

CONVERSA COM O LÍDER (suas condições):
${conversationContext}

SLOTS A PREENCHER (cada um lista APENAS os membros elegíveis - você SÓ pode escolher dentre esses):
${slotsContext}

LIMITES (use como diretriz):
${maxLimits || 'sem limites específicos'}

REGRAS RÍGIDAS:
1. Para cada slot, escolha exatamente "membersCount" pessoas DA LISTA DE ELEGÍVEIS daquele slot.
2. Se não houver elegíveis suficientes, escolha quantas houver (não invente IDs).
3. NUNCA use um user_id que não esteja na lista de elegíveis do slot.
4. Distribua de forma JUSTA: prefira membros com menor número de escalas recentes (recent_count menor).
5. Evite a mesma pessoa em dias consecutivos quando possível.
6. Respeite as condições do líder na conversa.

Retorne APENAS JSON válido neste formato exato:
{
  "assignments": [
    { "slot_index": 0, "user_ids": ["uuid1", "uuid2"] }
  ],
  "reasoning": "breve explicação"
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você gera escalas como JSON válido, sempre respeitando as listas de elegíveis.' },
          { role: 'user', content: generatePrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResponse.ok) {
      const txt = await aiResponse.text();
      console.error('AI generate error:', aiResponse.status, txt);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Muitas requisições. Aguarde alguns instantes.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos da IA esgotados.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Erro ao gerar escala' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '{}';
    let parsed: { assignments: Array<{ slot_index: number; user_ids: string[] }>; reasoning?: string };
    try {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI JSON:', content);
      return new Response(JSON.stringify({ error: 'Resposta da IA inválida' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate AI choices against eligible lists
    const schedules: Array<{
      date: string; user_id: string; name: string;
      time_start: string; time_end: string; slotLabel: string;
    }> = [];

    for (const a of parsed.assignments || []) {
      const slot = targetSlots[a.slot_index];
      if (!slot) continue;
      const eligibleIds = new Set(slot.eligible.map(e => e.user_id));
      const used = new Set<string>();
      for (const uid of a.user_ids || []) {
        if (!eligibleIds.has(uid)) {
          console.warn(`AI tried to use ineligible user ${uid} for slot ${a.slot_index}`);
          continue;
        }
        if (used.has(uid)) continue;
        used.add(uid);
        const name = membersList.find(m => m.user_id === uid)?.name || '';
        schedules.push({
          date: slot.date, user_id: uid, name,
          time_start: slot.timeStart, time_end: slot.timeEnd,
          slotLabel: slot.label,
        });
        if (used.size >= slot.membersCount) break;
      }
    }

    return new Response(JSON.stringify({
      schedules,
      reasoning: parsed.reasoning || '',
      resolved_start_date: start_date,
      resolved_end_date: end_date,
      stats: {
        total_slots: targetSlots.length,
        slots_with_zero_eligible: targetSlots.filter(s => s.eligible.length === 0).length,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Unhandled error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

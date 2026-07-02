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
const isYmd = (value?: string | null) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
const parseYmdUtc = (value: string) => {
  if (!isYmd(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null;
  return parsed;
};
const ymdFromUtc = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
      const selectedDates = (body.explicit_dates || [])
        .filter((date) => parseYmdUtc(date))
        .sort();
      const selectedDatesText = selectedDates.length > 0
        ? `\n\nDatas já selecionadas no calendário: ${selectedDates.join(', ')}. Se houver datas selecionadas, trate estas datas como prioridade absoluta e não substitua por mês inteiro ou outro período.`
        : '';
      const systemPrompt = `Você é o LEVI, assistente de escalas para o departamento "${dept.name}".

Hoje é ${today} (America/Sao_Paulo). Interprete datas relativas ("amanhã", "essa sexta", "próximo domingo", "esta semana", "próximo mês") a partir de hoje.

REGRAS OBRIGATÓRIAS:
1. **DATA EXATA — NUNCA EXPANDA**: se o líder disser "dia 15", escale APENAS 15. Se disser "sexta", escale APENAS aquela sexta. NUNCA transforme um dia em semana ou mês.
2. **CONFIRME antes de gerar**: sempre repita as datas resolvidas em formato explícito ("Entendi: apenas terça-feira 15/07/2026"). Só peça para gerar após o líder confirmar.
3. Se o pedido for ambíguo (ex: "faz uma escala"), PERGUNTE quais datas — nunca assuma o mês inteiro.
4. NÃO pergunte sobre bloqueios, disponibilidade ou conflitos — o sistema respeita tudo automaticamente após a geração.
5. Quando o líder confirmar as datas, responda apenas: "Perfeito! Clique em **Gerar escala** para eu montar." e pare.

Seja conciso, português brasileiro, markdown leve.${selectedDatesText}`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-pro',
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
    const { member_ids_filter, explicit_dates } = body;
    if (!slots || slots.length === 0) {
      return new Response(JSON.stringify({ error: 'Horários (slots) são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If explicit dates provided, override range with min/max of the list
    const explicitDateSet = new Set<string>();
    if (explicit_dates && explicit_dates.length > 0) {
      explicit_dates.forEach(d => { if (parseYmdUtc(d)) explicitDateSet.add(d); });
      const sorted = [...explicitDateSet].sort();
      if (sorted.length > 0) {
        start_date = sorted[0];
        end_date = sorted[sorted.length - 1];
      }
    }

    // Try to extract EXACT dates from conversation. Prefer a list of specific
    // dates over a range so "dia 15" never turns into "mês inteiro".
    // Skipped when líder picked explicit dates in the UI.
    const today = todayBR();
    try {
      if (explicitDateSet.size > 0) throw new Error('skip: explicit dates');
      const userTurns = messages.filter(m => m.role === 'user').map(m => m.content).join('\n');
      if (userTurns.trim().length > 0) {
        const extractRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-pro',
            messages: [
              {
                role: 'system',
                content: `Hoje é ${today} (America/Sao_Paulo). Sua tarefa: extrair EXATAMENTE as datas que o líder pediu.

REGRAS ESTRITAS:
- Se o líder citou dias específicos ("dia 15", "próxima sexta", "domingo 22"), retorne APENAS essas datas em "dates" (lista de YYYY-MM-DD). NUNCA expanda para semana/mês.
- Se ele pediu explicitamente "a semana inteira" ou "essa semana", retorne os 7 dias correspondentes em "dates".
- Se ele pediu explicitamente "o mês inteiro" (com essa palavra), retorne start_date e end_date do mês.
- Se NÃO houver referência clara de datas, retorne "dates": [] e ambos start/end como null.
- NUNCA retorne o mês inteiro só porque não tem certeza. Prefira lista vazia.

Responda APENAS JSON: {"dates": ["YYYY-MM-DD", ...], "start_date": "YYYY-MM-DD"|null, "end_date": "YYYY-MM-DD"|null}`,
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
          const extractedDates: string[] = Array.isArray(parsed.dates)
            ? parsed.dates.filter((d: any) => typeof d === 'string' && parseYmdUtc(d))
            : [];
          if (extractedDates.length > 0) {
            // Prefer explicit dates over range
            extractedDates.forEach((d) => explicitDateSet.add(d));
            const sorted = [...explicitDateSet].sort();
            start_date = sorted[0];
            end_date = sorted[sorted.length - 1];
            console.log('AI extracted explicit dates:', sorted);
          } else {
            if (parseYmdUtc(parsed.start_date)) start_date = parsed.start_date;
            if (parseYmdUtc(parsed.end_date)) end_date = parsed.end_date;
            if (start_date && !end_date) end_date = start_date;
            if (end_date && !start_date) start_date = end_date;
          }
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
    if (!parseYmdUtc(start_date) || !parseYmdUtc(end_date)) {
      return new Response(JSON.stringify({ error: 'Formato de data inválido. Use datas no calendário ou informe dia/mês/ano.' }), {
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
    let membersList = members.map((m: any) => ({ user_id: m.id, name: m.name }));
    if (member_ids_filter && member_ids_filter.length > 0) {
      const allowed = new Set(member_ids_filter);
      membersList = membersList.filter(m => allowed.has(m.user_id));
      if (membersList.length === 0) {
        return new Response(JSON.stringify({ error: 'Nenhum voluntário selecionado é membro do departamento' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    const memberIds = membersList.map(m => m.user_id);

    // ============ EXTRACT PER-MEMBER RESTRICTIONS FROM CHAT ============
    // The chat may say "Jomar não pode", "Sergio só domingo", "Lucas nunca quarta".
    // These are NOT in the DB — we must parse them and enforce as filters.
    const shiftKey = (dow: number, timeStart: string) => {
      const t = timeStart;
      const period = t < '12:00' ? 'morning' : t >= '18:00' ? 'night' : 'afternoon';
      return `${dow}-${period}`;
    };
    const bannedUsers = new Set<string>();
    const allowedDowsByUser = new Map<string, Set<number>>();
    const allowedShiftsByUser = new Map<string, Set<string>>();
    try {
      const userTurns = messages.filter(m => m.role === 'user').map(m => m.content).join('\n');
      if (userTurns.trim().length > 20) {
        const namesList = membersList.map(m => `- ${m.name} (id: ${m.user_id})`).join('\n');
        const restrRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-pro',
            messages: [
              {
                role: 'system',
                content: `Você extrai restrições de voluntários do texto do líder.

MEMBROS DO DEPARTAMENTO:
${namesList}

Extraia:
- "banned": lista de user_id de pessoas que NÃO podem ser escaladas em nenhum dia (ex: "Jomar não pode", "indisponíveis: X, Y").
- "allowed_dows": objeto {user_id: [0-6]} para quem só pode em determinados dias da semana (0=domingo, 3=quarta, etc). Ex: "Sergio só domingos" -> {sergio_id: [0]}. "Lucas quarta e domingo à noite" -> {lucas_id: [0,3]}.
- "allowed_shifts": objeto {user_id: ["dow-period"]} onde period ∈ {"morning","afternoon","night"}. Use quando o líder restringe TURNO específico (ex: "Douglas só domingo à noite" -> {douglas_id: ["0-night"]}. "Henrique só domingo à noite" -> {henrique_id: ["0-night"]}).

REGRAS:
- Faça match FUZZY de nome (primeiro nome, apelidos comuns). Ignore quem não bate.
- Se o líder disser "só pode X" e "só pode Y" para a mesma pessoa, combine ambos.
- Se nada for dito sobre uma pessoa, NÃO inclua na resposta.
- Se allowed_shifts tiver entrada para um user, allowed_dows para ele é redundante (não inclua).
- Retorne APENAS JSON: {"banned":["id"],"allowed_dows":{"id":[0,3]},"allowed_shifts":{"id":["0-night"]}}`,
              },
              { role: 'user', content: userTurns },
            ],
            response_format: { type: 'json_object' },
          }),
        });
        if (restrRes.ok) {
          const rd = await restrRes.json();
          const raw = rd.choices?.[0]?.message?.content || '{}';
          const m = raw.match(/\{[\s\S]*\}/);
          const p = m ? JSON.parse(m[0]) : {};
          const validIds = new Set(memberIds);
          (Array.isArray(p.banned) ? p.banned : []).forEach((id: any) => {
            if (typeof id === 'string' && validIds.has(id)) bannedUsers.add(id);
          });
          if (p.allowed_dows && typeof p.allowed_dows === 'object') {
            for (const [id, dows] of Object.entries(p.allowed_dows)) {
              if (!validIds.has(id) || !Array.isArray(dows)) continue;
              const s = new Set<number>();
              (dows as any[]).forEach((d) => { const n = Number(d); if (n >= 0 && n <= 6) s.add(n); });
              if (s.size > 0) allowedDowsByUser.set(id, s);
            }
          }
          if (p.allowed_shifts && typeof p.allowed_shifts === 'object') {
            for (const [id, sh] of Object.entries(p.allowed_shifts)) {
              if (!validIds.has(id) || !Array.isArray(sh)) continue;
              const s = new Set<string>();
              (sh as any[]).forEach((x) => { if (typeof x === 'string' && /^[0-6]-(morning|afternoon|night)$/.test(x)) s.add(x); });
              if (s.size > 0) allowedShiftsByUser.set(id, s);
            }
          }
          console.log('Extracted restrictions:', {
            banned: [...bannedUsers],
            allowed_dows: [...allowedDowsByUser.entries()].map(([k,v])=>[k,[...v]]),
            allowed_shifts: [...allowedShiftsByUser.entries()].map(([k,v])=>[k,[...v]]),
          });
        }
      }
    } catch (e) {
      console.warn('Restriction extraction failed:', e);
    }

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
    const current = parseYmdUtc(start_date)!;
    const endObj = parseYmdUtc(end_date)!;
    const targetSlots: Array<{
      date: string; dow: number; label: string;
      timeStart: string; timeEnd: string; membersCount: number;
      eligible: Array<{ user_id: string; name: string; recent_count: number }>;
    }> = [];

    while (current <= endObj) {
      const dateStr = ymdFromUtc(current);
      const dow = current.getUTCDay();

      if (explicitDateSet.size > 0 && !explicitDateSet.has(dateStr)) {
        current.setUTCDate(current.getUTCDate() + 1);
        continue;
      }


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
      current.setUTCDate(current.getUTCDate() + 1);
    }

    if (targetSlots.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum slot encontrado no período/configuração.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ DETERMINISTIC ASSIGNMENT ============
    // Pure logic — avoids AI hallucinations and guarantees membersCount when
    // enough eligibles exist. Round-robin by lowest (recent_count + assignedInRun).
    const schedules: Array<{
      date: string; user_id: string; name: string;
      time_start: string; time_end: string; slotLabel: string;
    }> = [];

    const assignedInRun: Record<string, number> = {};
    const assignedDates: Record<string, Set<string>> = {}; // user -> set of dates already taken in run

    // Sort slots chronologically for fair distribution
    const orderedSlots = [...targetSlots].sort((a, b) =>
      a.date === b.date ? a.timeStart.localeCompare(b.timeStart) : a.date.localeCompare(b.date)
    );

    for (const slot of orderedSlots) {
      const need = slot.membersCount;
      // Filter eligibles: exclude anyone already scheduled in this run for this date+time
      const pool = slot.eligible.filter(e => {
        const taken = assignedDates[e.user_id];
        if (!taken) return true;
        // already scheduled at this exact slot in this run?
        return !taken.has(`${slot.date}|${slot.timeStart}|${slot.timeEnd}`);
      });

      // Sort: least recent + least assigned in this run first
      pool.sort((a, b) => {
        const scoreA = a.recent_count + (assignedInRun[a.user_id] || 0);
        const scoreB = b.recent_count + (assignedInRun[b.user_id] || 0);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.name.localeCompare(b.name);
      });

      const picked = pool.slice(0, need);
      for (const p of picked) {
        schedules.push({
          date: slot.date, user_id: p.user_id, name: p.name,
          time_start: slot.timeStart, time_end: slot.timeEnd,
          slotLabel: slot.label,
        });
        assignedInRun[p.user_id] = (assignedInRun[p.user_id] || 0) + 1;
        if (!assignedDates[p.user_id]) assignedDates[p.user_id] = new Set();
        assignedDates[p.user_id].add(`${slot.date}|${slot.timeStart}|${slot.timeEnd}`);
      }
    }

    // Build short summary instead of AI reasoning
    const slotsShort = targetSlots.length;
    const slotsZero = targetSlots.filter(s => s.eligible.length === 0).length;
    const slotsUnder = targetSlots.filter(s => s.eligible.length > 0 && s.eligible.length < s.membersCount).length;
    const summaryParts: string[] = [
      `${schedules.length} escala(s) distribuída(s) em ${slotsShort} slot(s).`,
    ];
    if (slotsZero > 0) summaryParts.push(`${slotsZero} slot(s) sem voluntários elegíveis.`);
    if (slotsUnder > 0) summaryParts.push(`${slotsUnder} slot(s) com menos voluntários disponíveis que o necessário.`);
    summaryParts.push('Distribuído priorizando quem está menos escalado.');
    const parsed = { reasoning: summaryParts.join(' ') };

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

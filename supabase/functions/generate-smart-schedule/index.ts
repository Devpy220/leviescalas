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

interface SuggestedSchedule {
  date: string;
  user_id: string;
  name: string;
  time_start: string;
  time_end: string;
  sector_id?: string;
}

const norm = (t?: string) => (t ?? '').slice(0, 5);
const daysBetween = (a: string, b: string) => {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return Math.abs((da - db) / 86400000);
};

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
      timeStart: z.string().regex(/^\d{2}:\d{2}$/),
      timeEnd: z.string().regex(/^\d{2}:\d{2}$/),
      label: z.string().max(100),
      membersCount: z.number().int().min(1).max(50),
    });

    const scheduleRequestSchema = z.object({
      department_id: z.string().uuid(),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      sector_id: z.string().uuid().optional(),
      fixed_slots: z.array(fixedSlotSchema).max(20).optional().default([]),
      selected_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(100).optional(),
    });

    const rawBody = await req.json();
    const parsed = scheduleRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(JSON.stringify({
        error: 'Dados inválidos',
        details: parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { department_id, start_date, end_date, sector_id, fixed_slots, selected_dates } = parsed.data;

    // Auth: only leader
    const { data: dept } = await supabase.from('departments').select('leader_id').eq('id', department_id).single();
    if (!dept || dept.leader_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Apenas líderes podem gerar escalas' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Members
    const { data: members } = await supabase.rpc('get_department_member_profiles', { dept_id: department_id });
    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum membro encontrado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Blocked members
    const { data: blockedRows } = await supabase
      .from('members').select('user_id').eq('department_id', department_id).eq('is_blocked', true);
    const blockedSet = new Set((blockedRows ?? []).map((r: any) => r.user_id));
    const membersList = (members as any[])
      .filter((m: any) => !blockedSet.has(m.id))
      .map((m: any) => ({ user_id: m.id, name: m.name }));
    if (membersList.length === 0) {
      return new Response(JSON.stringify({ error: 'Todos os voluntários estão bloqueados' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Availabilities & preferences & history
    const [dateAvailRes, weeklyRes, prefsRes, historyRes, crossRes] = await Promise.all([
      supabase.from('member_date_availability')
        .select('user_id, date, is_available')
        .eq('department_id', department_id).gte('date', start_date).lte('date', end_date),
      supabase.from('member_availability')
        .select('user_id, day_of_week, time_start, time_end, is_available')
        .eq('department_id', department_id),
      supabase.from('member_preferences')
        .select('user_id, max_schedules_per_month, min_days_between_schedules, blackout_dates')
        .eq('department_id', department_id),
      supabase.from('schedules')
        .select('user_id, date')
        .eq('department_id', department_id)
        .gte('date', new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]),
      supabase.from('schedules')
        .select('user_id, date, time_start, time_end, department_id')
        .in('user_id', membersList.map(m => m.user_id))
        .neq('department_id', department_id)
        .gte('date', start_date).lte('date', end_date),
    ]);

    const weeklyMap = new Map<string, boolean>();
    (weeklyRes.data || []).forEach((w: any) => {
      weeklyMap.set(`${w.user_id}|${w.day_of_week}|${norm(w.time_start)}|${norm(w.time_end)}`, w.is_available !== false);
    });

    const dateOverride = new Map<string, boolean>();
    (dateAvailRes.data || []).forEach((a: any) => {
      dateOverride.set(`${a.user_id}|${a.date}`, a.is_available !== false);
    });

    const preferencesMap: Record<string, {
      max_schedules_per_month: number;
      min_days_between_schedules: number;
      blackout_dates: Set<string>;
    }> = {};
    (prefsRes.data || []).forEach((p: any) => {
      preferencesMap[p.user_id] = {
        max_schedules_per_month: p.max_schedules_per_month ?? 4,
        min_days_between_schedules: p.min_days_between_schedules ?? 3,
        blackout_dates: new Set((p.blackout_dates || []).map((d: any) =>
          typeof d === 'string' ? d : new Date(d).toISOString().split('T')[0])),
      };
    });

    // Historical counts (last 90d) for fairness bias
    const historyCount: Record<string, number> = {};
    const lastScheduled: Record<string, string> = {};
    (historyRes.data || []).forEach((s: any) => {
      historyCount[s.user_id] = (historyCount[s.user_id] || 0) + 1;
      if (!lastScheduled[s.user_id] || s.date > lastScheduled[s.user_id]) lastScheduled[s.user_id] = s.date;
    });

    // Cross-dept conflicts index
    const crossConflicts = new Map<string, Array<{ start: string; end: string }>>();
    (crossRes.data || []).forEach((s: any) => {
      const k = `${s.user_id}|${s.date}`;
      const arr = crossConflicts.get(k) ?? [];
      arr.push({ start: norm(s.time_start), end: norm(s.time_end) });
      crossConflicts.set(k, arr);
    });

    // Build list of (date, slot) work-items in chronological order
    const selectedDatesSet = selected_dates && selected_dates.length > 0 ? new Set(selected_dates) : null;
    const [sy, sm, sd] = start_date.split('-').map(Number);
    const [ey, em, ed] = end_date.split('-').map(Number);
    const current = new Date(sy, sm - 1, sd);
    const endObj = new Date(ey, em - 1, ed);
    const workItems: Array<{ date: string; slot: FixedSlot }> = [];
    while (current <= endObj) {
      const y = current.getFullYear();
      const mo = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      const dateStr = `${y}-${mo}-${d}`;
      const dow = current.getDay();
      if (!selectedDatesSet || selectedDatesSet.has(dateStr)) {
        for (const slot of fixed_slots) {
          if (slot.dayOfWeek === dow) workItems.push({ date: dateStr, slot });
        }
      }
      current.setDate(current.getDate() + 1);
    }

    if (workItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum dia/horário para gerar. Ative slots e selecione dias.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Assignment state (this month/generation)
    const monthCount: Record<string, number> = {};       // count in this generation
    const assignmentsByMember: Record<string, string[]> = {}; // dates assigned this generation
    const sundayShiftByMember: Record<string, Record<string, 'M' | 'N'>> = {}; // uid -> date -> shift

    const isEligible = (uid: string, date: string, slot: FixedSlot): { ok: boolean; reason?: string } => {
      // Blackout preference
      const pref = preferencesMap[uid];
      if (pref?.blackout_dates.has(date)) return { ok: false, reason: 'blackout' };

      // Date override
      const ov = dateOverride.get(`${uid}|${date}`);
      if (ov === false) return { ok: false, reason: 'date-unavailable' };

      // Weekly opt-out (default available)
      const wkey = `${uid}|${slot.dayOfWeek}|${slot.timeStart}|${slot.timeEnd}`;
      const w = weeklyMap.get(wkey);
      if (ov !== true && w === false) return { ok: false, reason: 'weekly-blocked' };

      // Cross-dept conflict
      const conflicts = crossConflicts.get(`${uid}|${date}`) ?? [];
      if (conflicts.some(c => c.start < slot.timeEnd && c.end > slot.timeStart)) {
        return { ok: false, reason: 'cross-dept' };
      }

      // Max per month
      const maxMonth = pref?.max_schedules_per_month ?? 4;
      if ((monthCount[uid] || 0) >= maxMonth) return { ok: false, reason: 'max-month' };

      // Min days between schedules
      const minGap = pref?.min_days_between_schedules ?? 0;
      if (minGap > 0) {
        const mine = assignmentsByMember[uid] || [];
        if (mine.some(d => daysBetween(d, date) < minGap)) return { ok: false, reason: 'min-gap' };
      }

      // Sunday exclusivity (unless department allows double — we default to strict here)
      if (slot.dayOfWeek === 0) {
        const isMorning = slot.timeStart < '12:00';
        const prev = sundayShiftByMember[uid]?.[date];
        if (prev && ((prev === 'M') !== isMorning)) return { ok: false, reason: 'sunday-double' };
      }

      // Already assigned this exact slot
      if ((assignmentsByMember[uid] || []).includes(date)) {
        // allow if it's Sunday and different shift — handled above
        // otherwise disallow duplicate on same date/slot
        const sameDateAssigns = (assignmentsByMember[uid] || []).filter(d => d === date);
        if (sameDateAssigns.length > 0 && slot.dayOfWeek !== 0) return { ok: false, reason: 'same-day' };
      }

      return { ok: true };
    };

    // Fairness ranking: lower = higher priority
    // score = (thisGenCount * 100) + (historyCount * 10) + (daysSinceLastScheduled inverse penalty)
    const rank = (uid: string, date: string): number => {
      const cur = monthCount[uid] || 0;
      const hist = historyCount[uid] || 0;
      const last = lastScheduled[uid];
      // longer since last => lower score (higher priority)
      const gap = last ? daysBetween(last, date) : 999;
      return cur * 100 + hist * 5 - Math.min(gap, 90) * 0.5;
    };

    const scheduled: SuggestedSchedule[] = [];
    const unfilled: string[] = [];

    for (const item of workItems) {
      const { date, slot } = item;
      const needed = slot.membersCount;
      // Candidates
      const candidates = membersList
        .filter(m => isEligible(m.user_id, date, slot).ok)
        .map(m => ({ ...m, score: rank(m.user_id, date) }))
        .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));

      const picked = candidates.slice(0, needed);
      for (const p of picked) {
        scheduled.push({
          date, user_id: p.user_id, name: p.name,
          time_start: slot.timeStart, time_end: slot.timeEnd,
          sector_id,
        });
        monthCount[p.user_id] = (monthCount[p.user_id] || 0) + 1;
        (assignmentsByMember[p.user_id] ||= []).push(date);
        if (slot.dayOfWeek === 0) {
          const shift: 'M' | 'N' = slot.timeStart < '12:00' ? 'M' : 'N';
          (sundayShiftByMember[p.user_id] ||= {})[date] = shift;
        }
      }
      if (picked.length < needed) {
        unfilled.push(`${date} ${slot.label} (${picked.length}/${needed})`);
      }
    }

    const reasoning = [
      `Escalas geradas de forma determinística: ${scheduled.length} atribuições em ${workItems.length} slots.`,
      `Fairness aplicado: menor histórico + maior tempo desde a última escala têm prioridade.`,
      `Restrições respeitadas: bloqueios de datas, indisponibilidade semanal, conflitos entre departamentos, máx./mês, intervalo mínimo, exclusividade de domingo, voluntários bloqueados.`,
      unfilled.length > 0 ? `Slots sem cobertura suficiente: ${unfilled.slice(0, 10).join(' | ')}` : `Todos os slots cobertos.`,
    ].join(' ');

    return new Response(JSON.stringify({
      success: true,
      schedules: scheduled,
      reasoning,
      total: scheduled.length,
      unfilled_slots: unfilled,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error in generate-smart-schedule:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

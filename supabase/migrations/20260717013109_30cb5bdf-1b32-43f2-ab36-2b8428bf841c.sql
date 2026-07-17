
-- ============================================================
-- LeviKids: múltiplos dias de aula + escala interna de professores
-- ============================================================

-- 1) Tabela de dias de aula (recorrentes + avulsos) por página
CREATE TABLE IF NOT EXISTS public.kids_service_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.kids_pages(id) ON DELETE CASCADE,
  weekday int NULL,           -- 0..6 (Dom..Sáb) para recorrentes
  specific_date date NULL,    -- data pontual para avulsos
  time_start time NOT NULL,
  time_end time NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((weekday IS NOT NULL AND specific_date IS NULL) OR (weekday IS NULL AND specific_date IS NOT NULL)),
  CHECK (weekday IS NULL OR (weekday BETWEEN 0 AND 6)),
  CHECK (time_end > time_start)
);

GRANT SELECT ON public.kids_service_days TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.kids_service_days TO authenticated;
GRANT ALL ON public.kids_service_days TO service_role;

ALTER TABLE public.kids_service_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read service days"
  ON public.kids_service_days FOR SELECT
  USING (true);

CREATE POLICY "Kids leaders manage service days"
  ON public.kids_service_days FOR ALL
  USING (public.is_kids_leader(auth.uid(), page_id))
  WITH CHECK (public.is_kids_leader(auth.uid(), page_id));

CREATE TRIGGER kids_service_days_updated_at
  BEFORE UPDATE ON public.kids_service_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_kids_service_days_page ON public.kids_service_days(page_id);
CREATE INDEX IF NOT EXISTS idx_kids_service_days_date ON public.kids_service_days(specific_date) WHERE specific_date IS NOT NULL;

-- Migrar janela atual (checkin_days + times) para linhas recorrentes
INSERT INTO public.kids_service_days (page_id, weekday, time_start, time_end, active, created_by)
SELECT p.id, d, p.checkin_start_time, p.checkin_end_time, true, p.created_by
FROM public.kids_pages p
CROSS JOIN LATERAL unnest(COALESCE(p.checkin_days, ARRAY[]::int[])) AS d
WHERE p.checkin_start_time IS NOT NULL AND p.checkin_end_time IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.kids_service_days s WHERE s.page_id = p.id);

-- ============================================================
-- 2) Escala interna de professores por sala/data
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_room_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.kids_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  service_date date NOT NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id, service_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kids_room_schedules TO authenticated;
GRANT ALL ON public.kids_room_schedules TO service_role;

ALTER TABLE public.kids_room_schedules ENABLE ROW LEVEL SECURITY;

-- Professor pode ver a própria escala; líder da página pode ver tudo
CREATE POLICY "Teacher reads own schedule"
  ON public.kids_room_schedules FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.kids_rooms r
      WHERE r.id = room_id AND public.is_kids_leader(auth.uid(), r.page_id)
    )
  );

CREATE POLICY "Kids leaders manage room schedules"
  ON public.kids_room_schedules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.kids_rooms r
    WHERE r.id = room_id AND public.is_kids_leader(auth.uid(), r.page_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kids_rooms r
    WHERE r.id = room_id AND public.is_kids_leader(auth.uid(), r.page_id)
  ));

CREATE INDEX IF NOT EXISTS idx_kids_room_schedules_date ON public.kids_room_schedules(service_date, room_id);
CREATE INDEX IF NOT EXISTS idx_kids_room_schedules_user_date ON public.kids_room_schedules(user_id, service_date);

-- ============================================================
-- 3) Função: professor está escalado nesta sala HOJE?
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_kids_teacher_scheduled_today(_user_id uuid, _room_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kids_room_schedules
    WHERE user_id = _user_id
      AND room_id = _room_id
      AND service_date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_kids_teacher_scheduled_today(uuid, uuid) TO authenticated;

-- ============================================================
-- 4) RPC: listar salas do professor escaladas HOJE
-- ============================================================
CREATE OR REPLACE FUNCTION public.kids_teacher_rooms_today()
RETURNS TABLE(id uuid, name text, color text, page_id uuid, static_qr_token text, is_inclusion boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.name, r.color, r.page_id, r.static_qr_token, r.is_inclusion
  FROM public.kids_rooms r
  JOIN public.kids_room_schedules s ON s.room_id = r.id
  WHERE s.user_id = auth.uid()
    AND s.service_date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
    AND r.active = true
  ORDER BY r.name;
$$;

GRANT EXECUTE ON FUNCTION public.kids_teacher_rooms_today() TO authenticated;

-- ============================================================
-- 5) Helper: valida se AGORA está dentro de algum dia de aula ativo
--    Usa kids_service_days; se a página não tem nenhum registro,
--    aceita (permitindo configuração posterior).
-- ============================================================
CREATE OR REPLACE FUNCTION public.kids_is_within_service_window(_page_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tz text := 'America/Sao_Paulo';
  v_now timestamp;
  v_dow int;
  v_tod time;
  v_date date;
  v_has_any boolean;
BEGIN
  v_now := (now() AT TIME ZONE v_tz);
  v_dow := EXTRACT(DOW FROM v_now)::int;
  v_tod := v_now::time;
  v_date := v_now::date;

  SELECT EXISTS (SELECT 1 FROM public.kids_service_days WHERE page_id = _page_id AND active = true) INTO v_has_any;
  IF NOT v_has_any THEN RETURN true; END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.kids_service_days
    WHERE page_id = _page_id AND active = true
      AND (
        (weekday IS NOT NULL AND weekday = v_dow)
        OR (specific_date IS NOT NULL AND specific_date = v_date)
      )
      AND v_tod BETWEEN time_start AND time_end
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.kids_is_within_service_window(uuid) TO authenticated, anon;

-- ============================================================
-- 6) Reescrever RPCs de check-in para usar kids_service_days
-- ============================================================
CREATE OR REPLACE FUNCTION public.kids_perform_checkin_static(_static_token text, _child_ids uuid[])
RETURNS TABLE(child_id uuid, pickup_code text, checkin_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_room_id uuid; v_page_id uuid;
  v_cid uuid; v_id uuid; v_photo text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT r.id, r.page_id INTO v_room_id, v_page_id
  FROM public.kids_rooms r WHERE r.static_qr_token = _static_token LIMIT 1;
  IF v_room_id IS NULL THEN RAISE EXCEPTION 'QR inválido'; END IF;

  IF NOT public.kids_is_within_service_window(v_page_id) THEN
    RAISE EXCEPTION 'Check-in fechado. Fora do horário de aula.';
  END IF;

  FOREACH v_cid IN ARRAY _child_ids LOOP
    IF NOT public.is_guardian_of(auth.uid(), v_cid) THEN
      RAISE EXCEPTION 'Não é responsável pela criança %', v_cid;
    END IF;
    SELECT photo_path INTO v_photo FROM public.kids_children WHERE id = v_cid;
    IF v_photo IS NULL OR btrim(v_photo) = '' THEN
      RAISE EXCEPTION 'Foto da criança é obrigatória para check-in.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.kids_checkins WHERE kids_checkins.child_id = v_cid AND checkout_at IS NULL) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.kids_checkins (child_id, room_id, pickup_code, checkin_by)
    VALUES (v_cid, v_room_id, '', auth.uid())
    RETURNING id INTO v_id;
    RETURN QUERY SELECT v_cid, ''::text, v_id;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.kids_perform_checkin_by_page(_page_token text, _child_ids uuid[])
RETURNS TABLE(child_id uuid, pickup_code text, checkin_id uuid, room_id uuid, room_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_page_id uuid;
  v_cid uuid; v_id uuid; v_photo text; v_bd date; v_age int;
  v_room_id uuid; v_room_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id INTO v_page_id
  FROM public.kids_pages WHERE static_qr_token = _page_token LIMIT 1;
  IF v_page_id IS NULL THEN RAISE EXCEPTION 'QR inválido'; END IF;

  IF NOT public.kids_is_within_service_window(v_page_id) THEN
    RAISE EXCEPTION 'Check-in fechado. Fora do horário de aula.';
  END IF;

  FOREACH v_cid IN ARRAY _child_ids LOOP
    IF NOT public.is_guardian_of(auth.uid(), v_cid) THEN
      RAISE EXCEPTION 'Não é responsável pela criança %', v_cid;
    END IF;
    SELECT photo_path, birth_date, current_room_id INTO v_photo, v_bd, v_room_id
    FROM public.kids_children WHERE id = v_cid;
    IF v_photo IS NULL OR btrim(v_photo) = '' THEN
      RAISE EXCEPTION 'Foto da criança é obrigatória. Adicione no cadastro.';
    END IF;
    v_age := EXTRACT(YEAR FROM age(v_bd))::int;
    IF v_room_id IS NOT NULL THEN
      SELECT id, name INTO v_room_id, v_room_name
      FROM public.kids_rooms
      WHERE id = v_room_id AND page_id = v_page_id AND active = true
        AND v_age BETWEEN age_min AND age_max;
    END IF;
    IF v_room_id IS NULL THEN
      SELECT id, name INTO v_room_id, v_room_name
      FROM public.kids_rooms
      WHERE page_id = v_page_id AND active = true AND is_inclusion = false
        AND v_age BETWEEN age_min AND age_max
      ORDER BY age_max - age_min ASC LIMIT 1;
    END IF;
    IF v_room_id IS NULL THEN
      RAISE EXCEPTION 'Nenhuma sala configurada para % ano(s).', v_age;
    END IF;
    UPDATE public.kids_children SET current_room_id = v_room_id WHERE id = v_cid;
    IF EXISTS (SELECT 1 FROM public.kids_checkins WHERE kids_checkins.child_id = v_cid AND checkout_at IS NULL) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.kids_checkins (child_id, room_id, pickup_code, checkin_by)
    VALUES (v_cid, v_room_id, '', auth.uid())
    RETURNING id INTO v_id;
    RETURN QUERY SELECT v_cid, ''::text, v_id, v_room_id, v_room_name;
  END LOOP;
END; $$;

-- ============================================================
-- 7) Bloquear check-out se professor não estiver escalado hoje
-- ============================================================
CREATE OR REPLACE FUNCTION public.kids_perform_checkout(_checkin_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_room uuid; v_page uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT c.room_id, r.page_id INTO v_room, v_page
  FROM public.kids_checkins c
  JOIN public.kids_rooms r ON r.id = c.room_id
  WHERE c.id = _checkin_id AND c.checkout_at IS NULL;
  IF v_room IS NULL THEN RAISE EXCEPTION 'Check-in não encontrado ou já finalizado'; END IF;

  -- Líder da página sempre pode; professor precisa estar escalado HOJE nesta sala
  IF NOT public.is_kids_leader(auth.uid(), v_page)
     AND NOT public.is_kids_teacher_scheduled_today(auth.uid(), v_room) THEN
    RAISE EXCEPTION 'Você não está escalado nesta sala hoje';
  END IF;

  UPDATE public.kids_checkins SET checkout_at = now(), checkout_by = auth.uid() WHERE id = _checkin_id;
  RETURN true;
END; $$;

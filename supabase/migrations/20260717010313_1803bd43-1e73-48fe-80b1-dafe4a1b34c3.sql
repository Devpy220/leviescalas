
-- 1) Tornar pickup_code opcional (mantém histórico existente)
ALTER TABLE public.kids_checkins ALTER COLUMN pickup_code DROP NOT NULL;
ALTER TABLE public.kids_checkins ALTER COLUMN pickup_code SET DEFAULT '';

-- 2) Novo check-out sem código
DROP FUNCTION IF EXISTS public.kids_perform_checkout(uuid, text);

CREATE OR REPLACE FUNCTION public.kids_perform_checkout(_checkin_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_room uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT room_id INTO v_room
  FROM public.kids_checkins WHERE id = _checkin_id AND checkout_at IS NULL;
  IF v_room IS NULL THEN RAISE EXCEPTION 'Check-in not found or already closed'; END IF;
  IF NOT public.is_kids_teacher_of_room(auth.uid(), v_room) AND NOT EXISTS (
    SELECT 1 FROM public.kids_rooms r WHERE r.id = v_room AND public.is_kids_leader(auth.uid(), r.page_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.kids_checkins SET checkout_at = now(), checkout_by = auth.uid() WHERE id = _checkin_id;
  RETURN true;
END; $$;

GRANT EXECUTE ON FUNCTION public.kids_perform_checkout(uuid) TO authenticated;

-- 3) Check-in por QR de sala: não gera mais código
CREATE OR REPLACE FUNCTION public.kids_perform_checkin_static(_static_token text, _child_ids uuid[])
RETURNS TABLE(child_id uuid, pickup_code text, checkin_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_room_id uuid; v_page_id uuid;
  v_start time; v_end time; v_days int[]; v_tz text;
  v_now_local timestamp; v_dow int; v_tod time;
  v_cid uuid; v_id uuid; v_photo text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT r.id, r.page_id INTO v_room_id, v_page_id
  FROM public.kids_rooms r WHERE r.static_qr_token = _static_token LIMIT 1;
  IF v_room_id IS NULL THEN RAISE EXCEPTION 'QR inválido'; END IF;

  SELECT p.checkin_start_time, p.checkin_end_time, p.checkin_days, COALESCE(p.checkin_timezone,'America/Sao_Paulo')
    INTO v_start, v_end, v_days, v_tz
  FROM public.kids_pages p WHERE p.id = v_page_id;

  IF v_start IS NOT NULL AND v_end IS NOT NULL THEN
    v_now_local := (now() AT TIME ZONE v_tz);
    v_dow := EXTRACT(DOW FROM v_now_local)::int;
    v_tod := v_now_local::time;
    IF v_days IS NOT NULL AND array_length(v_days,1) > 0 AND NOT (v_dow = ANY(v_days)) THEN
      RAISE EXCEPTION 'Check-in não está disponível hoje.';
    END IF;
    IF v_tod < v_start OR v_tod > v_end THEN
      RAISE EXCEPTION 'Check-in fechado. Horário permitido: % até %', to_char(v_start,'HH24:MI'), to_char(v_end,'HH24:MI');
    END IF;
  END IF;

  FOREACH v_cid IN ARRAY _child_ids LOOP
    IF NOT public.is_guardian_of(auth.uid(), v_cid) THEN
      RAISE EXCEPTION 'Não é responsável pela criança %', v_cid;
    END IF;
    SELECT photo_path INTO v_photo FROM public.kids_children WHERE id = v_cid;
    IF v_photo IS NULL OR btrim(v_photo) = '' THEN
      RAISE EXCEPTION 'Foto da criança é obrigatória para check-in. Adicione a foto no cadastro.';
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

-- 4) Check-in por QR da página (por idade): não gera mais código
CREATE OR REPLACE FUNCTION public.kids_perform_checkin_by_page(_page_token text, _child_ids uuid[])
RETURNS TABLE(child_id uuid, pickup_code text, checkin_id uuid, room_id uuid, room_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_page_id uuid;
  v_start time; v_end time; v_days int[]; v_tz text;
  v_now_local timestamp; v_dow int; v_tod time;
  v_cid uuid; v_id uuid; v_photo text; v_bd date; v_age int;
  v_room_id uuid; v_room_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, checkin_start_time, checkin_end_time, checkin_days, COALESCE(checkin_timezone,'America/Sao_Paulo')
    INTO v_page_id, v_start, v_end, v_days, v_tz
  FROM public.kids_pages WHERE static_qr_token = _page_token LIMIT 1;
  IF v_page_id IS NULL THEN RAISE EXCEPTION 'QR inválido'; END IF;

  IF v_start IS NOT NULL AND v_end IS NOT NULL THEN
    v_now_local := (now() AT TIME ZONE v_tz);
    v_dow := EXTRACT(DOW FROM v_now_local)::int;
    v_tod := v_now_local::time;
    IF v_days IS NOT NULL AND array_length(v_days,1) > 0 AND NOT (v_dow = ANY(v_days)) THEN
      RAISE EXCEPTION 'Check-in não está disponível hoje.';
    END IF;
    IF v_tod < v_start OR v_tod > v_end THEN
      RAISE EXCEPTION 'Check-in fechado. Horário permitido: % até %', to_char(v_start,'HH24:MI'), to_char(v_end,'HH24:MI');
    END IF;
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
      RAISE EXCEPTION 'Nenhuma sala configurada para % ano(s). Peça ao líder para criar uma sala com essa faixa etária.', v_age;
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

-- 5) Check-in dinâmico (legado): também sem código
CREATE OR REPLACE FUNCTION public.kids_perform_checkin(_dynamic_token text, _child_ids uuid[])
RETURNS TABLE(child_id uuid, pickup_code text, checkin_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_room_id uuid; v_cid uuid; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT dt.room_id INTO v_room_id
  FROM public.kids_dynamic_tokens dt
  WHERE dt.token = _dynamic_token AND dt.expires_at > now() LIMIT 1;
  IF v_room_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired token'; END IF;
  FOREACH v_cid IN ARRAY _child_ids LOOP
    IF NOT public.is_guardian_of(auth.uid(), v_cid) THEN
      RAISE EXCEPTION 'Not guardian of child %', v_cid;
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

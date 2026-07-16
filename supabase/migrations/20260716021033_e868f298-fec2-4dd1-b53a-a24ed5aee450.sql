
-- 1) Página Kids ganha um QR único por igreja
ALTER TABLE public.kids_pages
  ADD COLUMN IF NOT EXISTS static_qr_token text;

-- backfill dos existentes
UPDATE public.kids_pages
   SET static_qr_token = encode(gen_random_bytes(18), 'hex')
 WHERE static_qr_token IS NULL;

ALTER TABLE public.kids_pages
  ALTER COLUMN static_qr_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS kids_pages_static_qr_token_uk
  ON public.kids_pages(static_qr_token);

-- default para novos
ALTER TABLE public.kids_pages
  ALTER COLUMN static_qr_token SET DEFAULT encode(gen_random_bytes(18), 'hex');

-- 2) CPF do responsável (opcional a nível de schema, exigido pela UI Kids)
ALTER TABLE public.kids_guardians
  ADD COLUMN IF NOT EXISTS cpf text;

-- 3) Lookup público (SECURITY DEFINER) para o QR único da página
CREATE OR REPLACE FUNCTION public.kids_lookup_page_by_token(_token text)
RETURNS TABLE(page_id uuid, page_name text, consent_version text, consent_text text, primary_color text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.name, p.consent_version, p.consent_text, p.primary_color
  FROM public.kids_pages p
  WHERE p.static_qr_token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.kids_lookup_page_by_token(text) TO anon, authenticated;

-- 4) Check-in via QR único da página: escolhe sala pela idade
CREATE OR REPLACE FUNCTION public.kids_perform_checkin_by_page(_page_token text, _child_ids uuid[])
RETURNS TABLE(child_id uuid, pickup_code text, checkin_id uuid, room_id uuid, room_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_page_id uuid;
  v_start time; v_end time; v_days int[]; v_tz text;
  v_now_local timestamp; v_dow int; v_tod time;
  v_cid uuid; v_code text; v_id uuid; v_photo text; v_bd date; v_age int;
  v_room_id uuid; v_room_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, checkin_start_time, checkin_end_time, checkin_days, COALESCE(checkin_timezone,'America/Sao_Paulo')
    INTO v_page_id, v_start, v_end, v_days, v_tz
  FROM public.kids_pages
  WHERE static_qr_token = _page_token
  LIMIT 1;

  IF v_page_id IS NULL THEN RAISE EXCEPTION 'QR inválido'; END IF;

  -- Janela de horário só se configurada
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

    SELECT photo_path, birth_date, current_room_id
      INTO v_photo, v_bd, v_room_id
    FROM public.kids_children WHERE id = v_cid;

    IF v_photo IS NULL OR btrim(v_photo) = '' THEN
      RAISE EXCEPTION 'Foto da criança é obrigatória. Adicione no cadastro.';
    END IF;

    v_age := EXTRACT(YEAR FROM age(v_bd))::int;

    -- Se sala atual não bate (ou não existe) → escolhe pela idade
    IF v_room_id IS NOT NULL THEN
      SELECT id, name INTO v_room_id, v_room_name
      FROM public.kids_rooms
      WHERE id = v_room_id AND page_id = v_page_id
        AND active = true
        AND v_age BETWEEN age_min AND age_max;
    END IF;

    IF v_room_id IS NULL THEN
      SELECT id, name INTO v_room_id, v_room_name
      FROM public.kids_rooms
      WHERE page_id = v_page_id
        AND active = true
        AND is_inclusion = false
        AND v_age BETWEEN age_min AND age_max
      ORDER BY age_max - age_min ASC
      LIMIT 1;
    END IF;

    IF v_room_id IS NULL THEN
      RAISE EXCEPTION 'Nenhuma sala configurada para % ano(s). Peça ao líder para criar uma sala com essa faixa etária.', v_age;
    END IF;

    -- Atualiza current_room_id
    UPDATE public.kids_children SET current_room_id = v_room_id WHERE id = v_cid;

    -- Evita duplicar
    IF EXISTS (SELECT 1 FROM public.kids_checkins WHERE kids_checkins.child_id = v_cid AND checkout_at IS NULL) THEN
      CONTINUE;
    END IF;

    v_code := lpad((floor(random()*10000))::int::text, 4, '0');
    INSERT INTO public.kids_checkins (child_id, room_id, pickup_code, checkin_by)
    VALUES (v_cid, v_room_id, v_code, auth.uid())
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_cid, v_code, v_id, v_room_id, v_room_name;
  END LOOP;
END; $$;

GRANT EXECUTE ON FUNCTION public.kids_perform_checkin_by_page(text, uuid[]) TO authenticated;

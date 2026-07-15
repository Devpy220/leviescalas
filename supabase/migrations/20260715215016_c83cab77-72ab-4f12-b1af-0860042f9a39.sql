
-- ============================================================
-- LeviKids v2 migration
-- ============================================================

-- 1) SCHEMA CHANGES ------------------------------------------

ALTER TABLE public.kids_pages
  ADD COLUMN IF NOT EXISTS checkin_start_time time DEFAULT '18:30'::time,
  ADD COLUMN IF NOT EXISTS checkin_end_time   time DEFAULT '20:30'::time,
  ADD COLUMN IF NOT EXISTS checkin_days       int[] DEFAULT ARRAY[0,3]::int[],
  ADD COLUMN IF NOT EXISTS checkin_timezone   text DEFAULT 'America/Sao_Paulo';

ALTER TABLE public.kids_rooms
  ADD COLUMN IF NOT EXISTS is_inclusion boolean NOT NULL DEFAULT false;

ALTER TABLE public.kids_children
  ADD COLUMN IF NOT EXISTS current_room_id uuid REFERENCES public.kids_rooms(id) ON DELETE SET NULL;

-- 2) PHOTO REQUIRED TRIGGER ----------------------------------

CREATE OR REPLACE FUNCTION public.kids_children_require_photo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.photo_path IS NULL OR btrim(NEW.photo_path) = '' THEN
    RAISE EXCEPTION 'Foto da criança é obrigatória para cadastro/edição.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kids_children_require_photo ON public.kids_children;
CREATE TRIGGER trg_kids_children_require_photo
BEFORE INSERT OR UPDATE OF photo_path ON public.kids_children
FOR EACH ROW EXECUTE FUNCTION public.kids_children_require_photo();

-- 3) HELPERS -------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_kids_guardian_of_page(_user_id uuid, _page_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.kids_guardian_children gc
    JOIN public.kids_guardians g ON g.id = gc.guardian_id
    JOIN public.kids_children ch  ON ch.id = gc.child_id
    WHERE g.user_id = _user_id AND ch.page_id = _page_id
  );
$$;

-- 4) SECURITY FIXES: kids_rooms & kids_pages -----------------

DROP POLICY IF EXISTS "kids_rooms read for authenticated" ON public.kids_rooms;
CREATE POLICY "kids_rooms read by leaders teachers guardians"
ON public.kids_rooms FOR SELECT TO authenticated
USING (
  public.is_kids_leader(auth.uid(), page_id)
  OR public.is_kids_teacher_of_room(auth.uid(), id)
  OR public.is_kids_guardian_of_page(auth.uid(), page_id)
);

DROP POLICY IF EXISTS "kids_pages read for authenticated" ON public.kids_pages;
CREATE POLICY "kids_pages read by leaders teachers guardians"
ON public.kids_pages FOR SELECT TO authenticated
USING (
  public.is_kids_leader(auth.uid(), id)
  OR public.is_kids_teacher_of_page(auth.uid(), id)
  OR public.is_kids_guardian_of_page(auth.uid(), id)
);

-- 5) NEW TABLES ----------------------------------------------

-- 5.1 room transfers
CREATE TABLE IF NOT EXISTS public.kids_room_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.kids_children(id) ON DELETE CASCADE,
  from_room_id uuid REFERENCES public.kids_rooms(id) ON DELETE SET NULL,
  to_room_id   uuid NOT NULL REFERENCES public.kids_rooms(id) ON DELETE CASCADE,
  transferred_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.kids_room_transfers TO authenticated;
GRANT ALL ON public.kids_room_transfers TO service_role;
ALTER TABLE public.kids_room_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_room_transfers read by leader/guardian"
ON public.kids_room_transfers FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.kids_children ch WHERE ch.id = child_id AND public.is_kids_leader(auth.uid(), ch.page_id))
  OR public.is_guardian_of(auth.uid(), child_id)
);

-- 5.2 messages
CREATE TABLE IF NOT EXISTS public.kids_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.kids_pages(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.kids_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('leader','teacher')),
  title text NOT NULL,
  body  text NOT NULL,
  media_url text,
  media_type text,
  notify_whatsapp boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.kids_messages TO authenticated;
GRANT ALL ON public.kids_messages TO service_role;
ALTER TABLE public.kids_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_messages read by leader"
ON public.kids_messages FOR SELECT TO authenticated
USING (public.is_kids_leader(auth.uid(), page_id));

CREATE POLICY "kids_messages read by teacher of room"
ON public.kids_messages FOR SELECT TO authenticated
USING (room_id IS NOT NULL AND public.is_kids_teacher_of_room(auth.uid(), room_id));

CREATE POLICY "kids_messages read by guardian scope"
ON public.kids_messages FOR SELECT TO authenticated
USING (
  public.is_kids_guardian_of_page(auth.uid(), page_id)
  AND (
    room_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.kids_guardian_children gc
      JOIN public.kids_guardians g ON g.id = gc.guardian_id
      JOIN public.kids_children ch ON ch.id = gc.child_id
      WHERE g.user_id = auth.uid()
        AND ch.page_id = kids_messages.page_id
        AND (ch.current_room_id = kids_messages.room_id
             OR EXISTS (SELECT 1 FROM public.kids_checkins ci WHERE ci.child_id = ch.id AND ci.room_id = kids_messages.room_id))
    )
  )
);

CREATE POLICY "kids_messages insert by leader"
ON public.kids_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND sender_role = 'leader'
  AND public.is_kids_leader(auth.uid(), page_id)
);

CREATE POLICY "kids_messages insert by teacher of room"
ON public.kids_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND sender_role = 'teacher'
  AND room_id IS NOT NULL
  AND public.is_kids_teacher_of_room(auth.uid(), room_id)
);

CREATE POLICY "kids_messages delete by sender or leader"
ON public.kids_messages FOR DELETE TO authenticated
USING (
  sender_id = auth.uid()
  OR public.is_kids_leader(auth.uid(), page_id)
);

-- 5.3 inclusion notes
CREATE TABLE IF NOT EXISTS public.kids_inclusion_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.kids_children(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.kids_inclusion_notes TO authenticated;
GRANT ALL ON public.kids_inclusion_notes TO service_role;
ALTER TABLE public.kids_inclusion_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_inclusion_notes read by leader/teacher"
ON public.kids_inclusion_notes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.kids_children ch
    WHERE ch.id = child_id
      AND (public.is_kids_leader(auth.uid(), ch.page_id)
           OR public.is_kids_teacher_of_page(auth.uid(), ch.page_id))
  )
);
CREATE POLICY "kids_inclusion_notes insert by author leader/teacher"
ON public.kids_inclusion_notes FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.kids_children ch
    WHERE ch.id = child_id
      AND (public.is_kids_leader(auth.uid(), ch.page_id)
           OR public.is_kids_teacher_of_page(auth.uid(), ch.page_id))
  )
);
CREATE POLICY "kids_inclusion_notes delete by author or leader"
ON public.kids_inclusion_notes FOR DELETE TO authenticated
USING (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.kids_children ch WHERE ch.id = child_id AND public.is_kids_leader(auth.uid(), ch.page_id))
);

-- 6) NEW CHECK-IN RPC (static QR + window) -------------------

CREATE OR REPLACE FUNCTION public.kids_perform_checkin_static(_static_token text, _child_ids uuid[])
RETURNS TABLE(child_id uuid, pickup_code text, checkin_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_room_id uuid; v_page_id uuid;
  v_start time; v_end time; v_days int[]; v_tz text;
  v_now_local timestamp; v_dow int; v_tod time;
  v_cid uuid; v_code text; v_id uuid; v_photo text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT r.id, r.page_id INTO v_room_id, v_page_id
  FROM public.kids_rooms r
  WHERE r.static_qr_token = _static_token
  LIMIT 1;

  IF v_room_id IS NULL THEN RAISE EXCEPTION 'QR inválido'; END IF;

  SELECT p.checkin_start_time, p.checkin_end_time, p.checkin_days, COALESCE(p.checkin_timezone,'America/Sao_Paulo')
    INTO v_start, v_end, v_days, v_tz
  FROM public.kids_pages p WHERE p.id = v_page_id;

  v_now_local := (now() AT TIME ZONE v_tz);
  v_dow := EXTRACT(DOW FROM v_now_local)::int;
  v_tod := v_now_local::time;

  IF v_start IS NOT NULL AND v_end IS NOT NULL THEN
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

    v_code := lpad((floor(random()*10000))::int::text, 4, '0');
    INSERT INTO public.kids_checkins (child_id, room_id, pickup_code, checkin_by)
    VALUES (v_cid, v_room_id, v_code, auth.uid())
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_cid, v_code, v_id;
  END LOOP;
END; $$;

-- 7) TRANSFER RPC --------------------------------------------

CREATE OR REPLACE FUNCTION public.kids_transfer_child(_child_id uuid, _new_room_id uuid, _reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_page uuid; v_from uuid; v_target_page uuid;
BEGIN
  SELECT page_id, current_room_id INTO v_page, v_from FROM public.kids_children WHERE id = _child_id;
  IF v_page IS NULL THEN RAISE EXCEPTION 'Criança não encontrada'; END IF;
  IF NOT public.is_kids_leader(auth.uid(), v_page) THEN
    RAISE EXCEPTION 'Somente o líder da página pode transferir de sala';
  END IF;
  SELECT page_id INTO v_target_page FROM public.kids_rooms WHERE id = _new_room_id;
  IF v_target_page <> v_page THEN
    RAISE EXCEPTION 'Sala de destino não pertence à mesma página';
  END IF;

  UPDATE public.kids_children SET current_room_id = _new_room_id, updated_at = now() WHERE id = _child_id;
  INSERT INTO public.kids_room_transfers (child_id, from_room_id, to_room_id, transferred_by, reason)
  VALUES (_child_id, v_from, _new_room_id, auth.uid(), _reason);
  RETURN true;
END; $$;

-- 8) ATTENDANCE & REPORTS ------------------------------------

CREATE OR REPLACE FUNCTION public.kids_child_attendance(_child_id uuid, _from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS TABLE(month text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT to_char(date_trunc('month', ci.checkin_at), 'YYYY-MM') AS month,
         COUNT(*)::bigint AS count
  FROM public.kids_checkins ci
  WHERE ci.child_id = _child_id
    AND (_from IS NULL OR ci.checkin_at::date >= _from)
    AND (_to   IS NULL OR ci.checkin_at::date <= _to)
    AND (
      public.is_guardian_of(auth.uid(), ci.child_id)
      OR EXISTS (SELECT 1 FROM public.kids_children ch WHERE ch.id = ci.child_id AND public.is_kids_leader(auth.uid(), ch.page_id))
    )
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.kids_report_visitors(_page_id uuid)
RETURNS TABLE(child_id uuid, full_name text, checkins bigint, last_visit timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ch.id, ch.full_name, COUNT(ci.id)::bigint, MAX(ci.checkin_at)
  FROM public.kids_children ch
  LEFT JOIN public.kids_checkins ci ON ci.child_id = ch.id AND ci.checkin_at >= now() - INTERVAL '90 days'
  WHERE ch.page_id = _page_id
    AND public.is_kids_leader(auth.uid(), _page_id)
  GROUP BY ch.id, ch.full_name
  HAVING COUNT(ci.id) BETWEEN 1 AND 2
  ORDER BY MAX(ci.checkin_at) DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.kids_report_needs(_page_id uuid)
RETURNS TABLE(child_id uuid, full_name text, allergies text, restrictions text, current_room text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ch.id, ch.full_name, ch.allergies, ch.restrictions, r.name
  FROM public.kids_children ch
  LEFT JOIN public.kids_rooms r ON r.id = ch.current_room_id
  WHERE ch.page_id = _page_id
    AND public.is_kids_leader(auth.uid(), _page_id)
    AND ((ch.allergies IS NOT NULL AND btrim(ch.allergies) <> '')
      OR (ch.restrictions IS NOT NULL AND btrim(ch.restrictions) <> ''))
  ORDER BY ch.full_name;
$$;

CREATE OR REPLACE FUNCTION public.kids_report_dropoff(_page_id uuid)
RETURNS TABLE(child_id uuid, full_name text, guardian_name text, guardian_phone text, last_visit timestamptz, checkins_prev bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH prev AS (
    SELECT ci.child_id, COUNT(*)::bigint AS c
    FROM public.kids_checkins ci
    WHERE ci.checkin_at BETWEEN now() - INTERVAL '90 days' AND now() - INTERVAL '30 days'
    GROUP BY ci.child_id
  ),
  recent AS (
    SELECT ci.child_id, COUNT(*)::bigint AS c
    FROM public.kids_checkins ci
    WHERE ci.checkin_at >= now() - INTERVAL '30 days'
    GROUP BY ci.child_id
  ),
  last_v AS (
    SELECT ci.child_id, MAX(ci.checkin_at) AS last_at
    FROM public.kids_checkins ci
    GROUP BY ci.child_id
  )
  SELECT ch.id, ch.full_name, g.full_name, g.phone, lv.last_at, p.c
  FROM public.kids_children ch
  JOIN prev p ON p.child_id = ch.id AND p.c >= 3
  LEFT JOIN recent r ON r.child_id = ch.id
  LEFT JOIN last_v lv ON lv.child_id = ch.id
  LEFT JOIN LATERAL (
    SELECT g2.full_name, g2.phone
    FROM public.kids_guardian_children gc
    JOIN public.kids_guardians g2 ON g2.id = gc.guardian_id
    WHERE gc.child_id = ch.id
    ORDER BY gc.created_at
    LIMIT 1
  ) g ON true
  WHERE ch.page_id = _page_id
    AND public.is_kids_leader(auth.uid(), _page_id)
    AND COALESCE(r.c, 0) = 0
  ORDER BY lv.last_at DESC NULLS LAST;
$$;

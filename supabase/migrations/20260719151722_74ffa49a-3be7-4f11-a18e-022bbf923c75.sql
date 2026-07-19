
-- ==========================================
-- 1. PIN da criança
-- ==========================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.kids_children
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_set_at timestamptz;

CREATE OR REPLACE FUNCTION public.kids_set_child_pin(_child_id uuid, _pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'PIN deve ter exatamente 4 dígitos'; END IF;
  IF NOT public.is_guardian_of(auth.uid(), _child_id) THEN
    RAISE EXCEPTION 'apenas responsáveis podem definir o PIN';
  END IF;
  UPDATE public.kids_children
     SET pin_hash = crypt(_pin, gen_salt('bf', 8)),
         pin_set_at = now(),
         updated_at = now()
   WHERE id = _child_id;
END; $$;

CREATE OR REPLACE FUNCTION public.kids_verify_child_pin(_child_id uuid, _pin text)
RETURNS TABLE(child_id uuid, full_name text, page_id uuid, birth_date date, photo_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'PIN inválido'; END IF;
  RETURN QUERY
  SELECT c.id, c.full_name, c.page_id, c.birth_date, c.photo_path
    FROM public.kids_children c
   WHERE c.id = _child_id
     AND c.pin_hash IS NOT NULL
     AND c.pin_hash = crypt(_pin, c.pin_hash);
END; $$;

-- ==========================================
-- 2. Pré-check-in por código de 6 dígitos
-- ==========================================
CREATE TABLE IF NOT EXISTS public.kids_precheckin_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.kids_children(id) ON DELETE CASCADE,
  code text NOT NULL,
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  used_at timestamptz,
  used_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kids_precheckin_codes_code_idx ON public.kids_precheckin_codes(code) WHERE used_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kids_precheckin_codes TO authenticated;
GRANT ALL ON public.kids_precheckin_codes TO service_role;
ALTER TABLE public.kids_precheckin_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guardian manages own precheckin" ON public.kids_precheckin_codes
  FOR ALL TO authenticated
  USING (public.is_guardian_of(auth.uid(), child_id))
  WITH CHECK (public.is_guardian_of(auth.uid(), child_id) AND created_by = auth.uid());

CREATE POLICY "leaders read precheckin" ON public.kids_precheckin_codes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kids_children c
                 WHERE c.id = child_id AND public.is_kids_leader(auth.uid(), c.page_id)));

CREATE OR REPLACE FUNCTION public.kids_generate_precheckin(_child_id uuid)
RETURNS TABLE(code text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_code text; v_exp timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_guardian_of(auth.uid(), _child_id) THEN RAISE EXCEPTION 'not guardian'; END IF;
  -- invalidate previous unused codes
  UPDATE public.kids_precheckin_codes SET used_at = now(), used_by = auth.uid()
   WHERE child_id = _child_id AND used_at IS NULL;
  v_code := lpad((floor(random()*1000000))::int::text, 6, '0');
  v_exp := now() + interval '2 hours';
  INSERT INTO public.kids_precheckin_codes (child_id, code, created_by, expires_at)
  VALUES (_child_id, v_code, auth.uid(), v_exp);
  RETURN QUERY SELECT v_code, v_exp;
END; $$;

-- ==========================================
-- 3. Autorizados a retirar
-- ==========================================
CREATE TABLE IF NOT EXISTS public.kids_authorized_pickups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.kids_children(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text,
  document text,
  phone text,
  photo_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kids_authorized_pickups TO authenticated;
GRANT ALL ON public.kids_authorized_pickups TO service_role;
ALTER TABLE public.kids_authorized_pickups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guardian manages pickups" ON public.kids_authorized_pickups
  FOR ALL TO authenticated
  USING (public.is_guardian_of(auth.uid(), child_id))
  WITH CHECK (public.is_guardian_of(auth.uid(), child_id) AND created_by = auth.uid());

CREATE POLICY "leaders and teachers read pickups" ON public.kids_authorized_pickups
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kids_children c
    WHERE c.id = child_id AND (
      public.is_kids_leader(auth.uid(), c.page_id)
      OR public.is_kids_teacher_of_page(auth.uid(), c.page_id)
    )
  ));

-- ==========================================
-- 4. Pedidos de oração
-- ==========================================
CREATE TABLE IF NOT EXISTS public.kids_prayer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.kids_children(id) ON DELETE CASCADE,
  guardian_user_id uuid NOT NULL,
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','praying','answered')),
  responded_by uuid,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kids_prayer_requests TO authenticated;
GRANT ALL ON public.kids_prayer_requests TO service_role;
ALTER TABLE public.kids_prayer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guardian owns prayer" ON public.kids_prayer_requests
  FOR ALL TO authenticated
  USING (guardian_user_id = auth.uid())
  WITH CHECK (guardian_user_id = auth.uid());

CREATE POLICY "leaders read and update prayer" ON public.kids_prayer_requests
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kids_children c
                 WHERE c.id = child_id AND public.is_kids_leader(auth.uid(), c.page_id)));

CREATE POLICY "leaders update prayer status" ON public.kids_prayer_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kids_children c
                 WHERE c.id = child_id AND public.is_kids_leader(auth.uid(), c.page_id)));

-- ==========================================
-- 5. Agenda de eventos
-- ==========================================
CREATE TABLE IF NOT EXISTS public.kids_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.kids_pages(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  location text,
  cover_url text,
  allow_signup boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kids_events TO authenticated;
GRANT ALL ON public.kids_events TO service_role;
ALTER TABLE public.kids_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leaders manage events" ON public.kids_events
  FOR ALL TO authenticated
  USING (public.is_kids_leader(auth.uid(), page_id))
  WITH CHECK (public.is_kids_leader(auth.uid(), page_id));

CREATE POLICY "page members read events" ON public.kids_events
  FOR SELECT TO authenticated
  USING (
    public.is_kids_leader(auth.uid(), page_id)
    OR public.is_kids_teacher_of_page(auth.uid(), page_id)
    OR public.is_kids_guardian_of_page(auth.uid(), page_id)
  );

CREATE TABLE IF NOT EXISTS public.kids_event_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.kids_events(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.kids_children(id) ON DELETE CASCADE,
  guardian_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, child_id)
);

GRANT SELECT, INSERT, DELETE ON public.kids_event_signups TO authenticated;
GRANT ALL ON public.kids_event_signups TO service_role;
ALTER TABLE public.kids_event_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guardian manages signups" ON public.kids_event_signups
  FOR ALL TO authenticated
  USING (guardian_user_id = auth.uid() AND public.is_guardian_of(auth.uid(), child_id))
  WITH CHECK (guardian_user_id = auth.uid() AND public.is_guardian_of(auth.uid(), child_id));

CREATE POLICY "leaders read signups" ON public.kids_event_signups
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kids_events e
                 WHERE e.id = event_id AND public.is_kids_leader(auth.uid(), e.page_id)));

-- ==========================================
-- 6. Banco de versículos + memorizados
-- ==========================================
DO $$ BEGIN
  CREATE TYPE public.kids_age_track AS ENUM ('bercario','maternal','juniores','pre_ado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.kids_verses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid REFERENCES public.kids_pages(id) ON DELETE CASCADE,
  reference text NOT NULL,
  text_simple text NOT NULL,
  age_track public.kids_age_track NOT NULL DEFAULT 'juniores',
  illustration_url text,
  audio_url text,
  family_devotional_text text,
  order_index int NOT NULL DEFAULT 0,
  is_global boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kids_verses_page_track_idx ON public.kids_verses(page_id, age_track, order_index);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kids_verses TO authenticated;
GRANT ALL ON public.kids_verses TO service_role;
ALTER TABLE public.kids_verses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leaders manage verses" ON public.kids_verses
  FOR ALL TO authenticated
  USING (page_id IS NOT NULL AND public.is_kids_leader(auth.uid(), page_id))
  WITH CHECK (page_id IS NOT NULL AND public.is_kids_leader(auth.uid(), page_id));

CREATE POLICY "page members read verses" ON public.kids_verses
  FOR SELECT TO authenticated
  USING (
    is_published AND (
      is_global
      OR (page_id IS NOT NULL AND (
        public.is_kids_leader(auth.uid(), page_id)
        OR public.is_kids_teacher_of_page(auth.uid(), page_id)
        OR public.is_kids_guardian_of_page(auth.uid(), page_id)
      ))
    )
  );

CREATE TABLE IF NOT EXISTS public.kids_verse_memorized (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.kids_children(id) ON DELETE CASCADE,
  verse_id uuid NOT NULL REFERENCES public.kids_verses(id) ON DELETE CASCADE,
  memorized_at timestamptz NOT NULL DEFAULT now(),
  marked_by uuid,
  UNIQUE (child_id, verse_id)
);

GRANT SELECT, INSERT, DELETE ON public.kids_verse_memorized TO authenticated;
GRANT ALL ON public.kids_verse_memorized TO service_role;
ALTER TABLE public.kids_verse_memorized ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guardian and leader read memorized" ON public.kids_verse_memorized
  FOR SELECT TO authenticated
  USING (
    public.is_guardian_of(auth.uid(), child_id)
    OR EXISTS (SELECT 1 FROM public.kids_children c
               WHERE c.id = child_id AND (
                 public.is_kids_leader(auth.uid(), c.page_id)
                 OR public.is_kids_teacher_of_page(auth.uid(), c.page_id)
               ))
  );

CREATE POLICY "guardian marks memorized" ON public.kids_verse_memorized
  FOR INSERT TO authenticated
  WITH CHECK (public.is_guardian_of(auth.uid(), child_id));

CREATE POLICY "guardian removes memorized" ON public.kids_verse_memorized
  FOR DELETE TO authenticated
  USING (public.is_guardian_of(auth.uid(), child_id));

-- ==========================================
-- 7. RPC pré-check-in: professor consome código
-- ==========================================
CREATE OR REPLACE FUNCTION public.kids_consume_precheckin(_code text)
RETURNS TABLE(child_id uuid, full_name text, room_id uuid, room_name text, checkin_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child uuid; v_page uuid; v_bd date; v_age int;
  v_room uuid; v_room_name text; v_photo text; v_checkin uuid; v_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT p.child_id INTO v_child
    FROM public.kids_precheckin_codes p
   WHERE p.code = _code AND p.used_at IS NULL AND p.expires_at > now()
   LIMIT 1;
  IF v_child IS NULL THEN RAISE EXCEPTION 'Código inválido ou expirado'; END IF;
  SELECT page_id, birth_date, photo_path, full_name INTO v_page, v_bd, v_photo, v_name
    FROM public.kids_children WHERE id = v_child;
  IF NOT (public.is_kids_leader(auth.uid(), v_page)
          OR public.is_kids_teacher_of_page(auth.uid(), v_page)) THEN
    RAISE EXCEPTION 'Sem permissão nesta página';
  END IF;
  IF v_photo IS NULL OR btrim(v_photo) = '' THEN
    RAISE EXCEPTION 'Foto da criança é obrigatória';
  END IF;
  v_age := EXTRACT(YEAR FROM age(v_bd))::int;
  SELECT id, name INTO v_room, v_room_name FROM public.kids_rooms
   WHERE page_id = v_page AND active = true AND is_inclusion = false
     AND v_age BETWEEN age_min AND age_max
   ORDER BY age_max - age_min ASC LIMIT 1;
  IF v_room IS NULL THEN RAISE EXCEPTION 'Sem sala para % ano(s)', v_age; END IF;

  UPDATE public.kids_children SET current_room_id = v_room WHERE id = v_child;
  IF NOT EXISTS (SELECT 1 FROM public.kids_checkins WHERE kids_checkins.child_id = v_child AND checkout_at IS NULL) THEN
    INSERT INTO public.kids_checkins (child_id, room_id, pickup_code, checkin_by)
    VALUES (v_child, v_room, '', auth.uid()) RETURNING id INTO v_checkin;
  END IF;
  UPDATE public.kids_precheckin_codes SET used_at = now(), used_by = auth.uid() WHERE code = _code;
  RETURN QUERY SELECT v_child, v_name, v_room, v_room_name, v_checkin;
END; $$;

-- ==========================================
-- 8. updated_at trigger para novas tabelas
-- ==========================================
CREATE OR REPLACE FUNCTION public.kids_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_kids_prayer_touch ON public.kids_prayer_requests;
CREATE TRIGGER trg_kids_prayer_touch BEFORE UPDATE ON public.kids_prayer_requests
  FOR EACH ROW EXECUTE FUNCTION public.kids_touch_updated_at();

DROP TRIGGER IF EXISTS trg_kids_events_touch ON public.kids_events;
CREATE TRIGGER trg_kids_events_touch BEFORE UPDATE ON public.kids_events
  FOR EACH ROW EXECUTE FUNCTION public.kids_touch_updated_at();

DROP TRIGGER IF EXISTS trg_kids_verses_touch ON public.kids_verses;
CREATE TRIGGER trg_kids_verses_touch BEFORE UPDATE ON public.kids_verses
  FOR EACH ROW EXECUTE FUNCTION public.kids_touch_updated_at();

DROP TRIGGER IF EXISTS trg_kids_pickups_touch ON public.kids_authorized_pickups;
CREATE TRIGGER trg_kids_pickups_touch BEFORE UPDATE ON public.kids_authorized_pickups
  FOR EACH ROW EXECUTE FUNCTION public.kids_touch_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.kids_prayer_requests;

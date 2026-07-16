
-- RPC: parent (18+) authorizes a minor to serve as volunteer/teacher
CREATE OR REPLACE FUNCTION public.authorize_minor(_minor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_bd date;
  minor_bd date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _minor_id = auth.uid() THEN RAISE EXCEPTION 'cannot authorize self'; END IF;

  SELECT birth_date INTO parent_bd FROM public.profiles WHERE id = auth.uid();
  IF parent_bd IS NULL OR public.is_minor(parent_bd) THEN
    RAISE EXCEPTION 'only adults (18+) can authorize a minor';
  END IF;

  SELECT birth_date INTO minor_bd FROM public.profiles WHERE id = _minor_id;
  IF minor_bd IS NULL THEN RAISE EXCEPTION 'minor has no birth date registered'; END IF;

  UPDATE public.profiles
  SET guardian_authorized_by = auth.uid(),
      guardian_authorized_at = now()
  WHERE id = _minor_id;
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_minor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_minor(uuid) TO authenticated;

-- RPC: self-register as teacher via church page token (reusable link)
CREATE OR REPLACE FUNCTION public.kids_self_register_teacher(_page_token text, _room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page_id uuid;
  v_bd date;
  v_auth uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT id INTO v_page_id FROM public.kids_pages WHERE static_qr_token = _page_token;
  IF v_page_id IS NULL THEN RAISE EXCEPTION 'invalid page token'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.kids_rooms WHERE id = _room_id AND page_id = v_page_id) THEN
    RAISE EXCEPTION 'room does not belong to this page';
  END IF;

  SELECT birth_date, guardian_authorized_by INTO v_bd, v_auth
  FROM public.profiles WHERE id = auth.uid();

  IF v_bd IS NULL THEN
    RAISE EXCEPTION 'complete your profile (birth date) first';
  END IF;
  IF public.is_minor(v_bd) AND v_auth IS NULL THEN
    RAISE EXCEPTION 'minors must be authorized by a parent/guardian';
  END IF;

  INSERT INTO public.kids_teacher_rooms (room_id, user_id, scope, invited_by)
  VALUES (_room_id, auth.uid(), 'kids_only', auth.uid())
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.kids_self_register_teacher(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kids_self_register_teacher(text, uuid) TO authenticated;

-- Lookup a page + rooms by token, so the teacher-join page can show available rooms
CREATE OR REPLACE FUNCTION public.kids_lookup_page_rooms_by_token(_token text)
RETURNS TABLE(page_id uuid, page_name text, room_id uuid, room_name text, age_min int, age_max int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, r.id, r.name, r.age_min, r.age_max
  FROM public.kids_pages p
  JOIN public.kids_rooms r ON r.page_id = p.id AND r.active = true
  WHERE p.static_qr_token = _token
  ORDER BY r.age_min;
$$;

REVOKE ALL ON FUNCTION public.kids_lookup_page_rooms_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kids_lookup_page_rooms_by_token(text) TO anon, authenticated;

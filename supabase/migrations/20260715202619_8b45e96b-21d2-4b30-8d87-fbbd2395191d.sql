DROP POLICY IF EXISTS "kids_rooms read public" ON public.kids_rooms;
REVOKE SELECT ON public.kids_rooms FROM anon;

CREATE OR REPLACE FUNCTION public.kids_lookup_room_by_static_token(_token text)
RETURNS TABLE(
  room_id uuid,
  room_name text,
  room_color text,
  page_id uuid,
  page_name text,
  consent_version text,
  consent_text text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.name, r.color, p.id, p.name, p.consent_version, p.consent_text
  FROM public.kids_rooms r
  JOIN public.kids_pages p ON p.id = r.page_id
  WHERE r.static_qr_token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.kids_lookup_room_by_static_token(text) TO anon, authenticated;

DROP POLICY IF EXISTS "kids_dynamic_tokens read for authenticated" ON public.kids_dynamic_tokens;

CREATE POLICY "kids_dynamic_tokens read teacher or leader"
ON public.kids_dynamic_tokens
FOR SELECT
TO authenticated
USING (
  public.is_kids_teacher_of_room(auth.uid(), room_id)
  OR EXISTS (
    SELECT 1 FROM public.kids_rooms r
    WHERE r.id = kids_dynamic_tokens.room_id
      AND public.is_kids_leader(auth.uid(), r.page_id)
  )
);
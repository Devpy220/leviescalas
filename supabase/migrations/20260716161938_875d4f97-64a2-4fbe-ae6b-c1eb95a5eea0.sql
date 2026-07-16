
-- Allow first registered user with a valid church code to claim leadership
CREATE OR REPLACE FUNCTION public.claim_church_leadership(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_id uuid;
  v_current_leader uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _code IS NULL OR length(trim(_code)) = 0 THEN RETURN NULL; END IF;

  SELECT id, leader_id INTO v_church_id, v_current_leader
  FROM public.churches
  WHERE upper(code) = upper(trim(_code))
  LIMIT 1;

  IF v_church_id IS NULL THEN RETURN NULL; END IF;

  IF v_current_leader IS NULL THEN
    UPDATE public.churches SET leader_id = auth.uid(), updated_at = now() WHERE id = v_church_id;
  END IF;

  RETURN v_church_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_church_leadership(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_church_leadership(text) TO authenticated;

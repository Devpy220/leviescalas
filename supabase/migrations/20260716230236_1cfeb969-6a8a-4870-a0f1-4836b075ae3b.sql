-- Add unique constraint: 1 kids page per church
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kids_pages_church_id_unique'
  ) THEN
    ALTER TABLE public.kids_pages ADD CONSTRAINT kids_pages_church_id_unique UNIQUE (church_id);
  END IF;
END $$;

-- RPC: given a church code, tell if a kids page already exists (for the join hub)
CREATE OR REPLACE FUNCTION public.church_hub_info(_code text)
RETURNS TABLE(church_id uuid, church_name text, has_kids_page boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, EXISTS (SELECT 1 FROM public.kids_pages kp WHERE kp.church_id = c.id)
  FROM public.churches c
  WHERE upper(c.code) = upper(trim(_code))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.church_hub_info(text) TO anon, authenticated;

-- RPC: create the kids page for a church using its code; caller becomes kids leader
CREATE OR REPLACE FUNCTION public.kids_create_page_by_church_code(_code text, _name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_id uuid;
  v_page_id uuid;
  v_slug text;
  v_consent text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _name IS NULL OR btrim(_name) = '' THEN RAISE EXCEPTION 'name required'; END IF;

  SELECT id INTO v_church_id
  FROM public.churches
  WHERE upper(code) = upper(trim(_code))
  LIMIT 1;

  IF v_church_id IS NULL THEN RAISE EXCEPTION 'church not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.kids_pages WHERE church_id = v_church_id) THEN
    RAISE EXCEPTION 'Esta igreja já possui uma página LeviKids';
  END IF;

  v_slug := lower(regexp_replace(btrim(_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := left(v_slug, 40) || '-' || substr(md5(random()::text), 1, 6);

  SELECT public.kids_default_consent_text() INTO v_consent;

  INSERT INTO public.kids_pages (church_id, name, slug, consent_version, consent_text, created_by)
  VALUES (v_church_id, btrim(_name), v_slug, '1.0', COALESCE(v_consent, 'Termo v1.0'), auth.uid())
  RETURNING id INTO v_page_id;

  INSERT INTO public.kids_leaders (page_id, user_id, invited_by)
  VALUES (v_page_id, auth.uid(), auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN v_page_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kids_create_page_by_church_code(text, text) TO authenticated;
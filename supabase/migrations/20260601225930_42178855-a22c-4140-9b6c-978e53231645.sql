CREATE OR REPLACE FUNCTION public.get_church_code_by_slug(p_slug text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT code FROM public.churches WHERE slug = p_slug LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_church_code_by_slug(text) TO anon, authenticated;
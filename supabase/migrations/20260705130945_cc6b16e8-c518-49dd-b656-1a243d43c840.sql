CREATE OR REPLACE FUNCTION public.get_church_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.churches;
$$;
GRANT EXECUTE ON FUNCTION public.get_church_count() TO anon, authenticated;
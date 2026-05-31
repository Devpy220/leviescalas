CREATE OR REPLACE FUNCTION public.get_user_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM public.profiles p
  WHERE EXISTS (SELECT 1 FROM public.members m WHERE m.user_id = p.id);
$$;
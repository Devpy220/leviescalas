-- Function to get all profiles for admin
CREATE OR REPLACE FUNCTION public.get_all_profiles_admin()
RETURNS TABLE(id uuid, name text, email text, whatsapp text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.email,
    p.whatsapp,
    p.created_at
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END;
$$;
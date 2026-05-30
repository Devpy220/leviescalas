CREATE OR REPLACE FUNCTION public.get_all_profiles_with_departments()
RETURNS TABLE(id uuid, name text, email text, whatsapp text, created_at timestamp with time zone, department_name text, church_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    p.created_at,
    (SELECT d.name FROM members m JOIN departments d ON m.department_id = d.id WHERE m.user_id = p.id LIMIT 1) as department_name,
    (SELECT c.name FROM members m JOIN departments d ON m.department_id = d.id JOIN churches c ON d.church_id = c.id WHERE m.user_id = p.id LIMIT 1) as church_name
  FROM public.profiles p
  WHERE EXISTS (SELECT 1 FROM public.members m WHERE m.user_id = p.id)
  ORDER BY p.created_at DESC;
END;
$function$;
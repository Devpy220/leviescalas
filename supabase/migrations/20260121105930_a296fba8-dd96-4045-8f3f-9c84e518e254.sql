
-- Function to get all profiles with their department and church info for admin
CREATE OR REPLACE FUNCTION public.get_all_profiles_with_departments()
RETURNS TABLE(
  id uuid,
  name text,
  email text,
  whatsapp text,
  created_at timestamp with time zone,
  department_name text,
  church_name text
)
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
    p.created_at,
    -- Get department name: first try members table, then fall back to invited_by_department_id
    COALESCE(
      (SELECT d.name FROM members m JOIN departments d ON m.department_id = d.id WHERE m.user_id = p.id LIMIT 1),
      (SELECT d.name FROM departments d WHERE d.id = p.invited_by_department_id)
    ) as department_name,
    -- Get church name from the department
    COALESCE(
      (SELECT c.name FROM members m JOIN departments d ON m.department_id = d.id JOIN churches c ON d.church_id = c.id WHERE m.user_id = p.id LIMIT 1),
      (SELECT c.name FROM departments d JOIN churches c ON d.church_id = c.id WHERE d.id = p.invited_by_department_id)
    ) as church_name
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END;
$$;

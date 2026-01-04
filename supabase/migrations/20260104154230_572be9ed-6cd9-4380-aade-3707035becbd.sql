-- Drop e recriar função get_department_basic para incluir church_id
DROP FUNCTION IF EXISTS public.get_department_basic(uuid);

CREATE FUNCTION public.get_department_basic(dept_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  leader_id uuid,
  subscription_status text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  avatar_url text,
  church_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_department_member(auth.uid(), dept_id) THEN
    RAISE EXCEPTION 'Acesso negado: você não pertence a este departamento';
  END IF;

  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.description,
    d.leader_id,
    d.subscription_status::TEXT,
    d.created_at,
    d.updated_at,
    d.avatar_url,
    d.church_id
  FROM departments d
  WHERE d.id = dept_id;
END;
$$;
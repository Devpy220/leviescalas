-- Drop the current policy that allows cross-department contact viewing
DROP POLICY IF EXISTS "Department members can view shared profiles" ON public.profiles;

-- Create a more restrictive policy - users can only view their own profile directly
-- All other access must go through secure functions
CREATE POLICY "Users can view own profile only"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Update the get_department_contacts function to also log access for auditing
CREATE OR REPLACE FUNCTION public.get_department_contacts(dept_id uuid)
RETURNS TABLE(id uuid, name text, avatar_url text, email text, whatsapp text, role text, share_contact boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify user belongs to the department
  IF NOT is_department_member(auth.uid(), dept_id) THEN
    RAISE EXCEPTION 'Acesso negado: você não pertence a este departamento';
  END IF;

  -- Log access to contacts (for auditing purposes)
  INSERT INTO profile_access_audit (accessor_user_id, accessed_profile_id, department_id)
  SELECT auth.uid(), p.id, dept_id
  FROM profiles p
  INNER JOIN members m ON m.user_id = p.id
  WHERE m.department_id = dept_id
  AND p.id != auth.uid()
  AND p.share_contact = TRUE
  ON CONFLICT DO NOTHING;

  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.avatar_url,
    CASE 
      WHEN p.id = auth.uid() OR p.share_contact = TRUE THEN p.email
      ELSE '***@***'::TEXT
    END as email,
    CASE 
      WHEN p.id = auth.uid() OR p.share_contact = TRUE THEN p.whatsapp
      ELSE '***'::TEXT
    END as whatsapp,
    m.role::TEXT,
    p.share_contact
  FROM profiles p
  INNER JOIN members m ON m.user_id = p.id
  WHERE m.department_id = dept_id
  ORDER BY m.role DESC, p.name;
END;
$$;

-- Add unique constraint to prevent duplicate audit logs
ALTER TABLE profile_access_audit 
ADD CONSTRAINT unique_access_per_session 
UNIQUE (accessor_user_id, accessed_profile_id, department_id);
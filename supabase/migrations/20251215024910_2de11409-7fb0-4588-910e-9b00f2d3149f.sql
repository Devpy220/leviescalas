-- Fix: Members should not see sensitive department data directly
-- The current policy allows members to see all fields including stripe data
-- Solution: Remove direct access for members, force them to use secure functions

-- Drop the broad policy
DROP POLICY IF EXISTS "Members can view department info" ON public.departments;

-- Leaders get full access
CREATE POLICY "Leaders can view and manage own departments"
ON public.departments
FOR ALL
USING (leader_id = auth.uid());

-- Members cannot directly SELECT departments - they must use secure functions
-- get_department_basic: for basic info (no stripe/invite data)
-- get_department_secure: for leaders only (includes sensitive data)

-- Ensure get_department_basic doesn't expose sensitive data (already correct)
-- Ensure get_department_member_profiles works (uses is_department_member check)

-- Update get_department_for_member to not include invite_code for non-leaders
CREATE OR REPLACE FUNCTION public.get_department_for_member(dept_id uuid)
RETURNS TABLE(id uuid, name text, description text, leader_id uuid, invite_code text, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    d.id, 
    d.name, 
    d.description, 
    d.leader_id,
    CASE 
      WHEN d.leader_id = auth.uid() THEN d.invite_code 
      ELSE NULL 
    END as invite_code,
    d.created_at,
    d.updated_at
  FROM public.departments d
  WHERE d.id = dept_id
  AND is_department_member(auth.uid(), d.id);
$$;
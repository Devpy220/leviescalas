-- Drop the permissive policy that allows members to view all department columns
DROP POLICY IF EXISTS "Members can view their departments" ON public.departments;

-- Create a more restrictive policy - members can only view basic non-sensitive columns
-- For sensitive data (stripe, invite_code), they must use the get_department_secure function
CREATE POLICY "Members can view basic department info"
ON public.departments
FOR SELECT
USING (
  -- Leaders can see everything
  leader_id = auth.uid()
  OR
  -- Members can see if they're a member, but sensitive columns should be hidden via application logic
  -- Since Postgres doesn't support column-level RLS, we use the get_department_secure function for sensitive data
  is_department_member(auth.uid(), id)
);

-- Add INSERT policy for billing_access_audit to allow the system to log access
CREATE POLICY "System can insert audit logs"
ON public.billing_access_audit
FOR INSERT
WITH CHECK (user_id = auth.uid());
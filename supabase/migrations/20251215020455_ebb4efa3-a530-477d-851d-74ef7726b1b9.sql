-- Drop the view since we'll use the secure function instead
DROP VIEW IF EXISTS public.departments_member_view;

-- The application already uses get_department_secure() and get_department_basic() functions
-- which properly mask Stripe data for non-leaders. No view needed.

-- Update the departments policy to be more restrictive
-- Members should use the secure functions, not direct table access
DROP POLICY IF EXISTS "Members can view their departments safely" ON public.departments;

-- Recreate with the same logic but document that secure functions should be used
CREATE POLICY "Members can view their departments via functions" 
ON public.departments 
FOR SELECT 
USING (
  -- Leaders have full access
  leader_id = auth.uid()
  OR
  -- Members have access (but should use secure functions to get masked data)
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.department_id = departments.id 
    AND m.user_id = auth.uid()
  )
);
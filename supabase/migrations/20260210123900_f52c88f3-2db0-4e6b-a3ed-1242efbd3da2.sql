-- Remove the overly broad "Require authentication for departments" policy
-- This policy allows ANY authenticated user to access ALL departments (including invite codes, Stripe IDs)
-- The existing leader-specific policies already properly restrict access
DROP POLICY IF EXISTS "Require authentication for departments" ON public.departments;

-- Also remove duplicate policy (two ALL policies for leaders doing the same thing)
DROP POLICY IF EXISTS "Leaders can view and manage own departments" ON public.departments;

-- Add a member SELECT policy so members can view their department (without exposing invite_code/stripe data to all)
CREATE POLICY "Members can view their departments"
ON public.departments
FOR SELECT
USING (
  is_department_member(auth.uid(), id)
);

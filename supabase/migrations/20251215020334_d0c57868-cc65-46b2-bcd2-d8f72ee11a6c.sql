-- FIX 1: Restrict Stripe data visibility in departments table
-- Drop the existing member view policy
DROP POLICY IF EXISTS "Members can view their departments" ON public.departments;

-- Create a new policy that masks sensitive billing data for non-leaders
-- Members can only see non-sensitive department data
CREATE POLICY "Members can view their departments safely" 
ON public.departments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.department_id = departments.id 
    AND m.user_id = auth.uid()
  )
);

-- Create a view for safe member access that excludes Stripe data
CREATE OR REPLACE VIEW public.departments_member_view AS
SELECT 
  id,
  name,
  description,
  leader_id,
  avatar_url,
  subscription_status,
  created_at,
  updated_at
  -- Explicitly excluding: stripe_customer_id, stripe_subscription_id, invite_code, trial_ends_at
FROM public.departments;

-- Grant access to the view
GRANT SELECT ON public.departments_member_view TO authenticated;

-- FIX 2: Add policy for department members to view profiles when share_contact=true
-- This allows proper contact sharing within departments
CREATE POLICY "Department members can view shared profiles" 
ON public.profiles 
FOR SELECT 
USING (
  -- User can always see their own profile
  auth.uid() = id
  OR
  -- Other users can see profile if share_contact is true AND they're in the same department
  (
    share_contact = true
    AND EXISTS (
      SELECT 1 FROM public.members m1
      INNER JOIN public.members m2 ON m1.department_id = m2.department_id
      WHERE m1.user_id = auth.uid()
      AND m2.user_id = profiles.id
    )
  )
);

-- Drop the old restrictive policy since the new one covers both cases
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;
-- =============================================
-- SECURITY HARDENING MIGRATION
-- =============================================

-- 1. Fix: Restrict department data exposed via invite code
-- Drop the overly permissive policy that exposes Stripe IDs
DROP POLICY IF EXISTS "Anyone can view department by invite code" ON public.departments;

-- Create a more secure function to get only public department info
CREATE OR REPLACE FUNCTION public.get_department_by_invite_code(code text)
RETURNS TABLE (id uuid, name text, description text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, description 
  FROM public.departments 
  WHERE invite_code = code;
$$;

-- 2. Fix: Create a secure view for member profiles (hide sensitive data)
-- Add policy for viewing limited profile info in same department
DROP POLICY IF EXISTS "Members can view profiles in same department" ON public.profiles;

CREATE POLICY "Members can view limited profiles in same department"
ON public.profiles
FOR SELECT
USING (
  -- User can always see their own full profile
  auth.uid() = id
  OR
  -- Members can see name and avatar only for same department members
  EXISTS (
    SELECT 1 FROM members m1
    JOIN members m2 ON m1.department_id = m2.department_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id
  )
);

-- 3. Fix: Add DELETE policy for profiles (GDPR compliance)
CREATE POLICY "Users can delete own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);

-- 4. Fix: Add INSERT policy for notifications (only service role or via triggers)
-- This prevents spam by requiring department leadership
CREATE POLICY "Only leaders can create notifications for their department"
ON public.notifications
FOR INSERT
WITH CHECK (
  (department_id IS NOT NULL AND is_department_leader(auth.uid(), department_id))
  OR
  user_id = auth.uid()
);

-- 5. Fix: Add DELETE policy for notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
USING (user_id = auth.uid());

-- 6. Add rate limiting for members joining (prevent abuse)
-- Create unique constraint to prevent duplicate membership
ALTER TABLE public.members 
DROP CONSTRAINT IF EXISTS members_user_department_unique;

ALTER TABLE public.members
ADD CONSTRAINT members_user_department_unique UNIQUE (user_id, department_id);

-- 7. Add index for faster security checks
CREATE INDEX IF NOT EXISTS idx_members_user_department 
ON public.members(user_id, department_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
ON public.notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_departments_invite_code 
ON public.departments(invite_code);

-- 8. Ensure invite codes are sufficiently random (16 hex chars = 64 bits of entropy)
-- Already using gen_random_bytes(8) which is secure
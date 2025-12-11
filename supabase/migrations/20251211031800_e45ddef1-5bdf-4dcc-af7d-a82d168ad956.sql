-- =============================================
-- SECURITY HARDENING MIGRATION - PHASE 2
-- =============================================

-- 1. Fix conflicting RESTRICTIVE policies on profiles
-- Drop the conflicting policies and create proper PERMISSIVE ones
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Members can view limited profiles in same department" ON public.profiles;

-- Create a combined PERMISSIVE policy for SELECT
CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- User can always see their own full profile
  auth.uid() = id
  OR
  -- Members can see profiles of same department members
  EXISTS (
    SELECT 1 FROM members m1
    JOIN members m2 ON m1.department_id = m2.department_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id
  )
);

-- 2. Create a secure function to get limited profile info (no email/whatsapp)
CREATE OR REPLACE FUNCTION public.get_member_profile(member_user_id uuid)
RETURNS TABLE (id uuid, name text, avatar_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.avatar_url 
  FROM public.profiles p
  WHERE p.id = member_user_id;
$$;

-- 3. Update departments policy to hide billing info from regular members
-- Create function to get safe department data for members
CREATE OR REPLACE FUNCTION public.get_department_for_member(dept_id uuid)
RETURNS TABLE (
  id uuid, 
  name text, 
  description text, 
  leader_id uuid,
  invite_code text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
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

-- 4. Create secure function for leaders to get full department with billing
CREATE OR REPLACE FUNCTION public.get_department_full(dept_id uuid)
RETURNS TABLE (
  id uuid, 
  name text, 
  description text, 
  leader_id uuid,
  invite_code text,
  subscription_status text,
  stripe_subscription_id text,
  stripe_customer_id text,
  trial_ends_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    d.id, 
    d.name, 
    d.description, 
    d.leader_id,
    d.invite_code,
    d.subscription_status::text,
    d.stripe_subscription_id,
    d.stripe_customer_id,
    d.trial_ends_at,
    d.created_at,
    d.updated_at
  FROM public.departments d
  WHERE d.id = dept_id
  AND d.leader_id = auth.uid();
$$;
-- ============================================
-- FIX 1: Schedules - Hide confirmation_token from regular members
-- Create a secure function to get schedules with token masking
-- ============================================

-- Function to get schedules with proper token masking for non-owners
CREATE OR REPLACE FUNCTION public.get_department_schedules_secure(dept_id uuid)
RETURNS TABLE(
  id uuid,
  department_id uuid,
  user_id uuid,
  date date,
  time_start time without time zone,
  time_end time without time zone,
  created_by uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  sector_id uuid,
  confirmation_status text,
  confirmed_at timestamp with time zone,
  notes text,
  confirmation_token text,
  decline_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user is a member of the department
  IF NOT is_department_member(auth.uid(), dept_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this department';
  END IF;

  RETURN QUERY
  SELECT 
    s.id,
    s.department_id,
    s.user_id,
    s.date,
    s.time_start,
    s.time_end,
    s.created_by,
    s.created_at,
    s.updated_at,
    s.sector_id,
    s.confirmation_status::text,
    s.confirmed_at,
    -- Notes: visible to schedule owner, creator, or leader
    CASE 
      WHEN s.user_id = auth.uid() 
        OR s.created_by = auth.uid() 
        OR is_department_leader(auth.uid(), s.department_id) 
      THEN s.notes
      ELSE NULL
    END as notes,
    -- Token: ONLY visible to schedule owner or leader
    CASE 
      WHEN s.user_id = auth.uid() 
        OR is_department_leader(auth.uid(), s.department_id) 
      THEN s.confirmation_token
      ELSE NULL
    END as confirmation_token,
    -- Decline reason: visible to leader or schedule owner
    CASE 
      WHEN s.user_id = auth.uid() 
        OR is_department_leader(auth.uid(), s.department_id) 
      THEN s.decline_reason
      ELSE NULL
    END as decline_reason
  FROM schedules s
  WHERE s.department_id = dept_id;
END;
$$;

-- ============================================
-- FIX 2: Profiles - Remove overly permissive policy
-- Only allow viewing own profile; use secure functions for shared access
-- ============================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles;

-- The existing "Users can view own profile only" policy already exists and is correct
-- But let's ensure it uses RESTRICTIVE to work correctly with other policies
-- First check if we need to recreate it
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;

CREATE POLICY "Users can view own profile only"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- ============================================
-- FIX 3: Churches - Verify access control is tight
-- The existing policies look correct but let's ensure no gaps
-- ============================================

-- Remove any overly permissive policies if they exist
DROP POLICY IF EXISTS "Require authentication for churches" ON public.churches;

-- Ensure the restrictive SELECT policies are in place
-- The existing policies are already correct:
-- - "Leaders can view own churches" - uses (leader_id = auth.uid())
-- - "Members can view church via department" - uses department membership check

-- Add explicit index for better query performance on membership checks
CREATE INDEX IF NOT EXISTS idx_members_user_department ON public.members(user_id, department_id);
CREATE INDEX IF NOT EXISTS idx_departments_church_id ON public.departments(church_id);

-- ============================================
-- Additional: Create secure view for schedules that masks tokens
-- ============================================
DROP VIEW IF EXISTS public.schedules_public;
CREATE VIEW public.schedules_public
WITH (security_invoker = on) AS
SELECT 
  s.id,
  s.department_id,
  s.user_id,
  s.date,
  s.time_start,
  s.time_end,
  s.created_by,
  s.created_at,
  s.updated_at,
  s.sector_id,
  s.confirmation_status,
  s.confirmed_at,
  -- Mask sensitive fields for non-owners
  CASE 
    WHEN s.user_id = auth.uid() 
      OR is_department_leader(auth.uid(), s.department_id) 
    THEN s.notes
    ELSE NULL
  END as notes,
  CASE 
    WHEN s.user_id = auth.uid() 
      OR is_department_leader(auth.uid(), s.department_id) 
    THEN s.confirmation_token
    ELSE NULL
  END as confirmation_token,
  CASE 
    WHEN s.user_id = auth.uid() 
      OR is_department_leader(auth.uid(), s.department_id) 
    THEN s.decline_reason
    ELSE NULL
  END as decline_reason
FROM schedules s;
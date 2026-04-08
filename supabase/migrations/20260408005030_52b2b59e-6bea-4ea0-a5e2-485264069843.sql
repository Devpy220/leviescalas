-- Fix 1: Remove the overly permissive SELECT policy on pushalert_subscribers
DROP POLICY IF EXISTS "Service role can read all subscribers" ON public.pushalert_subscribers;

-- Fix 2: Create a proper service-role-only policy
CREATE POLICY "Service role can read all subscribers"
ON public.pushalert_subscribers
FOR SELECT
TO service_role
USING (true);

-- Fix 3: Create a secure view for churches that hides registrant data from members
CREATE OR REPLACE VIEW public.churches_member_view AS
SELECT 
  id, name, description, logo_url, address, city, state, slug, code, leader_id, created_at, updated_at
FROM public.churches;
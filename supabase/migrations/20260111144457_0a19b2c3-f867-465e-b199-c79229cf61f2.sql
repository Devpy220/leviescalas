-- Fix the permissive INSERT policy on billing_access_audit
-- This policy should only allow service_role to insert, not everyone

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.billing_access_audit;

-- Create a proper policy that restricts to service_role only
CREATE POLICY "Service role can insert audit logs"
ON public.billing_access_audit
FOR INSERT
TO service_role
WITH CHECK (true);

-- Note: For page_views, the permissive INSERT is intentional for public analytics tracking
-- The data is non-sensitive (page path, user agent, referrer) and needs to track anonymous visitors
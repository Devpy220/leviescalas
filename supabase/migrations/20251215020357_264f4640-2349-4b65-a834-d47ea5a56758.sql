-- Fix the security definer view issue by using SECURITY INVOKER
DROP VIEW IF EXISTS public.departments_member_view;

-- Recreate view with SECURITY INVOKER (uses querying user's permissions)
CREATE VIEW public.departments_member_view 
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  description,
  leader_id,
  avatar_url,
  subscription_status,
  created_at,
  updated_at
FROM public.departments;

-- Grant access to the view
GRANT SELECT ON public.departments_member_view TO authenticated;
-- Cakto payments were removed from LEVI (PIX only)
DROP TABLE IF EXISTS public.donations;
DROP TABLE IF EXISTS public.cakto_offers;
DROP TABLE IF EXISTS public.cakto_products;

-- Blackout-day limit no longer exists: remove it from the view and the table
DROP VIEW IF EXISTS public.departments_safe;
ALTER TABLE public.departments DROP COLUMN IF EXISTS max_blackout_dates;
CREATE VIEW public.departments_safe WITH (security_invoker = on) AS
  SELECT id, name, description, leader_id, subscription_status, trial_ends_at,
         created_at, updated_at, avatar_url, church_id, allow_sunday_double
  FROM public.departments d
  WHERE public.is_department_member(auth.uid(), id)
     OR leader_id = auth.uid()
     OR public.has_role(auth.uid(), 'admin'::public.app_role);
GRANT SELECT ON public.departments_safe TO authenticated;
GRANT SELECT ON public.departments_safe TO service_role;

-- Database functions not used by the app, the WhatsApp bot or other functions
DROP FUNCTION IF EXISTS public.check_rate_limit(p_user_id uuid, p_endpoint text, p_max_requests integer, p_window_minutes integer);
DROP FUNCTION IF EXISTS public.get_all_profiles_admin();
DROP FUNCTION IF EXISTS public.get_billing_audit_logs(dept_id uuid, limit_count integer);
DROP FUNCTION IF EXISTS public.get_department_contacts(dept_id uuid);
DROP FUNCTION IF EXISTS public.get_department_for_member(dept_id uuid);
DROP FUNCTION IF EXISTS public.get_department_full(dept_id uuid);
DROP FUNCTION IF EXISTS public.get_schedule_for_user(dept_id uuid, target_user_id uuid);
DROP FUNCTION IF EXISTS public.log_billing_audit(p_user_id uuid, p_department_id uuid, p_action text, p_ip_address text, p_user_agent text);
DROP FUNCTION IF EXISTS public.validate_invite_code_secure(code text);

-- Revoke EXECUTE from anon on all SECURITY DEFINER functions in public,
-- then re-grant only for the ones that are legitimately public-facing.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

-- Re-grant EXECUTE to anon ONLY for functions that are legitimately public
GRANT EXECUTE ON FUNCTION public.check_rate_limit_public(text, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_church_public(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_church_departments_public(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_church_schedules_public(uuid, date, date) TO anon;
GRANT EXECUTE ON FUNCTION public.get_church_invite_info(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_church_code_by_slug(text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_church_code_secure(text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_invite_code_secure(text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_coordinator_code_secure(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_church_count() TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_count() TO anon;

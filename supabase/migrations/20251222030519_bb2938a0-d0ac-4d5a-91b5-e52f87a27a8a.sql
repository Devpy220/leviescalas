-- Ensure the designated admin email automatically receives the 'admin' role
-- This avoids client-side inserts (blocked by RLS) and prevents /admin <-> /admin-login redirect loops.

CREATE OR REPLACE FUNCTION public.ensure_admin_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_email text;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  -- Only bootstrap for the designated admin email
  IF jwt_email <> lower('leviescalas@gmail.com') THEN
    RETURN false;
  END IF;

  -- Insert role if missing (requires a unique constraint on (user_id, role))
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_admin_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_admin_role() TO authenticated;
CREATE OR REPLACE FUNCTION public.ensure_admin_role()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  jwt_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  IF jwt_email <> lower('elsdigital@elsdigital.tech') THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$function$;
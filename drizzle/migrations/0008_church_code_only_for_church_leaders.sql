-- The church code is the permission to create departments in a church:
-- only the church leader (or an admin) can read it from the church page link.
CREATE OR REPLACE FUNCTION public.get_church_code_by_slug(p_slug text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.code FROM public.churches c
  WHERE c.slug = p_slug
    AND auth.uid() IS NOT NULL
    AND (c.leader_id = auth.uid()
         OR public.is_church_leader(auth.uid(), c.id)
         OR public.has_role(auth.uid(), 'admin'::public.app_role))
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_church_code_by_slug(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_church_code_by_slug(text) TO authenticated, service_role;
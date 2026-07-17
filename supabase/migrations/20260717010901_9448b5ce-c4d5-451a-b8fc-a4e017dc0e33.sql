
-- Revoga leitura direta dos c\u00f3digos secretos. Fun\u00e7\u00f5es SECURITY DEFINER continuam retornando para o l\u00edder.
REVOKE SELECT (invite_code, coordinator_invite_code) ON public.departments FROM authenticated;
REVOKE SELECT (invite_code, coordinator_invite_code) ON public.departments FROM anon;
-- service_role mant\u00e9m tudo (ALL).

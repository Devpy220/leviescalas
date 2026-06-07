-- Revoke direct column-level read access on sensitive fields from regular users.
-- Leaders/admins should fetch these via the get_department_secure SECURITY DEFINER RPC,
-- and the existing departments_safe view continues to expose only non-sensitive fields.
REVOKE SELECT (invite_code, coordinator_invite_code, stripe_customer_id, stripe_subscription_id)
  ON public.departments FROM PUBLIC;
REVOKE SELECT (invite_code, coordinator_invite_code, stripe_customer_id, stripe_subscription_id)
  ON public.departments FROM anon;
REVOKE SELECT (invite_code, coordinator_invite_code, stripe_customer_id, stripe_subscription_id)
  ON public.departments FROM authenticated;

-- Make sure service_role and postgres still have full access for edge functions / admin tasks.
GRANT SELECT ON public.departments TO service_role;
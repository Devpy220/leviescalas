
-- 1) Revoke column-level SELECT on sensitive department columns from anon/authenticated
REVOKE SELECT (invite_code, coordinator_invite_code, stripe_customer_id, stripe_subscription_id)
  ON public.departments FROM anon, authenticated;

-- Re-grant safe columns explicitly so SELECT(non-sensitive cols) continues to work
GRANT SELECT (id, name, description, leader_id, subscription_status, trial_ends_at,
              created_at, updated_at, avatar_url, church_id, allow_sunday_double,
              max_blackout_dates)
  ON public.departments TO authenticated;
GRANT SELECT (id, name, description, leader_id, avatar_url, church_id)
  ON public.departments TO anon;

-- 2) Tighten profiles cross-member visibility to honour share_contact
DROP POLICY IF EXISTS "Shared department members can view profiles" ON public.profiles;
CREATE POLICY "Shared department members can view profiles (opt-in)"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR (share_department_with(auth.uid(), id) AND share_contact = true)
  );

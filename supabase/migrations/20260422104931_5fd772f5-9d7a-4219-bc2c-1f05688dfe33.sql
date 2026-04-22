
-- 1. Fix departments policy: the prior IS NULL filter was wrong (filters rows, not columns).
-- Restore broad member visibility on the row; billing columns are already masked via RPC
-- (get_department_basic / get_department_secure) and never selected directly by member UI.
DROP POLICY IF EXISTS "Members can view department non-billing fields" ON public.departments;

CREATE POLICY "Members can view their departments"
ON public.departments
FOR SELECT
TO authenticated
USING (is_department_member(auth.uid(), id));

-- Revoke direct column access to stripe_* for the authenticated role so members cannot
-- read billing identifiers even if they query the table directly. Leaders use the
-- "Leaders can manage own departments" ALL policy which still grants full access via
-- table ownership grants; we keep grants on stripe_* only for leaders by checking inside
-- a SECURITY DEFINER function. Postgres column privileges are role-wide, so to keep this
-- simple we revoke from authenticated and rely on the existing get_department_full /
-- get_department_secure RPCs (SECURITY DEFINER) for leader access.
REVOKE SELECT (stripe_customer_id, stripe_subscription_id, trial_ends_at)
  ON public.departments FROM authenticated;

-- 2. Restrict realtime.messages so authenticated users can only subscribe to topics
-- that match a department they belong to. Convention: topics for department-scoped
-- channels start with "dept:<uuid>".
DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can publish realtime" ON realtime.messages;

CREATE POLICY "Authenticated can receive scoped realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Allow user-private topics ("user:<auth.uid()>")
  realtime.topic() = ('user:' || auth.uid()::text)
  OR
  -- Allow department-scoped topics only if the user is a member
  (
    realtime.topic() LIKE 'dept:%'
    AND public.is_department_member(
      auth.uid(),
      NULLIF(substring(realtime.topic() from 6), '')::uuid
    )
  )
);

CREATE POLICY "Authenticated can publish scoped realtime"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = ('user:' || auth.uid()::text)
  OR
  (
    realtime.topic() LIKE 'dept:%'
    AND public.is_department_member(
      auth.uid(),
      NULLIF(substring(realtime.topic() from 6), '')::uuid
    )
  )
);

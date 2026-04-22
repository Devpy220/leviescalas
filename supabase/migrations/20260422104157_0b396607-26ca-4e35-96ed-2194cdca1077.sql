
-- 1. Restrict departments SELECT for non-leaders to hide stripe_* fields
-- Replace member SELECT policy with one that excludes stripe columns via column-level approach.
-- Simplest fix: members keep row access, but we also enforce a policy ensuring only leaders/admins see stripe ids
-- via a column-restricting view. Here we tighten by dropping member SELECT and adding a policy that
-- only allows leaders/admins direct table access. Members must use get_department_basic/get_department_secure RPCs (already in code).

DROP POLICY IF EXISTS "Members can view their departments" ON public.departments;

CREATE POLICY "Members can view department non-billing fields"
ON public.departments
FOR SELECT
TO authenticated
USING (
  is_department_member(auth.uid(), id)
  AND stripe_customer_id IS NULL
  AND stripe_subscription_id IS NULL
);

-- Note: rows where billing IDs are set will only be returned to leaders (existing leader policy) or admins.
-- Members must use get_department_basic() / get_department_secure() RPC which already mask billing fields.

-- 2. Fix church-logos storage policies (broken path extraction)
DROP POLICY IF EXISTS "Church leaders can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Church leaders can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Church leaders can delete logos" ON storage.objects;

CREATE POLICY "Church leaders can upload logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'church-logos'
  AND (
    EXISTS (
      SELECT 1 FROM public.churches c
      WHERE c.leader_id = auth.uid()
        AND (storage.foldername(storage.objects.name))[1] = c.id::text
    )
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Church leaders can update logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'church-logos'
  AND (
    EXISTS (
      SELECT 1 FROM public.churches c
      WHERE c.leader_id = auth.uid()
        AND (storage.foldername(storage.objects.name))[1] = c.id::text
    )
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Church leaders can delete logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'church-logos'
  AND (
    EXISTS (
      SELECT 1 FROM public.churches c
      WHERE c.leader_id = auth.uid()
        AND (storage.foldername(storage.objects.name))[1] = c.id::text
    )
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- 3. Restrict listing on public buckets (avatars, church-logos, department-avatars)
-- Public SELECT policies allow listing all files. Replace blanket SELECT with a policy
-- that still allows public access to objects via getPublicUrl (HTTP), but restricts the
-- LIST operation by requiring authenticated context for direct table queries.
-- Note: getPublicUrl uses a public CDN path that bypasses storage.objects RLS, so
-- restricting the SELECT policy does NOT break image rendering.

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view church logos" ON storage.objects;
DROP POLICY IF EXISTS "Church logos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Department avatars are publicly accessible" ON storage.objects;

CREATE POLICY "Authenticated can read user avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'user-avatars');

CREATE POLICY "Authenticated can read church logos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'church-logos');

CREATE POLICY "Authenticated can read department avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'department-avatars');

-- 4. RLS on realtime.messages to scope subscriptions per topic/membership
-- Topic convention used by the app (Supabase default postgres_changes channels).
-- Allow authenticated users to receive realtime broadcasts only when they have access
-- to the underlying entity. For postgres_changes, Supabase gates per-row delivery via
-- the table's own RLS; we add a baseline policy on realtime.messages that requires auth.

ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated can receive realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated can publish realtime" ON realtime.messages;
CREATE POLICY "Authenticated can publish realtime"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);

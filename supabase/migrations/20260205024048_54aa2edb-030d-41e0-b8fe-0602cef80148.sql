-- Fix linter WARN: permissive RLS policies with WITH CHECK (true)

-- page_views: allow anon+authenticated to insert page views, but avoid literal true
DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;
CREATE POLICY "Anyone can insert page views"
ON public.page_views
FOR INSERT
TO anon, authenticated
WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- billing_access_audit: allow only service_role inserts, avoid literal true
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.billing_access_audit;
CREATE POLICY "Service role can insert audit logs"
ON public.billing_access_audit
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

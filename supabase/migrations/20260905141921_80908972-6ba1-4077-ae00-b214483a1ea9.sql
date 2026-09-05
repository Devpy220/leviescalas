REVOKE SELECT ON public.departments FROM authenticated, anon;

GRANT SELECT (id, name, description, leader_id, subscription_status, trial_ends_at, created_at, updated_at, avatar_url, church_id, max_blackout_dates, allow_sunday_double, kids_linked, kids_page_id, repertoire_enabled)
ON public.departments TO authenticated;

GRANT SELECT (id, name, description, leader_id, created_at, updated_at, avatar_url, church_id, kids_linked, kids_page_id)
ON public.departments TO anon;
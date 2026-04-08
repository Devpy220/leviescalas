DROP VIEW IF EXISTS public.churches_member_view;

CREATE VIEW public.churches_member_view
WITH (security_invoker = on)
AS
SELECT 
  id, name, description, logo_url, address, city, state, slug, code, leader_id, created_at, updated_at
FROM public.churches;
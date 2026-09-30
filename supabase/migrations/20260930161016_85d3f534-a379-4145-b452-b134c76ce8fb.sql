CREATE OR REPLACE FUNCTION public.admin_church_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'city', c.city, 'state', c.state, 'country', c.country, 'code', c.code,
    'departments', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', d.id, 'name', d.name,
        'members', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'user_id', m.user_id, 'role', m.role, 'name', p.name, 'whatsapp', p.whatsapp) ORDER BY p.name)
          FROM members m LEFT JOIN profiles p ON p.id = m.user_id WHERE m.department_id = d.id), '[]'::jsonb)
      ) ORDER BY d.name) FROM departments d WHERE d.church_id = c.id), '[]'::jsonb),
    'kids', (SELECT jsonb_build_object('id', kp.id, 'name', kp.name, 'slug', kp.slug,
        'rooms', (SELECT count(*) FROM kids_rooms r WHERE r.page_id = kp.id),
        'children', (SELECT count(*) FROM kids_children k WHERE k.page_id = kp.id),
        'leaders', (SELECT count(*) FROM kids_leaders l WHERE l.page_id = kp.id))
      FROM kids_pages kp WHERE kp.church_id = c.id LIMIT 1)
  ) ORDER BY c.name) FROM churches c), '[]'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_kids_page(page_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE departments SET kids_page_id = NULL, kids_linked = false WHERE kids_page_id = admin_delete_kids_page.page_id;
  DELETE FROM kids_pages WHERE id = admin_delete_kids_page.page_id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_church(church_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Unauthorized: Admin access required'; END IF;
  UPDATE departments SET kids_page_id = NULL WHERE departments.church_id = admin_delete_church.church_id;
  DELETE FROM kids_pages WHERE kids_pages.church_id = admin_delete_church.church_id;
  DELETE FROM departments WHERE departments.church_id = admin_delete_church.church_id;
  DELETE FROM churches WHERE id = admin_delete_church.church_id;
  RETURN true;
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_church_overview() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_delete_kids_page(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_church_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_kids_page(uuid) TO authenticated;
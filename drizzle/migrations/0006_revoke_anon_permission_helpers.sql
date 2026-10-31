-- Permission helpers are only needed for signed-in users and server code;
-- signed-out visitors must not be able to probe who leads or teaches where.
REVOKE EXECUTE ON FUNCTION public.is_church_leader(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_guardian_of(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_kids_guardian_of_page(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_kids_leader(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_kids_teacher_of_page(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_kids_teacher_of_room(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_kids_teacher_scheduled_today(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.kids_is_within_service_window(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_church_leader(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_guardian_of(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_kids_guardian_of_page(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_kids_leader(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_kids_teacher_of_page(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_kids_teacher_of_room(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_kids_teacher_scheduled_today(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kids_is_within_service_window(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_department_by_invite_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_department_by_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_church_invite_info(text) TO anon, authenticated;
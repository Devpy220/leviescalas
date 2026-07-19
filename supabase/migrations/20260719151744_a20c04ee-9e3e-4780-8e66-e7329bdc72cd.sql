
REVOKE EXECUTE ON FUNCTION public.kids_set_child_pin(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.kids_verify_child_pin(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.kids_generate_precheckin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.kids_consume_precheckin(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.kids_set_child_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kids_verify_child_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kids_generate_precheckin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kids_consume_precheckin(text) TO authenticated;

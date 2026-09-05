REVOKE EXECUTE ON FUNCTION public.export_my_data() FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_whatsapp_consent(text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_data_subject_request(public.dsr_kind, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_whatsapp_consent(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_data_subject_request(public.dsr_kind, text) TO authenticated;
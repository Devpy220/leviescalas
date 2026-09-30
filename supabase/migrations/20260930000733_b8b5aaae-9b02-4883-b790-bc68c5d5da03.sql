-- Trigger functions: never called directly by clients (triggers still fire).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_schedule_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_cross_department_schedule_conflict() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_department_billing_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_schedule_for_blocked_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_kids_pages_ensure_dept() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_kids_teacher_sync_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_members_sync_kids_teacher() FROM PUBLIC, anon, authenticated;

-- Functions that only make sense for signed-in users: remove visitor access.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'create_data_subject_request','delete_my_account','ensure_kids_department','export_my_data',
      'get_my_blocked','set_my_blocked','record_whatsapp_consent',
      'kids_child_attendance','kids_create_page_by_church_code','kids_get_linked_department',
      'kids_get_or_create_dyn_token','kids_perform_checkin','kids_perform_checkin_by_page',
      'kids_perform_checkin_static','kids_perform_checkout','kids_report_dropoff','kids_report_needs',
      'kids_report_visitors','kids_teacher_rooms_today','kids_transfer_child')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;
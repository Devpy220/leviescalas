-- Internal WhatsApp-only helper: must not be callable from the app
REVOKE EXECUTE ON FUNCTION public.unblock_member_by_phone(text) FROM anon, authenticated, PUBLIC;

-- Trigger functions never need direct EXECUTE
REVOKE EXECUTE ON FUNCTION public.prevent_department_billing_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_kids_pages_ensure_dept() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_kids_teacher_sync_member() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_members_sync_kids_teacher() FROM anon, authenticated, PUBLIC;

-- Kids operations require a signed-in user
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'ensure_kids_department','kids_create_page_by_church_code','kids_transfer_child',
        'kids_perform_checkin','kids_perform_checkin_by_page','kids_perform_checkin_static',
        'kids_perform_checkout','kids_report_dropoff','kids_report_needs','kids_report_visitors',
        'kids_child_attendance','kids_get_or_create_dyn_token','kids_teacher_rooms_today',
        'set_my_blocked','get_my_blocked'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
END $$;
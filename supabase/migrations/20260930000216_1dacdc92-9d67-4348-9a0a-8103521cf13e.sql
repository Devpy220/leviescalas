CREATE OR REPLACE FUNCTION public.delete_account_by_id(_uid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _phone text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.departments WHERE leader_id = _uid) THEN
    RETURN 'is_leader';
  END IF;
  SELECT whatsapp INTO _phone FROM public.profiles WHERE id = _uid;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  DELETE FROM public.schedule_swaps WHERE requester_user_id = _uid OR target_user_id = _uid;
  DELETE FROM public.whatsapp_swap_sessions WHERE user_id = _uid;
  DELETE FROM public.schedules WHERE user_id = _uid;
  DELETE FROM public.member_availability WHERE user_id = _uid;
  DELETE FROM public.member_date_availability WHERE user_id = _uid;
  DELETE FROM public.member_preferences WHERE user_id = _uid;
  DELETE FROM public.notifications WHERE user_id = _uid;
  DELETE FROM public.members WHERE user_id = _uid;
  DELETE FROM public.department_coordinators WHERE user_id = _uid;
  DELETE FROM public.login_logs WHERE user_id = _uid;
  DELETE FROM public.calendar_sync_tokens WHERE user_id = _uid;
  DELETE FROM public.webauthn_credentials WHERE user_id = _uid;
  DELETE FROM public.blackout_collection_prompts WHERE user_id = _uid;
  IF _phone IS NOT NULL AND _phone <> '' THEN
    DELETE FROM public.whatsapp_queue WHERE phone = _phone;
    DELETE FROM public.whatsapp_logs WHERE phone = _phone;
  END IF;
  UPDATE public.data_subject_requests SET status = 'concluido', resolved_at = now() WHERE user_id = _uid AND status <> 'concluido';
  DELETE FROM public.profiles WHERE id = _uid;
  DELETE FROM auth.users WHERE id = _uid;
  RETURN 'deleted';
END;
$$;
REVOKE ALL ON FUNCTION public.delete_account_by_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account_by_id(uuid) TO service_role;
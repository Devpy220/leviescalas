
-- Complete removal of user diegocsatelo@hotmail.com (ID: c1825b2d-79dd-414f-b45d-a8ce8ea3ea56)
DO $$
DECLARE
  v_user_id uuid := 'c1825b2d-79dd-414f-b45d-a8ce8ea3ea56';
BEGIN
  DELETE FROM public.schedule_reminders_sent WHERE schedule_id IN (SELECT id FROM public.schedules WHERE user_id = v_user_id);
  DELETE FROM public.schedule_swaps WHERE requester_user_id = v_user_id OR target_user_id = v_user_id;
  DELETE FROM public.schedules WHERE user_id = v_user_id OR created_by = v_user_id;
  DELETE FROM public.notifications WHERE user_id = v_user_id;
  DELETE FROM public.member_availability WHERE user_id = v_user_id;
  DELETE FROM public.member_date_availability WHERE user_id = v_user_id;
  DELETE FROM public.member_preferences WHERE user_id = v_user_id;
  DELETE FROM public.members WHERE user_id = v_user_id;
  DELETE FROM public.push_subscriptions WHERE user_id = v_user_id;
  DELETE FROM public.telegram_links WHERE user_id = v_user_id;
  DELETE FROM public.telegram_link_codes WHERE user_id = v_user_id;
  DELETE FROM public.billing_access_audit WHERE user_id = v_user_id;
  DELETE FROM public.profile_access_audit WHERE accessor_user_id = v_user_id OR accessed_profile_id = v_user_id;
  DELETE FROM public.payment_receipts WHERE user_id = v_user_id;
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  DELETE FROM public.profiles WHERE id = v_user_id;
END $$;

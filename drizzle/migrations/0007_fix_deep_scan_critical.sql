-- 1) Admin role only for a CONFIRMED account whose stored email is the admin email
CREATE OR REPLACE FUNCTION public.ensure_admin_role()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND lower(u.email) = lower('elsdigital@elsdigital.tech')
      AND u.email_confirmed_at IS NOT NULL
  ) INTO v_ok;

  IF NOT v_ok THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$function$;

-- 2) Swaps can only be executed by a party of the swap, a department leader/co-leader,
--    or server code; and only once, while the schedules still belong to the swap users.
CREATE OR REPLACE FUNCTION public.execute_schedule_swap(swap_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  swap_record schedule_swaps%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO swap_record FROM schedule_swaps WHERE id = swap_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Swap not found';
  END IF;

  IF v_uid IS NULL THEN
    IF coalesce(auth.role(), current_user) NOT IN ('service_role', 'postgres') THEN
      RAISE EXCEPTION 'Not allowed';
    END IF;
  ELSIF NOT (
    v_uid = swap_record.requester_user_id
    OR v_uid = swap_record.target_user_id
    OR public.is_department_leader(v_uid, swap_record.department_id)
    OR public.is_department_coleader(v_uid, swap_record.department_id)
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF swap_record.status != 'accepted' THEN
    RAISE EXCEPTION 'Swap must be accepted before execution';
  END IF;

  IF swap_record.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Swap already executed';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM schedules WHERE id = swap_record.requester_schedule_id AND user_id = swap_record.requester_user_id)
     OR NOT EXISTS (SELECT 1 FROM schedules WHERE id = swap_record.target_schedule_id AND user_id = swap_record.target_user_id) THEN
    RAISE EXCEPTION 'Schedules changed since the swap was requested';
  END IF;

  UPDATE schedules SET user_id = swap_record.target_user_id
  WHERE id = swap_record.requester_schedule_id;

  UPDATE schedules SET user_id = swap_record.requester_user_id
  WHERE id = swap_record.target_schedule_id;

  UPDATE schedule_swaps SET resolved_at = now() WHERE id = swap_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.execute_schedule_swap(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.execute_schedule_swap(uuid) TO authenticated, service_role;

-- 3) A guardian can only link children they registered themselves (or a kids leader can)
DROP POLICY IF EXISTS "kids_guardian_children guardian" ON public.kids_guardian_children;

CREATE POLICY "kids_guardian_children guardian read"
ON public.kids_guardian_children FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.kids_guardians g WHERE g.id = kids_guardian_children.guardian_id AND g.user_id = auth.uid()));

CREATE POLICY "kids_guardian_children guardian delete"
ON public.kids_guardian_children FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.kids_guardians g WHERE g.id = kids_guardian_children.guardian_id AND g.user_id = auth.uid()));

CREATE POLICY "kids_guardian_children guardian insert"
ON public.kids_guardian_children FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.kids_guardians g WHERE g.id = kids_guardian_children.guardian_id AND g.user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.kids_children ch
    WHERE ch.id = kids_guardian_children.child_id
      AND (ch.created_by = auth.uid() OR public.is_kids_leader(auth.uid(), ch.page_id))
  )
);

CREATE POLICY "kids_guardian_children guardian update"
ON public.kids_guardian_children FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.kids_guardians g WHERE g.id = kids_guardian_children.guardian_id AND g.user_id = auth.uid()))
WITH CHECK (
  EXISTS (SELECT 1 FROM public.kids_guardians g WHERE g.id = kids_guardian_children.guardian_id AND g.user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.kids_children ch
    WHERE ch.id = kids_guardian_children.child_id
      AND (ch.created_by = auth.uid() OR public.is_kids_leader(auth.uid(), ch.page_id))
  )
);
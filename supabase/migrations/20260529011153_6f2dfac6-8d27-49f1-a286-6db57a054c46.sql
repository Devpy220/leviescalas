
CREATE OR REPLACE FUNCTION public.join_department_as_coordinator(p_code text)
 RETURNS TABLE(success boolean, department_id uuid, department_name text, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_user_id uuid; v_dept_id uuid; v_dept_name text; v_leader_id uuid; v_allowed boolean;
BEGIN
  v_allowed := public.check_rate_limit_public('join_department_as_coordinator', 10, 5);
  IF NOT v_allowed THEN
    PERFORM pg_sleep(0.5);
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'Muitas tentativas. Tente novamente em alguns minutos.'::text;
    RETURN;
  END IF;
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'Not authenticated'::text;
    RETURN;
  END IF;
  SELECT d.id, d.name, d.leader_id INTO v_dept_id, v_dept_name, v_leader_id
  FROM public.departments d WHERE d.coordinator_invite_code = p_code;
  IF v_dept_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'Invalid or expired coordinator code'::text;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.department_coordinators dc WHERE dc.department_id = v_dept_id AND dc.user_id = v_user_id) THEN
    RETURN QUERY SELECT false, v_dept_id, v_dept_name, 'Already a coordinator of this department'::text;
    RETURN;
  END IF;
  INSERT INTO public.department_coordinators (department_id, user_id, invited_by)
  VALUES (v_dept_id, v_user_id, v_leader_id);
  RETURN QUERY SELECT true, v_dept_id, v_dept_name, 'Successfully joined as coordinator'::text;
END; $function$;

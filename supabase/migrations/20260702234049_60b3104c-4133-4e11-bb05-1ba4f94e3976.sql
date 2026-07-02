
CREATE OR REPLACE FUNCTION public.set_member_blocked(dept_id uuid, target_user_id uuid, blocked boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_department_leader(auth.uid(), dept_id) THEN
    RAISE EXCEPTION 'Apenas o líder pode bloquear/desbloquear voluntários';
  END IF;
  UPDATE public.members
     SET is_blocked = blocked,
         blocked_at = CASE WHEN blocked THEN now() ELSE NULL END,
         blocked_by = CASE WHEN blocked THEN auth.uid() ELSE NULL END
   WHERE department_id = dept_id AND user_id = target_user_id;

  -- When blocking, remove future schedules for this member in this department
  IF blocked THEN
    DELETE FROM public.schedules
     WHERE department_id = dept_id
       AND user_id = target_user_id
       AND date >= CURRENT_DATE;
  END IF;

  RETURN true;
END; $function$;

-- Clean up currently blocked members' future schedules
DELETE FROM public.schedules s
 USING public.members m
 WHERE s.department_id = m.department_id
   AND s.user_id = m.user_id
   AND m.is_blocked = true
   AND s.date >= CURRENT_DATE;

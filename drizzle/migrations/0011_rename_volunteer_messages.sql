CREATE OR REPLACE FUNCTION public.prevent_schedule_for_blocked_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_blocked boolean; v_name text;
BEGIN
  SELECT m.is_blocked INTO v_blocked
    FROM public.members m
   WHERE m.department_id = NEW.department_id AND m.user_id = NEW.user_id;
  IF v_blocked THEN
    SELECT name INTO v_name FROM public.profiles WHERE id = NEW.user_id;
    RAISE EXCEPTION 'Vocacionado % está bloqueado neste departamento. Desbloqueie antes de escalar.', COALESCE(v_name, 'selecionado');
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.set_member_blocked(dept_id uuid, target_user_id uuid, blocked boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_department_leader(auth.uid(), dept_id) OR auth.uid() = target_user_id) THEN
    RAISE EXCEPTION 'Sem permissão para bloquear/desbloquear este vocacionado';
  END IF;
  UPDATE public.members
     SET is_blocked = blocked,
         blocked_at = CASE WHEN blocked THEN now() ELSE NULL END,
         blocked_by = CASE WHEN blocked THEN auth.uid() ELSE NULL END
   WHERE department_id = dept_id AND user_id = target_user_id;
  RETURN true;
END; $function$;
CREATE OR REPLACE FUNCTION public.set_member_blocked(dept_id uuid, target_user_id uuid, blocked boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_department_leader(auth.uid(), dept_id) OR auth.uid() = target_user_id) THEN
    RAISE EXCEPTION 'Sem permissão para bloquear/desbloquear este voluntário';
  END IF;
  UPDATE public.members
     SET is_blocked = blocked,
         blocked_at = CASE WHEN blocked THEN now() ELSE NULL END,
         blocked_by = CASE WHEN blocked THEN auth.uid() ELSE NULL END
   WHERE department_id = dept_id AND user_id = target_user_id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.set_my_blocked(dept_id uuid, blocked boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF NOT public.is_department_member(auth.uid(), dept_id) THEN
    RAISE EXCEPTION 'Você não pertence a este departamento';
  END IF;
  UPDATE public.members
     SET is_blocked = blocked,
         blocked_at = CASE WHEN blocked THEN now() ELSE NULL END,
         blocked_by = CASE WHEN blocked THEN auth.uid() ELSE NULL END
   WHERE department_id = dept_id AND user_id = auth.uid();
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.get_my_blocked(dept_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT m.is_blocked FROM public.members m
    WHERE m.department_id = dept_id AND m.user_id = auth.uid() LIMIT 1), false);
$$;

GRANT EXECUTE ON FUNCTION public.set_my_blocked(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_blocked(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.transfer_department_leadership(dept_id uuid, new_leader_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid;
  v_current_leader uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT leader_id INTO v_current_leader FROM public.departments WHERE id = dept_id;
  IF v_current_leader IS NULL THEN
    RAISE EXCEPTION 'Departamento não encontrado';
  END IF;

  IF v_current_leader <> v_caller AND NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'Apenas o líder atual pode transferir a liderança';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.members WHERE department_id = dept_id AND user_id = new_leader_user_id) THEN
    RAISE EXCEPTION 'O novo líder precisa ser membro do departamento';
  END IF;

  -- Promote new leader
  UPDATE public.members SET role = 'leader'
    WHERE department_id = dept_id AND user_id = new_leader_user_id;

  -- Demote previous leader to member (keep them in the department)
  UPDATE public.members SET role = 'member'
    WHERE department_id = dept_id AND user_id = v_current_leader;

  -- Ensure previous leader has a member row (in case they only existed via departments.leader_id)
  INSERT INTO public.members (department_id, user_id, role)
  SELECT dept_id, v_current_leader, 'member'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.members WHERE department_id = dept_id AND user_id = v_current_leader
  );

  -- Update departments.leader_id
  UPDATE public.departments SET leader_id = new_leader_user_id, updated_at = now()
    WHERE id = dept_id;

  RETURN true;
END;
$$;
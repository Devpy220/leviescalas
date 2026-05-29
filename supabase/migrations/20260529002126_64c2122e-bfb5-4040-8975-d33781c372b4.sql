
CREATE TABLE public.department_coordinators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id uuid NOT NULL,
  user_id uuid NOT NULL,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_coordinators TO authenticated;
GRANT ALL ON public.department_coordinators TO service_role;

ALTER TABLE public.department_coordinators ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_dept_coordinators_user ON public.department_coordinators(user_id);
CREATE INDEX idx_dept_coordinators_dept ON public.department_coordinators(department_id);

ALTER TABLE public.departments
  ADD COLUMN coordinator_invite_code text NOT NULL DEFAULT encode(extensions.gen_random_bytes(8), 'hex');

CREATE UNIQUE INDEX idx_departments_coord_invite ON public.departments(coordinator_invite_code);

CREATE OR REPLACE FUNCTION public.is_department_coordinator(_user_id uuid, _department_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.department_coordinators
    WHERE department_id = _department_id AND user_id = _user_id
  )
$$;

CREATE POLICY "Leaders manage coordinators"
ON public.department_coordinators FOR ALL TO authenticated
USING (public.is_department_leader(auth.uid(), department_id))
WITH CHECK (public.is_department_leader(auth.uid(), department_id));

CREATE POLICY "Coordinator can view own row"
ON public.department_coordinators FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Coordinator can remove self"
ON public.department_coordinators FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Coordinators can view department schedules"
ON public.schedules FOR SELECT TO authenticated
USING (public.is_department_coordinator(auth.uid(), department_id));

CREATE POLICY "Coordinators can view department members"
ON public.members FOR SELECT TO authenticated
USING (public.is_department_coordinator(auth.uid(), department_id));

CREATE POLICY "Coordinators can view department sectors"
ON public.sectors FOR SELECT TO authenticated
USING (public.is_department_coordinator(auth.uid(), department_id));

CREATE POLICY "Coordinators can view department assignment roles"
ON public.assignment_roles FOR SELECT TO authenticated
USING (public.is_department_coordinator(auth.uid(), department_id));

CREATE OR REPLACE FUNCTION public.get_department_basic(dept_id uuid)
RETURNS TABLE(id uuid, name text, description text, leader_id uuid, subscription_status text, created_at timestamptz, updated_at timestamptz, avatar_url text, church_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_department_member(auth.uid(), dept_id)
    OR public.is_department_coordinator(auth.uid(), dept_id)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você não pertence a este departamento';
  END IF;
  RETURN QUERY
  SELECT d.id, d.name, d.description, d.leader_id,
    d.subscription_status::TEXT, d.created_at, d.updated_at,
    d.avatar_url, d.church_id
  FROM departments d WHERE d.id = dept_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_department_member_profiles(dept_id uuid)
RETURNS TABLE(id uuid, name text, avatar_url text, role text, joined_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.name, p.avatar_url, m.role::text, m.joined_at
  FROM public.profiles p
  INNER JOIN public.members m ON m.user_id = p.id
  WHERE m.department_id = dept_id
  AND (
    public.is_department_member(auth.uid(), dept_id)
    OR public.is_department_coordinator(auth.uid(), dept_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_coordinator_code_secure(p_code text)
RETURNS TABLE(is_valid boolean, department_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_dept_name text; v_allowed boolean;
BEGIN
  v_allowed := public.check_rate_limit_public('validate_coordinator_code_secure', 10, 5);
  IF NOT v_allowed THEN
    PERFORM pg_sleep(0.5);
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;
  SELECT d.name INTO v_dept_name FROM public.departments d WHERE d.coordinator_invite_code = p_code;
  IF v_dept_name IS NOT NULL THEN
    RETURN QUERY SELECT true, v_dept_name;
  ELSE
    PERFORM pg_sleep(0.1);
    RETURN QUERY SELECT false, NULL::text;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.join_department_as_coordinator(p_code text)
RETURNS TABLE(success boolean, department_id uuid, department_name text, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
  IF EXISTS (SELECT 1 FROM public.department_coordinators WHERE department_id = v_dept_id AND user_id = v_user_id) THEN
    RETURN QUERY SELECT false, v_dept_id, v_dept_name, 'Already a coordinator of this department'::text;
    RETURN;
  END IF;
  INSERT INTO public.department_coordinators (department_id, user_id, invited_by)
  VALUES (v_dept_id, v_user_id, v_leader_id);
  RETURN QUERY SELECT true, v_dept_id, v_dept_name, 'Successfully joined as coordinator'::text;
END; $$;

CREATE OR REPLACE FUNCTION public.rotate_coordinator_invite_code(dept_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_new_code text;
BEGIN
  IF NOT public.is_department_leader(auth.uid(), dept_id) THEN
    RAISE EXCEPTION 'Apenas o líder pode rotacionar o código';
  END IF;
  v_new_code := encode(extensions.gen_random_bytes(8), 'hex');
  UPDATE public.departments SET coordinator_invite_code = v_new_code, updated_at = now() WHERE id = dept_id;
  RETURN v_new_code;
END; $$;

DROP FUNCTION IF EXISTS public.get_department_secure(uuid);

CREATE FUNCTION public.get_department_secure(dept_id uuid)
RETURNS TABLE(id uuid, name text, description text, leader_id uuid, invite_code text, subscription_status text, stripe_customer_id text, stripe_subscription_id text, trial_ends_at timestamptz, created_at timestamptz, updated_at timestamptz, user_role text, avatar_url text, coordinator_invite_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user_id UUID; v_is_leader BOOLEAN; v_user_role TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT m.role::TEXT INTO v_user_role
  FROM public.members m
  WHERE m.department_id = dept_id AND m.user_id = v_user_id;

  IF v_user_role IS NULL AND NOT public.is_department_coordinator(v_user_id, dept_id) THEN
    RAISE EXCEPTION 'Not a member of this department';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id = dept_id AND d.leader_id = v_user_id
  ) INTO v_is_leader;

  IF v_is_leader THEN
    PERFORM public.log_billing_audit(v_user_id, dept_id, 'VIEW_BILLING_DATA');
  END IF;

  RETURN QUERY
  SELECT d.id, d.name, d.description, d.leader_id,
    CASE WHEN v_is_leader THEN d.invite_code ELSE NULL END,
    d.subscription_status::TEXT,
    CASE WHEN v_is_leader THEN d.stripe_customer_id ELSE NULL END,
    CASE WHEN v_is_leader THEN d.stripe_subscription_id ELSE NULL END,
    CASE WHEN v_is_leader THEN d.trial_ends_at ELSE NULL END,
    d.created_at, d.updated_at,
    COALESCE(v_user_role, 'coordinator'),
    d.avatar_url,
    CASE WHEN v_is_leader THEN d.coordinator_invite_code ELSE NULL END
  FROM public.departments d WHERE d.id = dept_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_my_department_count(p_user_id uuid DEFAULT NULL::uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user_id uuid; v_count integer;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN RETURN 0; END IF;
  SELECT COUNT(DISTINCT dept_id) INTO v_count
  FROM (
    SELECT department_id as dept_id FROM members WHERE user_id = v_user_id
    UNION
    SELECT id as dept_id FROM departments WHERE leader_id = v_user_id
    UNION
    SELECT department_id as dept_id FROM department_coordinators WHERE user_id = v_user_id
  ) as all_depts;
  RETURN COALESCE(v_count, 0);
END; $$;

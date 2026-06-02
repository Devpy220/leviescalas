-- Helper function: is_department_coleader
CREATE OR REPLACE FUNCTION public.is_department_coleader(_user_id uuid, _department_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE department_id = _department_id
      AND user_id = _user_id
      AND role = 'coleader'::member_role
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_department_coleader(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_department_coleader(uuid, uuid) TO authenticated, service_role;

-- SCHEDULES: co-leader can manage (insert/update/delete) schedules
CREATE POLICY "Coleaders can manage department schedules"
ON public.schedules
FOR ALL
TO authenticated
USING (is_department_coleader(auth.uid(), department_id))
WITH CHECK (is_department_coleader(auth.uid(), department_id));

-- ASSIGNMENT_ROLES: co-leader can view (needed to assign roles)
CREATE POLICY "Coleaders can view department assignment roles"
ON public.assignment_roles
FOR SELECT
TO authenticated
USING (is_department_coleader(auth.uid(), department_id));

-- SECTORS: co-leader can view
CREATE POLICY "Coleaders can view department sectors"
ON public.sectors
FOR SELECT
TO authenticated
USING (is_department_coleader(auth.uid(), department_id));

-- MEMBER_AVAILABILITY: co-leader can view
CREATE POLICY "Coleaders can view department availability"
ON public.member_availability
FOR SELECT
TO authenticated
USING (is_department_coleader(auth.uid(), department_id));

-- MEMBER_DATE_AVAILABILITY: co-leader can view
CREATE POLICY "Coleaders can view department date availability"
ON public.member_date_availability
FOR SELECT
TO authenticated
USING (is_department_coleader(auth.uid(), department_id));

-- MEMBER_PREFERENCES: co-leader can view (for blackout dates, max schedules)
CREATE POLICY "Coleaders can view department preferences"
ON public.member_preferences
FOR SELECT
TO authenticated
USING (is_department_coleader(auth.uid(), department_id));

-- ESCALA_REPERTORIO: co-leader can manage
CREATE POLICY "Coleaders insert escala_repertorio"
ON public.escala_repertorio
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.schedules s
  WHERE s.id = escala_repertorio.escala_id
    AND is_department_coleader(auth.uid(), s.department_id)
));

CREATE POLICY "Coleaders update escala_repertorio"
ON public.escala_repertorio
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.schedules s
  WHERE s.id = escala_repertorio.escala_id
    AND is_department_coleader(auth.uid(), s.department_id)
));

CREATE POLICY "Coleaders delete escala_repertorio"
ON public.escala_repertorio
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.schedules s
  WHERE s.id = escala_repertorio.escala_id
    AND is_department_coleader(auth.uid(), s.department_id)
));

-- REPERTORIO: co-leader can manage repertoire
CREATE POLICY "Coleaders insert repertorio"
ON public.repertorio
FOR INSERT
TO authenticated
WITH CHECK (is_department_coleader(auth.uid(), departamento_id) AND criado_por = auth.uid());

CREATE POLICY "Coleaders update repertorio"
ON public.repertorio
FOR UPDATE
TO authenticated
USING (is_department_coleader(auth.uid(), departamento_id))
WITH CHECK (is_department_coleader(auth.uid(), departamento_id));

CREATE POLICY "Coleaders delete repertorio"
ON public.repertorio
FOR DELETE
TO authenticated
USING (is_department_coleader(auth.uid(), departamento_id));

-- SLOT_NOTES: co-leader can manage all slot notes
CREATE POLICY "Coleaders manage slot notes"
ON public.slot_notes
FOR ALL
TO authenticated
USING (is_department_coleader(auth.uid(), department_id))
WITH CHECK (is_department_coleader(auth.uid(), department_id));

-- Update is_department_member to consider coleader as member (already does since coleader is a member row)
-- No change needed.

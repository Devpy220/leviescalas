-- Helper: do two users share at least one department?
CREATE OR REPLACE FUNCTION public.share_department_with(_user_a uuid, _user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_a = _user_b
      OR EXISTS (
        SELECT 1
        FROM public.members m1
        JOIN public.members m2 ON m1.department_id = m2.department_id
        WHERE m1.user_id = _user_a
          AND m2.user_id = _user_b
      )
      OR EXISTS (
        SELECT 1
        FROM public.departments d
        WHERE d.leader_id = _user_a
          AND EXISTS (SELECT 1 FROM public.members m WHERE m.department_id = d.id AND m.user_id = _user_b)
      )
      OR EXISTS (
        SELECT 1
        FROM public.departments d
        WHERE d.leader_id = _user_b
          AND EXISTS (SELECT 1 FROM public.members m WHERE m.department_id = d.id AND m.user_id = _user_a)
      );
$$;

REVOKE EXECUTE ON FUNCTION public.share_department_with(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.share_department_with(uuid, uuid) TO authenticated;

-- Allow co-members to read each other's profile rows
CREATE POLICY "Shared department members can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.share_department_with(auth.uid(), id));

-- Allow members to read department details for departments they belong to
CREATE POLICY "Members can view their departments"
ON public.departments
FOR SELECT
TO authenticated
USING (public.is_department_member(auth.uid(), id));

-- Allow coordinators to read department details for departments they coordinate
CREATE POLICY "Coordinators can view their departments"
ON public.departments
FOR SELECT
TO authenticated
USING (public.is_department_coordinator(auth.uid(), id));
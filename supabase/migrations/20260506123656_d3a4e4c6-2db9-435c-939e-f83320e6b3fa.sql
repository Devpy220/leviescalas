DROP POLICY IF EXISTS "Members can view their departments" ON public.departments;

CREATE OR REPLACE VIEW public.departments_safe
WITH (security_invoker = on) AS
SELECT d.id, d.name, d.description, d.leader_id, d.subscription_status,
       d.trial_ends_at, d.created_at, d.updated_at, d.avatar_url,
       d.church_id, d.allow_sunday_double, d.max_blackout_dates
FROM public.departments d
WHERE public.is_department_member(auth.uid(), d.id)
   OR d.leader_id = auth.uid()
   OR public.has_role(auth.uid(), 'admin');

GRANT SELECT ON public.departments_safe TO authenticated;

DROP POLICY IF EXISTS "Members can view church via department" ON public.churches;
GRANT SELECT ON public.churches_member_view TO authenticated;

DROP POLICY IF EXISTS "Users can respond to or cancel swaps" ON public.schedule_swaps;

CREATE POLICY "Target can accept or reject swap"
ON public.schedule_swaps FOR UPDATE TO authenticated
USING (target_user_id = auth.uid() AND status = 'pending')
WITH CHECK (target_user_id = auth.uid() AND status IN ('accepted','rejected'));

CREATE POLICY "Requester can cancel own pending swap"
ON public.schedule_swaps FOR UPDATE TO authenticated
USING (requester_user_id = auth.uid() AND status = 'pending')
WITH CHECK (requester_user_id = auth.uid() AND status = 'cancelled');

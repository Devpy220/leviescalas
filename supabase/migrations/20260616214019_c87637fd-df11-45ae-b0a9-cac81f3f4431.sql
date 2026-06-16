
-- 1) Co-leaders can view department announcements
CREATE POLICY "Coleaders can view department announcements"
ON public.department_announcements
FOR SELECT
USING (public.is_department_coleader(auth.uid(), department_id));

-- 2) Exclude confirmation_token from realtime publication for schedules
ALTER PUBLICATION supabase_realtime SET TABLE public.schedules
  (id, department_id, user_id, date, time_start, time_end, notes, created_by,
   created_at, updated_at, sector_id, confirmation_status, confirmed_at,
   decline_reason, assignment_role);

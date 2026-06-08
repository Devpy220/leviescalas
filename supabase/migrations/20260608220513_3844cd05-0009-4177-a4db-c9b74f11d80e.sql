
-- 1) Remove departments from realtime publication (CDC broadcasts full row, bypassing column grants)
ALTER PUBLICATION supabase_realtime DROP TABLE public.departments;

-- 2) Tighten schedule_swaps INSERT policy
DROP POLICY IF EXISTS "Users can create swap requests" ON public.schedule_swaps;
CREATE POLICY "Users can create swap requests"
ON public.schedule_swaps
FOR INSERT
TO authenticated
WITH CHECK (
  requester_user_id = auth.uid()
  AND public.is_department_member(auth.uid(), department_id)
  AND EXISTS (
    SELECT 1 FROM public.schedules s
    WHERE s.id = requester_schedule_id
      AND s.user_id = auth.uid()
      AND s.department_id = schedule_swaps.department_id
  )
  AND EXISTS (
    SELECT 1 FROM public.schedules s
    WHERE s.id = target_schedule_id
      AND s.user_id = target_user_id
      AND s.department_id = schedule_swaps.department_id
  )
);

-- 3) Allow users to read and delete their own login logs
CREATE POLICY "Users can read own login logs"
ON public.login_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own login logs"
ON public.login_logs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

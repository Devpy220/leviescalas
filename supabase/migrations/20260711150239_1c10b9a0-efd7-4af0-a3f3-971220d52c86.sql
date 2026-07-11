DROP POLICY IF EXISTS "Only leaders can create notifications for their department" ON public.notifications;

CREATE POLICY "Only leaders can create notifications for their department"
ON public.notifications
FOR INSERT
WITH CHECK (
  (
    department_id IS NOT NULL
    AND is_department_leader(auth.uid(), department_id)
  )
  OR (
    user_id = auth.uid()
    AND (
      department_id IS NULL
      OR is_department_member(auth.uid(), department_id)
      OR is_department_leader(auth.uid(), department_id)
    )
  )
);
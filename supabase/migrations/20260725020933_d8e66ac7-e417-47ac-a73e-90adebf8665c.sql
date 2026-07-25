
-- 1) Drop unused pickup_code column (eliminates realtime exposure risk)
ALTER TABLE public.kids_checkins DROP COLUMN IF EXISTS pickup_code;

-- 2) Tighten teacher read on kids_children: require the teacher to be scheduled
--    for that room on the current date (kids_room_schedules).
DROP POLICY IF EXISTS "kids_children teacher read active" ON public.kids_children;
CREATE POLICY "kids_children teacher read active"
ON public.kids_children
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.kids_checkins ci
    JOIN public.kids_room_schedules rs
      ON rs.room_id = ci.room_id
     AND rs.user_id = auth.uid()
     AND rs.service_date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
    WHERE ci.child_id = kids_children.id
      AND ci.checkout_at IS NULL
  )
);

-- 3) Remove admin self-registration path
DROP POLICY IF EXISTS "Specific admin can self register" ON public.user_roles;

DROP POLICY IF EXISTS "kids_checkins teacher checkout" ON public.kids_checkins;
DROP POLICY IF EXISTS "kids_checkins teacher read active room" ON public.kids_checkins;

CREATE POLICY "kids_checkins teacher checkout" ON public.kids_checkins
FOR UPDATE TO authenticated
USING (public.is_kids_teacher_of_room(auth.uid(), room_id) AND public.is_kids_teacher_scheduled_today(auth.uid(), room_id))
WITH CHECK (public.is_kids_teacher_of_room(auth.uid(), room_id) AND public.is_kids_teacher_scheduled_today(auth.uid(), room_id));

CREATE POLICY "kids_checkins teacher read active room" ON public.kids_checkins
FOR SELECT TO authenticated
USING (public.is_kids_teacher_of_room(auth.uid(), room_id) AND public.is_kids_teacher_scheduled_today(auth.uid(), room_id));
CREATE POLICY "kids_room_transfers insert by leader or scheduled teacher"
ON public.kids_room_transfers
FOR INSERT
TO authenticated
WITH CHECK (
  transferred_by = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.kids_children ch
      WHERE ch.id = kids_room_transfers.child_id
        AND public.is_kids_leader(auth.uid(), ch.page_id)
    )
    OR public.is_kids_teacher_scheduled_today(auth.uid(), to_room_id)
    OR (from_room_id IS NOT NULL AND public.is_kids_teacher_scheduled_today(auth.uid(), from_room_id))
  )
);
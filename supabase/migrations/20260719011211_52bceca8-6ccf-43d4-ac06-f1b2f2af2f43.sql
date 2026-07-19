DROP POLICY IF EXISTS "Anyone can read service days" ON public.kids_service_days;
CREATE POLICY "Kids members can read service days" ON public.kids_service_days FOR SELECT TO authenticated USING (
  is_kids_leader(auth.uid(), page_id)
  OR is_kids_teacher_of_page(auth.uid(), page_id)
  OR EXISTS (
    SELECT 1 FROM public.kids_guardian_children gc
    JOIN public.kids_guardians g ON g.id = gc.guardian_id
    JOIN public.kids_children c ON c.id = gc.child_id
    WHERE g.user_id = auth.uid() AND c.page_id = kids_service_days.page_id
  )
);
REVOKE SELECT ON public.kids_service_days FROM anon;
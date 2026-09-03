DROP POLICY IF EXISTS "kids_children guardian manage" ON public.kids_children;

CREATE POLICY "kids_children guardian manage"
ON public.kids_children
FOR ALL
TO authenticated
USING (public.is_guardian_of(auth.uid(), id) OR public.is_kids_leader(auth.uid(), page_id))
WITH CHECK (
  public.is_kids_leader(auth.uid(), page_id)
  OR (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.kids_consents kc
      WHERE kc.user_id = auth.uid() AND kc.page_id = kids_children.page_id
    )
  )
  OR public.is_guardian_of(auth.uid(), id)
);
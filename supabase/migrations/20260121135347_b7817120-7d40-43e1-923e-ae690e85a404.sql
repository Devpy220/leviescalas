-- Ensure sectors policies are PERMISSIVE so leader OR member access works

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leaders can manage department sectors" ON public.sectors;
DROP POLICY IF EXISTS "Members can view department sectors" ON public.sectors;

CREATE POLICY "Leaders can manage department sectors"
  ON public.sectors
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (is_department_leader(auth.uid(), department_id))
  WITH CHECK (is_department_leader(auth.uid(), department_id));

CREATE POLICY "Members can view department sectors"
  ON public.sectors
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_department_member(auth.uid(), department_id));

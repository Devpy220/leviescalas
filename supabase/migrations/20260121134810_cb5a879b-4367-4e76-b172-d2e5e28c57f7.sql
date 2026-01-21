-- Fix sectors RLS: Leaders need explicit SELECT permission
-- The current policies are all RESTRICTIVE which requires ALL to pass

-- Drop the restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Leaders can insert sectors" ON public.sectors;
DROP POLICY IF EXISTS "Leaders can manage department sectors" ON public.sectors;
DROP POLICY IF EXISTS "Members can view department sectors" ON public.sectors;

-- Create permissive policies (default behavior - any matching policy grants access)
CREATE POLICY "Leaders can manage department sectors"
  ON public.sectors
  FOR ALL
  TO authenticated
  USING (is_department_leader(auth.uid(), department_id))
  WITH CHECK (is_department_leader(auth.uid(), department_id));

CREATE POLICY "Members can view department sectors"
  ON public.sectors
  FOR SELECT
  TO authenticated
  USING (is_department_member(auth.uid(), department_id));
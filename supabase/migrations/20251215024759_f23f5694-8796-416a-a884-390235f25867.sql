-- Consolidate conflicting department policies
-- Drop the conflicting policies
DROP POLICY IF EXISTS "Members can view their departments via functions" ON public.departments;
DROP POLICY IF EXISTS "Only leaders can directly select departments" ON public.departments;

-- Create a single clear SELECT policy
-- Members can view basic department info, leaders can view all
CREATE POLICY "Members can view department info"
ON public.departments
FOR SELECT
USING (
  leader_id = auth.uid() 
  OR is_department_member(auth.uid(), id)
);

-- Consolidate schedules policies - remove redundant individual policies
DROP POLICY IF EXISTS "Only leaders can delete schedules" ON public.schedules;
DROP POLICY IF EXISTS "Only leaders can insert schedules" ON public.schedules;
DROP POLICY IF EXISTS "Only leaders can update schedules" ON public.schedules;
-- Keep "Leaders can manage department schedules" which covers ALL operations
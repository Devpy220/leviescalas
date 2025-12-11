-- Add INSERT policy for departments table (defense-in-depth)
-- Only allow users to create departments where they are the leader
CREATE POLICY "Leaders can create their own departments"
ON public.departments
FOR INSERT
TO authenticated
WITH CHECK (leader_id = auth.uid());
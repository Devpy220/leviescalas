-- 1. Fix broken RLS policy for departments (members viewing their departments)
DROP POLICY IF EXISTS "Members can view their departments" ON public.departments;
CREATE POLICY "Members can view their departments"
  ON public.departments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.department_id = departments.id 
      AND m.user_id = auth.uid()
    )
  );

-- 2. Fix billing_access_audit INSERT policy to allow system inserts via security definer function
DROP POLICY IF EXISTS "System can insert audit logs" ON public.billing_access_audit;
CREATE POLICY "Service role can insert audit logs"
  ON public.billing_access_audit
  FOR INSERT
  WITH CHECK (true);

-- 3. Allow users to view their own billing access history
CREATE POLICY "Users can view own billing access"
  ON public.billing_access_audit
  FOR SELECT
  USING (user_id = auth.uid());

-- 4. Allow users to delete their own payment receipts
CREATE POLICY "Users can delete own receipts"
  ON public.payment_receipts
  FOR DELETE
  USING (user_id = auth.uid());

-- 5. Allow users to view schedules they are assigned to
CREATE POLICY "Users can view their own schedules"
  ON public.schedules
  FOR SELECT
  USING (user_id = auth.uid());

-- 6. Allow users to view who accessed their profile
CREATE POLICY "Users can view access to their profile"
  ON public.profile_access_audit
  FOR SELECT
  USING (accessed_profile_id = auth.uid());
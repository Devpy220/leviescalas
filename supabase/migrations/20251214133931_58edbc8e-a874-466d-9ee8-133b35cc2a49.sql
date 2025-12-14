-- Allow the first admin to self-register (when no admins exist)
DROP POLICY IF EXISTS "First admin can self register" ON public.user_roles;
CREATE POLICY "First admin can self register"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (
    role = 'admin' 
    AND user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
  );

-- Allow users to check their own role (needed for has_role function when no admin exists yet)
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles
  FOR SELECT
  USING (user_id = auth.uid());
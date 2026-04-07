
-- Drop old policy that references leviescalas@gmail.com
DROP POLICY IF EXISTS "Specific admin can self register" ON public.user_roles;

-- Create new policy with updated admin email
CREATE POLICY "Specific admin can self register"
ON public.user_roles
FOR INSERT
TO public
WITH CHECK (
  (role = 'admin'::app_role)
  AND (user_id = auth.uid())
  AND ((SELECT users.email FROM auth.users WHERE users.id = auth.uid())::text = 'elsdigital@elsdigital.tech'::text)
);

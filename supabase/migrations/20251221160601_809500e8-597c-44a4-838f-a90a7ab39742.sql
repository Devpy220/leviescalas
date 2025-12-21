-- Remove a política antiga que permite primeiro admin se auto-registrar
DROP POLICY IF EXISTS "First admin can self register" ON public.user_roles;

-- Cria nova política que permite apenas o email específico se tornar admin
CREATE POLICY "Specific admin can self register"
ON public.user_roles
FOR INSERT
WITH CHECK (
  role = 'admin'::app_role 
  AND user_id = auth.uid()
  AND (SELECT email FROM auth.users WHERE id = auth.uid()) = 'leviescalas@gmail.com'
);
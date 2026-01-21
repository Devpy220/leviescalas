-- Drop the overly permissive authentication policy that allows any authenticated user to access church data
DROP POLICY IF EXISTS "Require authentication for churches" ON public.churches;
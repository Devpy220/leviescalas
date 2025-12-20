-- 1. Remove the dangerous public access policy on churches
DROP POLICY IF EXISTS "Anyone can view churches" ON public.churches;

-- 2. Create secure policy: Leaders can view their own churches
CREATE POLICY "Leaders can view own churches"
ON public.churches
FOR SELECT
USING (leader_id = auth.uid());

-- 3. Create secure policy: Members can view churches linked to their departments
CREATE POLICY "Members can view church via department"
ON public.churches
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.departments d
    INNER JOIN public.members m ON m.department_id = d.id
    WHERE d.church_id = churches.id
    AND m.user_id = auth.uid()
  )
);

-- 4. Create a secure function to validate church code without exposing data
CREATE OR REPLACE FUNCTION public.validate_church_code_secure(p_code text)
RETURNS TABLE(is_valid boolean, church_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_church_name text;
BEGIN
  -- Only return minimal info - just validity and name, not ID or other data
  SELECT c.name INTO v_church_name
  FROM public.churches c
  WHERE upper(c.code) = upper(p_code);
  
  IF v_church_name IS NOT NULL THEN
    RETURN QUERY SELECT true, v_church_name;
  ELSE
    -- Delay response slightly to prevent timing attacks
    PERFORM pg_sleep(0.1);
    RETURN QUERY SELECT false, NULL::text;
  END IF;
END;
$$;
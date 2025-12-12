-- 1. Create a secure function for joining departments via invite code
-- This validates the invite code server-side before creating membership
CREATE OR REPLACE FUNCTION public.join_department_by_invite(invite_code text)
RETURNS TABLE(
  success boolean,
  department_id uuid,
  department_name text,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_dept_id uuid;
  v_dept_name text;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'Not authenticated'::text;
    RETURN;
  END IF;
  
  -- Validate invite code and get department
  SELECT d.id, d.name INTO v_dept_id, v_dept_name
  FROM public.departments d
  WHERE d.invite_code = join_department_by_invite.invite_code;
  
  IF v_dept_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'Invalid or expired invite code'::text;
    RETURN;
  END IF;
  
  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.department_id = v_dept_id AND m.user_id = v_user_id
  ) THEN
    RETURN QUERY SELECT false, v_dept_id, v_dept_name, 'Already a member of this department'::text;
    RETURN;
  END IF;
  
  -- Insert member record
  INSERT INTO public.members (department_id, user_id, role)
  VALUES (v_dept_id, v_user_id, 'member');
  
  RETURN QUERY SELECT true, v_dept_id, v_dept_name, 'Successfully joined department'::text;
END;
$$;

-- 2. Remove the insecure direct INSERT policy
DROP POLICY IF EXISTS "Users can add themselves as members" ON public.members;

-- 3. Add documentation
COMMENT ON FUNCTION public.join_department_by_invite IS 
  'Secure function for joining departments. Validates invite code server-side before creating membership.';
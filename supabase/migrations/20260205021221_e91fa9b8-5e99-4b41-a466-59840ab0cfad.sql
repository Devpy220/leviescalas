-- Update get_my_department_count to accept optional user_id parameter
-- This fixes the race condition where auth.uid() returns NULL immediately after login
CREATE OR REPLACE FUNCTION public.get_my_department_count(p_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_count integer;
BEGIN
  -- Use provided user_id or fallback to auth.uid()
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Count unique departments where user is member or leader
  SELECT COUNT(DISTINCT dept_id) INTO v_count
  FROM (
    SELECT department_id as dept_id FROM members WHERE user_id = v_user_id
    UNION
    SELECT id as dept_id FROM departments WHERE leader_id = v_user_id
  ) as all_depts;
  
  RETURN COALESCE(v_count, 0);
END;
$$;
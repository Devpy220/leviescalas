-- Create a secure function to count user departments
-- This uses SECURITY DEFINER to bypass RLS timing issues during login
CREATE OR REPLACE FUNCTION public.get_my_department_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_count integer;
BEGIN
  v_user_id := auth.uid();
  
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
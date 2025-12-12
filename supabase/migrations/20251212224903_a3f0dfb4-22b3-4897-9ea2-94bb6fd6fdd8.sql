-- 1. Remove the insecure INSERT policy that allows users to insert their own logs
DROP POLICY IF EXISTS "System can insert audit logs" ON billing_access_audit;

-- 2. Create a secure security definer function for audit logging
-- This function should be called from other security definer functions or edge functions
CREATE OR REPLACE FUNCTION public.log_billing_audit(
  p_user_id uuid,
  p_department_id uuid,
  p_action text,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id uuid;
BEGIN
  -- Validations
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;
  
  IF p_department_id IS NULL THEN
    RAISE EXCEPTION 'department_id cannot be null';
  END IF;
  
  IF p_action IS NULL OR p_action = '' THEN
    RAISE EXCEPTION 'action cannot be null or empty';
  END IF;
  
  -- Verify user is a member of the department
  IF NOT is_department_member(p_user_id, p_department_id) THEN
    RAISE EXCEPTION 'User is not a member of this department';
  END IF;
  
  -- Insert audit log
  INSERT INTO billing_access_audit (
    user_id,
    department_id,
    action,
    ip_address,
    user_agent,
    created_at
  ) VALUES (
    p_user_id,
    p_department_id,
    p_action,
    p_ip_address,
    p_user_agent,
    now()
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- 3. Update get_department_secure to use the new secure logging function
CREATE OR REPLACE FUNCTION public.get_department_secure(dept_id uuid)
RETURNS TABLE(
  id uuid, 
  name text, 
  description text, 
  leader_id uuid, 
  invite_code text, 
  subscription_status text, 
  stripe_customer_id text, 
  stripe_subscription_id text, 
  trial_ends_at timestamp with time zone, 
  created_at timestamp with time zone, 
  updated_at timestamp with time zone, 
  user_role text, 
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_leader BOOLEAN;
  v_user_role TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT m.role::TEXT INTO v_user_role
  FROM public.members m
  WHERE m.department_id = dept_id AND m.user_id = v_user_id;
  
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this department';
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id = dept_id AND d.leader_id = v_user_id
  ) INTO v_is_leader;
  
  -- Use the secure logging function instead of direct INSERT
  IF v_is_leader THEN
    PERFORM public.log_billing_audit(v_user_id, dept_id, 'VIEW_BILLING_DATA');
  END IF;
  
  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.description,
    d.leader_id,
    CASE WHEN v_is_leader THEN d.invite_code ELSE NULL END as invite_code,
    d.subscription_status::TEXT,
    CASE WHEN v_is_leader THEN d.stripe_customer_id ELSE NULL END as stripe_customer_id,
    CASE WHEN v_is_leader THEN d.stripe_subscription_id ELSE NULL END as stripe_subscription_id,
    CASE WHEN v_is_leader THEN d.trial_ends_at ELSE NULL END as trial_ends_at,
    d.created_at,
    d.updated_at,
    v_user_role as user_role,
    d.avatar_url
  FROM public.departments d
  WHERE d.id = dept_id;
END;
$$;

-- 4. Add documentation
COMMENT ON FUNCTION public.log_billing_audit IS 
  'Secure function for inserting billing audit logs. Called from other security definer functions only.';
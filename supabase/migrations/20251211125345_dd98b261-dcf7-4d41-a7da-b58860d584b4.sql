-- Fix: Change get_department_secure from STABLE to VOLATILE since it performs INSERT
CREATE OR REPLACE FUNCTION public.get_department_secure(dept_id uuid)
 RETURNS TABLE(id uuid, name text, description text, leader_id uuid, invite_code text, subscription_status text, stripe_customer_id text, stripe_subscription_id text, trial_ends_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, user_role text)
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_is_leader BOOLEAN;
  v_user_role TEXT;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Check if user is a member of the department
  SELECT m.role::TEXT INTO v_user_role
  FROM public.members m
  WHERE m.department_id = dept_id AND m.user_id = v_user_id;
  
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this department';
  END IF;
  
  -- Check if user is leader
  SELECT EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id = dept_id AND d.leader_id = v_user_id
  ) INTO v_is_leader;
  
  -- Log access if user is accessing billing data (leader)
  IF v_is_leader THEN
    INSERT INTO public.billing_access_audit (user_id, department_id, action)
    VALUES (v_user_id, dept_id, 'VIEW_BILLING_DATA');
  END IF;
  
  -- Return data with conditional stripe fields
  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.description,
    d.leader_id,
    CASE 
      WHEN v_is_leader THEN d.invite_code 
      ELSE NULL 
    END as invite_code,
    d.subscription_status::TEXT,
    CASE 
      WHEN v_is_leader THEN d.stripe_customer_id
      ELSE NULL
    END as stripe_customer_id,
    CASE 
      WHEN v_is_leader THEN d.stripe_subscription_id
      ELSE NULL
    END as stripe_subscription_id,
    CASE 
      WHEN v_is_leader THEN d.trial_ends_at
      ELSE NULL
    END as trial_ends_at,
    d.created_at,
    d.updated_at,
    v_user_role as user_role
  FROM public.departments d
  WHERE d.id = dept_id;
END;
$function$;
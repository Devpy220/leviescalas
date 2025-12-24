-- 1) Add supporting indexes/constraints for rate limit upserts
CREATE UNIQUE INDEX IF NOT EXISTS rate_limits_user_window_uniq
ON public.rate_limits (endpoint, user_id, window_start)
WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rate_limits_ip_window_uniq
ON public.rate_limits (endpoint, ip_address, window_start)
WHERE user_id IS NULL AND ip_address IS NOT NULL;

-- 2) Rate limit helper that works for both authenticated and anonymous callers
--    - Authenticated: limits per user_id
--    - Anonymous: limits per client IP (inet_client_addr())
CREATE OR REPLACE FUNCTION public.check_rate_limit_public(
  p_endpoint text,
  p_max_requests integer,
  p_window_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_window_start timestamptz;
  v_user_id uuid;
  v_ip inet;
BEGIN
  v_user_id := auth.uid();
  v_ip := inet_client_addr();

  -- Calculate current window start
  v_window_start := date_trunc('minute', now()) -
    ((extract(minute from now())::int % p_window_minutes) || ' minutes')::interval;

  -- Clean up old entries (best-effort)
  DELETE FROM public.rate_limits
  WHERE window_start < now() - (p_window_minutes * 2 || ' minutes')::interval;

  -- If anonymous and we cannot resolve IP, fail open (can't reliably rate limit)
  IF v_user_id IS NULL AND v_ip IS NULL THEN
    RETURN true;
  END IF;

  -- Fetch existing counter for this window
  SELECT rl.request_count
  INTO v_count
  FROM public.rate_limits rl
  WHERE rl.endpoint = p_endpoint
    AND rl.window_start = v_window_start
    AND (
      (v_user_id IS NOT NULL AND rl.user_id = v_user_id)
      OR
      (v_user_id IS NULL AND rl.user_id IS NULL AND rl.ip_address = v_ip)
    )
  LIMIT 1;

  IF v_count IS NULL THEN
    -- First request in window
    INSERT INTO public.rate_limits (user_id, ip_address, endpoint, window_start, request_count)
    VALUES (v_user_id, CASE WHEN v_user_id IS NULL THEN v_ip ELSE NULL END, p_endpoint, v_window_start, 1)
    ON CONFLICT DO NOTHING;
    RETURN true;
  ELSIF v_count >= p_max_requests THEN
    RETURN false;
  ELSE
    UPDATE public.rate_limits
    SET request_count = request_count + 1
    WHERE endpoint = p_endpoint
      AND window_start = v_window_start
      AND (
        (v_user_id IS NOT NULL AND user_id = v_user_id)
        OR
        (v_user_id IS NULL AND user_id IS NULL AND ip_address = v_ip)
      );
    RETURN true;
  END IF;
END;
$$;

-- 3) Integrate rate limiting into public invite / code validation functions
CREATE OR REPLACE FUNCTION public.validate_church_code_secure(p_code text)
RETURNS TABLE(is_valid boolean, church_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_church_name text;
  v_allowed boolean;
BEGIN
  v_allowed := public.check_rate_limit_public('validate_church_code_secure', 10, 5);
  IF NOT v_allowed THEN
    -- Slow down bots further
    PERFORM pg_sleep(0.5);
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

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

CREATE OR REPLACE FUNCTION public.validate_invite_code_secure(code text)
RETURNS TABLE(is_valid boolean, department_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dept_name text;
  v_allowed boolean;
BEGIN
  v_allowed := public.check_rate_limit_public('validate_invite_code_secure', 10, 5);
  IF NOT v_allowed THEN
    PERFORM pg_sleep(0.5);
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  -- Only return minimal info - just validity and name, not ID
  SELECT d.name INTO v_dept_name
  FROM public.departments d
  WHERE d.invite_code = code;

  IF v_dept_name IS NOT NULL THEN
    RETURN QUERY SELECT true, v_dept_name;
  ELSE
    -- Delay response slightly to prevent timing attacks
    PERFORM pg_sleep(0.1);
    RETURN QUERY SELECT false, NULL::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_department_by_invite(invite_code text)
RETURNS TABLE(success boolean, department_id uuid, department_name text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_dept_id uuid;
  v_dept_name text;
  v_allowed boolean;
BEGIN
  v_allowed := public.check_rate_limit_public('join_department_by_invite', 10, 5);
  IF NOT v_allowed THEN
    PERFORM pg_sleep(0.5);
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'Muitas tentativas. Tente novamente em alguns minutos.'::text;
    RETURN;
  END IF;

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
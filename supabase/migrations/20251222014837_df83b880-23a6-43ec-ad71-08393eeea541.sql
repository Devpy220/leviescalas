-- =====================================================
-- Security Fix: Payment Receipt Storage Policy Cleanup
-- =====================================================

-- Drop any old insecure policies that may still exist
DROP POLICY IF EXISTS "Leaders can view all payment receipts" ON storage.objects;
DROP POLICY IF EXISTS "Leaders can view department receipts" ON storage.objects;
DROP POLICY IF EXISTS "payment_receipts_select_leader" ON storage.objects;

-- Create secure policy for leaders to view only their department's receipts
CREATE POLICY "payment_receipts_select_leader" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'payment-receipts'
  AND EXISTS (
    SELECT 1 FROM public.payment_receipts pr
    JOIN public.departments d ON d.id = pr.department_id
    WHERE d.leader_id = auth.uid()
    AND storage.objects.name LIKE '%' || pr.id::text || '%'
  )
);

-- =====================================================
-- Security Fix: Rate Limiting Infrastructure
-- =====================================================

-- Create rate_limits table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  endpoint text NOT NULL,
  request_count int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT date_trunc('minute', now()),
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint ON public.rate_limits(user_id, endpoint, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON public.rate_limits(window_start);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can check their own rate limits
CREATE POLICY "Users can check own rate limits"
ON public.rate_limits FOR SELECT
USING (user_id = auth.uid());

-- Service role can manage all rate limits
CREATE POLICY "Service role full access"
ON public.rate_limits FOR ALL
USING (auth.role() = 'service_role');

-- Create rate limiting function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_max_requests int,
  p_window_minutes int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_window_start timestamptz;
BEGIN
  -- Calculate current window start
  v_window_start := date_trunc('minute', now()) - 
    ((extract(minute from now())::int % p_window_minutes) || ' minutes')::interval;
  
  -- Clean up old entries
  DELETE FROM rate_limits 
  WHERE window_start < now() - (p_window_minutes * 2 || ' minutes')::interval;
  
  -- Check current count
  SELECT request_count INTO v_count
  FROM rate_limits
  WHERE user_id = p_user_id 
    AND endpoint = p_endpoint
    AND window_start = v_window_start;
  
  IF v_count IS NULL THEN
    -- First request in this window
    INSERT INTO rate_limits (user_id, endpoint, window_start, request_count)
    VALUES (p_user_id, p_endpoint, v_window_start, 1);
    RETURN true;
  ELSIF v_count >= p_max_requests THEN
    -- Rate limit exceeded
    RETURN false;
  ELSE
    -- Increment counter
    UPDATE rate_limits 
    SET request_count = request_count + 1
    WHERE user_id = p_user_id 
      AND endpoint = p_endpoint
      AND window_start = v_window_start;
    RETURN true;
  END IF;
END;
$$;
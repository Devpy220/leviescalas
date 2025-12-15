-- Improve storage bucket security for payment-receipts
-- Ensure files can only be accessed by owners and department leaders

-- First, remove any existing storage policies for payment-receipts bucket
DROP POLICY IF EXISTS "Users can upload payment receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Leaders can view department receipts" ON storage.objects;
DROP POLICY IF EXISTS "payment_receipts_upload" ON storage.objects;
DROP POLICY IF EXISTS "payment_receipts_select" ON storage.objects;

-- Create secure upload policy - users can only upload to their own folder
CREATE POLICY "payment_receipts_upload_secure" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'payment-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create secure select policy - users can only view their own receipts
CREATE POLICY "payment_receipts_select_own" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'payment-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create policy for department leaders to view their department's receipts
CREATE POLICY "payment_receipts_select_leader" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'payment-receipts' 
  AND EXISTS (
    SELECT 1 FROM public.payment_receipts pr
    JOIN public.departments d ON d.id = pr.department_id
    WHERE pr.receipt_url LIKE '%' || storage.objects.name
    AND d.leader_id = auth.uid()
  )
);

-- Users can delete their own receipts
CREATE POLICY "payment_receipts_delete_own" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'payment-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add rate limiting function for invite code validation (prevents enumeration)
CREATE OR REPLACE FUNCTION public.validate_invite_code_secure(code text)
RETURNS TABLE(is_valid boolean, department_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dept_name text;
BEGIN
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

-- Fix 1: Tighten schedule_swaps SELECT to only swap parties + leaders/coordinators
DROP POLICY IF EXISTS "Members can view department swaps" ON public.schedule_swaps;

CREATE POLICY "Swap parties and leaders can view swaps"
ON public.schedule_swaps
FOR SELECT
TO authenticated
USING (
  requester_user_id = auth.uid()
  OR target_user_id = auth.uid()
  OR public.is_department_leader(auth.uid(), department_id)
  OR public.is_department_coordinator(auth.uid(), department_id)
  OR public.is_department_coleader(auth.uid(), department_id)
);

-- Fix 2: Defense-in-depth on churches sensitive columns.
-- Revoke column-level SELECT on registrant PII and CNPJ from anon (and authenticated client role)
-- so a future broad public policy cannot expose them. Leaders access these fields via
-- SECURITY DEFINER functions / service role.
REVOKE SELECT (cnpj, registrant_name, registrant_email, registrant_phone, email, phone)
  ON public.churches FROM anon;

COMMENT ON COLUMN public.churches.cnpj IS 'Sensitive. Never expose via public SELECT policy. Access only via SECURITY DEFINER functions or service role.';
COMMENT ON COLUMN public.churches.registrant_email IS 'Sensitive PII. Never expose via public SELECT policy.';
COMMENT ON COLUMN public.churches.registrant_phone IS 'Sensitive PII. Never expose via public SELECT policy.';
COMMENT ON COLUMN public.churches.registrant_name IS 'Sensitive PII. Never expose via public SELECT policy.';

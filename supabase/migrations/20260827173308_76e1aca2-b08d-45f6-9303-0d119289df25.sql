CREATE OR REPLACE FUNCTION public.prevent_department_billing_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.subscription_status := OLD.subscription_status;
    NEW.trial_ends_at := OLD.trial_ends_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_department_billing_change ON public.departments;
CREATE TRIGGER trg_prevent_department_billing_change
BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.prevent_department_billing_change();
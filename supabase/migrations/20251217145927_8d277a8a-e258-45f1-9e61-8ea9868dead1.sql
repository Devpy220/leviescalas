-- Extend current trial period to 14 days from department creation for trial departments
UPDATE public.departments
SET trial_ends_at = created_at + interval '14 days'
WHERE subscription_status = 'trial'
  AND trial_ends_at IS NOT NULL
  AND trial_ends_at < (created_at + interval '14 days');
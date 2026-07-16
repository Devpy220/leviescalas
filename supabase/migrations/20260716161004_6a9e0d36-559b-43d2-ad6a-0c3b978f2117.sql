
-- Add birth date and guardian authorization to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS guardian_authorized_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guardian_authorized_at timestamptz;

-- Helper: is minor (under 18)
CREATE OR REPLACE FUNCTION public.is_minor(_birth date)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _birth IS NOT NULL AND (age(current_date, _birth) < interval '18 years');
$$;

ALTER TABLE public.member_preferences
  ADD COLUMN IF NOT EXISTS blackout_shifts text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.member_preferences.blackout_shifts IS
  'Per-shift blocks as "YYYY-MM-DD|M" (before 14:00) or "YYYY-MM-DD|N" (from 14:00). Whole-day blocks stay in blackout_dates.';
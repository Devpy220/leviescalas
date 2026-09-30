ALTER TABLE public.departments ALTER COLUMN max_blackout_dates SET DEFAULT 4;
UPDATE public.departments SET max_blackout_dates = 4;
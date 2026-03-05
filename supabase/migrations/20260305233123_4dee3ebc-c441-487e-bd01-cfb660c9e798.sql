
ALTER TABLE public.member_availability 
ALTER COLUMN period_start SET DEFAULT (date_trunc('month', CURRENT_DATE))::date;

ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS cleanup_deadline timestamptz;
UPDATE public.churches SET cleanup_deadline = GREATEST(created_at, now()) + interval '5 days' WHERE cleanup_deadline IS NULL;
ALTER TABLE public.churches ALTER COLUMN cleanup_deadline SET DEFAULT (now() + interval '5 days');
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS cleanup_last_notice_at timestamptz;
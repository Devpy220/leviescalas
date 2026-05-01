ALTER TABLE public.page_views 
ADD COLUMN IF NOT EXISTS is_authenticated boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_page_views_is_authenticated ON public.page_views(is_authenticated);
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS sector_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.schedules
SET sector_ids = ARRAY[sector_id]
WHERE sector_id IS NOT NULL AND (sector_ids IS NULL OR cardinality(sector_ids) = 0);

GRANT SELECT (sector_ids), UPDATE (sector_ids), INSERT (sector_ids) ON public.schedules TO authenticated;
GRANT ALL ON public.schedules TO service_role;
ALTER TABLE public.slot_notes
  ADD COLUMN IF NOT EXISTS setlist jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
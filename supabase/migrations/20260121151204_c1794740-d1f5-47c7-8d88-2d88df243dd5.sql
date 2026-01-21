-- Add color column to sectors table
ALTER TABLE public.sectors 
ADD COLUMN color text NOT NULL DEFAULT '#6366F1';

-- Add a comment explaining the field
COMMENT ON COLUMN public.sectors.color IS 'Hex color chosen by leader at creation time, cannot be changed after';
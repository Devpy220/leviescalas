-- Add avatar_url column to departments table
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS avatar_url text;
-- Add sms_sent column to admin_broadcasts
ALTER TABLE public.admin_broadcasts ADD COLUMN IF NOT EXISTS sms_sent integer NOT NULL DEFAULT 0;
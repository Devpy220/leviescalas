-- Create enum for confirmation status
CREATE TYPE confirmation_status AS ENUM ('pending', 'confirmed', 'declined');

-- Add confirmation columns to schedules table
ALTER TABLE public.schedules 
ADD COLUMN confirmation_status confirmation_status NOT NULL DEFAULT 'pending',
ADD COLUMN confirmation_token TEXT UNIQUE,
ADD COLUMN confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN decline_reason TEXT;

-- Create index for token lookups (used by public confirmation endpoint)
CREATE INDEX idx_schedules_confirmation_token ON public.schedules(confirmation_token) WHERE confirmation_token IS NOT NULL;

-- Create index for finding pending confirmations
CREATE INDEX idx_schedules_confirmation_status ON public.schedules(confirmation_status, date) WHERE confirmation_status = 'pending';

-- Function to generate confirmation token when schedule is created
CREATE OR REPLACE FUNCTION generate_confirmation_token()
RETURNS TRIGGER AS $$
BEGIN
  NEW.confirmation_token := encode(extensions.gen_random_bytes(16), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-generate token on insert
CREATE TRIGGER schedules_generate_token
  BEFORE INSERT ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION generate_confirmation_token();

-- Generate tokens for existing schedules that don't have one
UPDATE public.schedules 
SET confirmation_token = encode(extensions.gen_random_bytes(16), 'hex')
WHERE confirmation_token IS NULL;
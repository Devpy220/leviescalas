
-- Table for calendar sync tokens (one per user, used to authenticate iCal feed)
CREATE TABLE public.calendar_sync_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  token TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_sync_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
CREATE POLICY "Users can manage own calendar tokens"
ON public.calendar_sync_tokens
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_calendar_sync_tokens_updated_at
BEFORE UPDATE ON public.calendar_sync_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

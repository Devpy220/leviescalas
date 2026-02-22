
-- Create table to map PushAlert subscriber IDs to user IDs
CREATE TABLE public.pushalert_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscriber_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(subscriber_id)
);

-- Enable RLS
ALTER TABLE public.pushalert_subscribers ENABLE ROW LEVEL SECURITY;

-- Users can read/insert/update/delete their own subscriber mapping
CREATE POLICY "Users can view their own subscriber" ON public.pushalert_subscribers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriber" ON public.pushalert_subscribers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriber" ON public.pushalert_subscribers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriber" ON public.pushalert_subscribers
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can read all (for edge functions)
CREATE POLICY "Service role can read all subscribers" ON public.pushalert_subscribers
  FOR SELECT USING (true);

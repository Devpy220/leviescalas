-- Create table for storing push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own subscriptions
CREATE POLICY "Users can insert own subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own subscriptions
CREATE POLICY "Users can delete own subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
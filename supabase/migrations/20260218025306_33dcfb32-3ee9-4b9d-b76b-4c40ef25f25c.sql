
-- Create login_logs table
CREATE TABLE public.login_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  logged_in_at timestamp with time zone NOT NULL DEFAULT now(),
  user_agent text
);

-- Enable RLS
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own login logs
CREATE POLICY "Users can insert own login logs"
ON public.login_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only admins can read login logs
CREATE POLICY "Admins can read login logs"
ON public.login_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Create index for performance
CREATE INDEX idx_login_logs_logged_in_at ON public.login_logs (logged_in_at DESC);
CREATE INDEX idx_login_logs_user_id ON public.login_logs (user_id);

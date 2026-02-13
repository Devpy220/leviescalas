
-- Create telegram_links table
CREATE TABLE public.telegram_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id bigint NOT NULL,
  username text,
  linked_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(user_id),
  UNIQUE(chat_id)
);

-- Create telegram_link_codes table for temporary verification codes
CREATE TABLE public.telegram_link_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '5 minutes'),
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(code)
);

-- Enable RLS
ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

-- RLS for telegram_links: users can manage their own
CREATE POLICY "Users can view own telegram link"
  ON public.telegram_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own telegram link"
  ON public.telegram_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own telegram link"
  ON public.telegram_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own telegram link"
  ON public.telegram_links FOR DELETE
  USING (auth.uid() = user_id);

-- RLS for telegram_link_codes: users can manage their own
CREATE POLICY "Users can view own link codes"
  ON public.telegram_link_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own link codes"
  ON public.telegram_link_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own link codes"
  ON public.telegram_link_codes FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role needs full access for webhook processing
CREATE POLICY "Service role full access telegram_links"
  ON public.telegram_links FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access telegram_link_codes"
  ON public.telegram_link_codes FOR ALL
  USING (auth.role() = 'service_role');

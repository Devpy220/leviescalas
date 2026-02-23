
CREATE TABLE public.admin_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  channels_used text[] NOT NULL DEFAULT '{}',
  recipients_count integer NOT NULL DEFAULT 0,
  email_sent integer NOT NULL DEFAULT 0,
  push_sent integer NOT NULL DEFAULT 0,
  telegram_sent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage broadcasts"
  ON public.admin_broadcasts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

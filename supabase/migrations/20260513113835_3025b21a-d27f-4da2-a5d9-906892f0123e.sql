
CREATE TABLE public.webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] DEFAULT '{}',
  device_name text NOT NULL DEFAULT 'Dispositivo',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX idx_webauthn_credentials_user ON public.webauthn_credentials(user_id);

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own credentials"
  ON public.webauthn_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own credentials"
  ON public.webauthn_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- Insert/update only via service role from edge functions
CREATE POLICY "Service role manages credentials"
  ON public.webauthn_credentials FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


CREATE TABLE public.webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge text NOT NULL,
  email text,
  user_id uuid,
  type text NOT NULL CHECK (type IN ('register','login')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webauthn_challenges_challenge ON public.webauthn_challenges(challenge);

ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages challenges"
  ON public.webauthn_challenges FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE public.blackout_collection_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_month date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  parsed_dates date[] DEFAULT '{}'::date[],
  UNIQUE (user_id, target_month)
);

CREATE INDEX idx_blackout_prompts_user ON public.blackout_collection_prompts(user_id, sent_at DESC);

ALTER TABLE public.blackout_collection_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only blackout prompts"
  ON public.blackout_collection_prompts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
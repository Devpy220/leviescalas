CREATE TABLE IF NOT EXISTS public.whatsapp_swap_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  state text NOT NULL CHECK (state IN ('awaiting_schedule_pick','awaiting_target_pick','awaiting_response','done','cancelled')),
  requester_schedule_id uuid,
  candidate_target_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  candidate_target_schedule_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  current_target_user_id uuid,
  current_target_schedule_id uuid,
  attempts_count integer NOT NULL DEFAULT 0,
  swap_id uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_swap_sessions_user ON public.whatsapp_swap_sessions(user_id, state);
CREATE INDEX IF NOT EXISTS idx_whatsapp_swap_sessions_target ON public.whatsapp_swap_sessions(current_target_user_id, state);

ALTER TABLE public.whatsapp_swap_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only swap sessions"
  ON public.whatsapp_swap_sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_whatsapp_swap_sessions_updated_at
  BEFORE UPDATE ON public.whatsapp_swap_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.whatsapp_pending_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  phone text NOT NULL,
  command_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  CONSTRAINT pending_command_length CHECK (length(command_text) BETWEEN 1 AND 500)
);
GRANT ALL ON public.whatsapp_pending_commands TO service_role;
ALTER TABLE public.whatsapp_pending_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only service role manages pending WhatsApp commands" ON public.whatsapp_pending_commands FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_whatsapp_pending_commands_updated_at BEFORE UPDATE ON public.whatsapp_pending_commands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
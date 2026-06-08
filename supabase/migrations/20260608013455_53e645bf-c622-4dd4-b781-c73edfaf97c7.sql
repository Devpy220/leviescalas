CREATE TABLE public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL,
  error text,
  origin text,
  zapi_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_whatsapp_logs_created_at ON public.whatsapp_logs (created_at DESC);
CREATE INDEX idx_whatsapp_logs_phone ON public.whatsapp_logs (phone);

GRANT SELECT ON public.whatsapp_logs TO authenticated;
GRANT ALL ON public.whatsapp_logs TO service_role;

ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view whatsapp logs"
ON public.whatsapp_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages whatsapp logs"
ON public.whatsapp_logs FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
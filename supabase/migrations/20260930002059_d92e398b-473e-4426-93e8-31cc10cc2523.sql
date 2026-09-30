ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'Brasil';

CREATE TABLE public.admin_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage settings" ON public.admin_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.compliance_alert_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid,
  church_name text,
  country text NOT NULL,
  status text NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.compliance_alert_logs TO authenticated;
GRANT ALL ON public.compliance_alert_logs TO service_role;
ALTER TABLE public.compliance_alert_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read compliance logs" ON public.compliance_alert_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
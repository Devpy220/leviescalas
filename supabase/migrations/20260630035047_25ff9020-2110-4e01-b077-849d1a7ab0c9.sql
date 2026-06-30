CREATE TABLE public.cakto_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount_cents integer NOT NULL,
  mode text NOT NULL CHECK (mode IN ('one_time','subscription')),
  label text NOT NULL,
  checkout_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cakto_offers TO anon, authenticated;
GRANT ALL ON public.cakto_offers TO service_role;

ALTER TABLE public.cakto_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cakto_offers_public_read" ON public.cakto_offers
  FOR SELECT USING (active = true);

CREATE POLICY "cakto_offers_admin_all" ON public.cakto_offers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_cakto_offers_updated_at
  BEFORE UPDATE ON public.cakto_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.cakto_offers (amount_cents, mode, label, checkout_url, sort_order) VALUES
  (2000, 'one_time',     'R$ 20',       'https://pay.cakto.com.br/t67g83t',         1),
  (2500, 'one_time',     'R$ 25',       'https://pay.cakto.com.br/e2h7fy5_949404',  2),
  (5000, 'one_time',     'R$ 50',       'https://pay.cakto.com.br/bnfs4j6',         3),
  (3500, 'subscription', 'R$ 35/mês',   'https://pay.cakto.com.br/kgxm6j7',         4);

-- 1) Cakto products catalog
CREATE TABLE IF NOT EXISTS public.cakto_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL UNIQUE CHECK (kind IN ('one_time','subscription')),
  cakto_product_id text,
  cakto_price_id text,
  cakto_offer_id text,
  amount_cents integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cakto_products TO authenticated;
GRANT ALL ON public.cakto_products TO service_role;
ALTER TABLE public.cakto_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_cakto_products" ON public.cakto_products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 2) Donations / subscriptions log
CREATE TABLE IF NOT EXISTS public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_name text,
  donor_email text,
  donor_whatsapp text,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'BRL',
  mode text NOT NULL CHECK (mode IN ('one_time','subscription')),
  payment_method text CHECK (payment_method IN ('pix','credit_card','boleto')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','canceled','refunded')),
  cakto_session_id text,
  cakto_subscription_id text,
  cakto_payment_id text,
  raw_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS donations_status_idx ON public.donations(status, created_at DESC);
CREATE INDEX IF NOT EXISTS donations_session_idx ON public.donations(cakto_session_id);
CREATE INDEX IF NOT EXISTS donations_sub_idx ON public.donations(cakto_subscription_id);
GRANT SELECT ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_donations" ON public.donations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_cakto_products_updated_at ON public.cakto_products;
CREATE TRIGGER trg_cakto_products_updated_at BEFORE UPDATE ON public.cakto_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_donations_updated_at ON public.donations;
CREATE TRIGGER trg_donations_updated_at BEFORE UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Drop legacy log_billing_access trigger function (referencia stripe_customer_id)
DROP FUNCTION IF EXISTS public.log_billing_access() CASCADE;

-- 4) Regenerate get_department_secure / get_department_full WITHOUT stripe fields
DROP FUNCTION IF EXISTS public.get_department_secure(uuid);
CREATE OR REPLACE FUNCTION public.get_department_secure(dept_id uuid)
 RETURNS TABLE(id uuid, name text, description text, leader_id uuid, invite_code text, subscription_status text, trial_ends_at timestamptz, created_at timestamptz, updated_at timestamptz, user_role text, avatar_url text, coordinator_invite_code text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_user_id uuid; v_is_leader boolean; v_user_role text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT m.role::text INTO v_user_role
  FROM public.members m WHERE m.department_id = dept_id AND m.user_id = v_user_id;

  IF v_user_role IS NULL AND NOT public.is_department_coordinator(v_user_id, dept_id) THEN
    RAISE EXCEPTION 'Not a member of this department';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.departments d WHERE d.id = dept_id AND d.leader_id = v_user_id) INTO v_is_leader;

  RETURN QUERY
  SELECT d.id, d.name, d.description, d.leader_id,
    CASE WHEN v_is_leader THEN d.invite_code ELSE NULL END,
    d.subscription_status::text,
    CASE WHEN v_is_leader THEN d.trial_ends_at ELSE NULL END,
    d.created_at, d.updated_at,
    COALESCE(v_user_role,'coordinator'),
    d.avatar_url,
    CASE WHEN v_is_leader THEN d.coordinator_invite_code ELSE NULL END
  FROM public.departments d WHERE d.id = dept_id;
END; $fn$;

DROP FUNCTION IF EXISTS public.get_department_full(uuid);
CREATE OR REPLACE FUNCTION public.get_department_full(dept_id uuid)
 RETURNS TABLE(id uuid, name text, description text, leader_id uuid, invite_code text, subscription_status text, trial_ends_at timestamptz, created_at timestamptz, updated_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT d.id, d.name, d.description, d.leader_id, d.invite_code, d.subscription_status::text,
         d.trial_ends_at, d.created_at, d.updated_at
  FROM public.departments d
  WHERE d.id = dept_id AND d.leader_id = auth.uid();
$fn$;

-- 5) Drop stripe columns from departments
ALTER TABLE public.departments DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.departments DROP COLUMN IF EXISTS stripe_subscription_id;

-- 6) Drop legacy unused tables
DROP TABLE IF EXISTS public.payment_receipts CASCADE;
DROP TABLE IF EXISTS public.telegram_link_codes CASCADE;
DROP TABLE IF EXISTS public.telegram_links CASCADE;
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
DROP TABLE IF EXISTS public.pushalert_subscribers CASCADE;

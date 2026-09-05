-- 1. Legal basis catalog
CREATE TYPE public.legal_basis AS ENUM ('consentimento','execucao_contrato','interesse_legitimo','obrigacao_legal','consentimento_explicito');

CREATE TABLE public.data_processing_purposes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose text NOT NULL UNIQUE,
  legal_basis public.legal_basis NOT NULL,
  data_categories text[] NOT NULL DEFAULT '{}',
  retention_period text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.data_processing_purposes TO anon, authenticated;
GRANT ALL ON public.data_processing_purposes TO service_role;
ALTER TABLE public.data_processing_purposes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purposes_public_read" ON public.data_processing_purposes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "purposes_admin_write" ON public.data_processing_purposes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 2. Data subject requests
CREATE TYPE public.dsr_kind AS ENUM ('acesso','retificacao','portabilidade','apagamento','oposicao','limitacao');
CREATE TYPE public.dsr_status AS ENUM ('pendente','em_curso','concluido','recusado');

CREATE TABLE public.data_subject_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  kind public.dsr_kind NOT NULL,
  status public.dsr_status NOT NULL DEFAULT 'pendente',
  details text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  deadline timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.data_subject_requests TO authenticated;
GRANT ALL ON public.data_subject_requests TO service_role;
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dsr_own_select" ON public.data_subject_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "dsr_own_insert" ON public.data_subject_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "dsr_admin_update" ON public.data_subject_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3. WhatsApp consent log
CREATE TABLE public.whatsapp_consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  phone text NOT NULL,
  action text NOT NULL CHECK (action IN ('opt_in','opt_out')),
  consent_text text NOT NULL,
  source text NOT NULL DEFAULT 'web',
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.whatsapp_consent_log TO authenticated;
GRANT ALL ON public.whatsapp_consent_log TO service_role;
ALTER TABLE public.whatsapp_consent_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wcl_own_select" ON public.whatsapp_consent_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "wcl_own_insert" ON public.whatsapp_consent_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 4. Profile consent columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_text text,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS guardian_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guardian_email text,
  ADD COLUMN IF NOT EXISTS guardian_phone text,
  ADD COLUMN IF NOT EXISTS guardian_consent_token text,
  ADD COLUMN IF NOT EXISTS guardian_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_policy_version text,
  ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at timestamptz;

CREATE TRIGGER trg_dpp_updated_at BEFORE UPDATE ON public.data_processing_purposes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dsr_updated_at BEFORE UPDATE ON public.data_subject_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Functions
CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'exported_at', now(),
    'profile', (SELECT to_jsonb(p) - 'guardian_consent_token' FROM public.profiles p WHERE p.id = auth.uid()),
    'memberships', (SELECT coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) FROM public.members m WHERE m.user_id = auth.uid()),
    'schedules', (SELECT coalesce(jsonb_agg(to_jsonb(s) - 'confirmation_token'), '[]'::jsonb) FROM public.schedules s WHERE s.user_id = auth.uid()),
    'availability_week', (SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM public.member_availability a WHERE a.user_id = auth.uid()),
    'availability_dates', (SELECT coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) FROM public.member_date_availability d WHERE d.user_id = auth.uid()),
    'preferences', (SELECT coalesce(jsonb_agg(to_jsonb(pr)), '[]'::jsonb) FROM public.member_preferences pr WHERE pr.user_id = auth.uid()),
    'notifications', (SELECT coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) FROM public.notifications n WHERE n.user_id = auth.uid()),
    'whatsapp_consents', (SELECT coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) FROM public.whatsapp_consent_log w WHERE w.user_id = auth.uid()),
    'requests', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.data_subject_requests r WHERE r.user_id = auth.uid())
  );
$$;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;

CREATE OR REPLACE FUNCTION public.record_whatsapp_consent(_action text, _consent_text text, _source text DEFAULT 'web', _ip text DEFAULT NULL, _ua text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _phone text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _action NOT IN ('opt_in','opt_out') THEN RAISE EXCEPTION 'invalid action'; END IF;
  SELECT whatsapp INTO _phone FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.whatsapp_consent_log(user_id, phone, action, consent_text, source, ip_address, user_agent)
  VALUES (auth.uid(), coalesce(_phone,''), _action, _consent_text, coalesce(_source,'web'), _ip, _ua);
  IF _action = 'opt_in' THEN
    UPDATE public.profiles SET whatsapp_opt_in_at = now(), whatsapp_opt_in_text = _consent_text, whatsapp_opt_out_at = NULL WHERE id = auth.uid();
  ELSE
    UPDATE public.profiles SET whatsapp_opt_out_at = now() WHERE id = auth.uid();
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_whatsapp_consent(text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_data_subject_request(_kind public.dsr_kind, _details text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid; _email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT email INTO _email FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.data_subject_requests(user_id, email, kind, details)
  VALUES (auth.uid(), _email, _kind, _details) RETURNING id INTO _id;
  RETURN _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_data_subject_request(public.dsr_kind, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _phone text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT whatsapp INTO _phone FROM public.profiles WHERE id = _uid;

  DELETE FROM public.schedules WHERE user_id = _uid;
  DELETE FROM public.member_availability WHERE user_id = _uid;
  DELETE FROM public.member_date_availability WHERE user_id = _uid;
  DELETE FROM public.member_preferences WHERE user_id = _uid;
  DELETE FROM public.notifications WHERE user_id = _uid;
  DELETE FROM public.members WHERE user_id = _uid;
  DELETE FROM public.department_coordinators WHERE user_id = _uid;
  DELETE FROM public.login_logs WHERE user_id = _uid;
  DELETE FROM public.calendar_sync_tokens WHERE user_id = _uid;
  DELETE FROM public.webauthn_credentials WHERE user_id = _uid;
  IF _phone IS NOT NULL AND _phone <> '' THEN
    DELETE FROM public.whatsapp_queue WHERE phone = _phone;
    DELETE FROM public.whatsapp_logs WHERE phone = _phone;
  END IF;
  UPDATE public.data_subject_requests SET status = 'concluido', resolved_at = now() WHERE user_id = _uid AND status <> 'concluido';
  DELETE FROM public.profiles WHERE id = _uid;
  DELETE FROM auth.users WHERE id = _uid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_guardian_consent(_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN RETURN false; END IF;
  UPDATE public.profiles
    SET guardian_consent = true, guardian_consent_at = now(), guardian_consent_token = NULL
    WHERE guardian_consent_token = _token
    RETURNING id INTO _id;
  RETURN _id IS NOT NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.confirm_guardian_consent(text) TO anon, authenticated;
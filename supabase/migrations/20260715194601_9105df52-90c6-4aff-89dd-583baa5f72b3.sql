
-- =========================================================================
-- LeviKids Module — full schema, RLS, GRANTs, helpers
-- =========================================================================

-- Helper: check if user is the LEVI church leader
CREATE OR REPLACE FUNCTION public.is_church_leader(_user_id uuid, _church_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.churches WHERE id = _church_id AND leader_id = _user_id);
$$;

-- =========================================================================
-- kids_pages
-- =========================================================================
CREATE TABLE public.kids_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  consent_version text NOT NULL DEFAULT '1.0',
  consent_text text NOT NULL,
  primary_color text NOT NULL DEFAULT '#7C3AED',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(church_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kids_pages TO authenticated;
GRANT SELECT ON public.kids_pages TO anon;
GRANT ALL ON public.kids_pages TO service_role;
ALTER TABLE public.kids_pages ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- kids_leaders
-- =========================================================================
CREATE TABLE public.kids_leaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.kids_pages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(page_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kids_leaders TO authenticated;
GRANT ALL ON public.kids_leaders TO service_role;
ALTER TABLE public.kids_leaders ENABLE ROW LEVEL SECURITY;

-- Helper: is Kids Leader of page (or LEVI church leader of its church)
CREATE OR REPLACE FUNCTION public.is_kids_leader(_user_id uuid, _page_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kids_leaders WHERE page_id = _page_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.kids_pages p JOIN public.churches c ON c.id = p.church_id
    WHERE p.id = _page_id AND c.leader_id = _user_id
  );
$$;

-- =========================================================================
-- kids_rooms
-- =========================================================================
CREATE TABLE public.kids_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.kids_pages(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#F59E0B',
  age_min int NOT NULL DEFAULT 0,
  age_max int NOT NULL DEFAULT 12,
  static_qr_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex') UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kids_rooms TO authenticated;
GRANT SELECT ON public.kids_rooms TO anon;
GRANT ALL ON public.kids_rooms TO service_role;
ALTER TABLE public.kids_rooms ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- kids_teacher_rooms
-- =========================================================================
CREATE TABLE public.kids_teacher_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.kids_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'kids_only' CHECK (scope IN ('kids_only','kids_and_schedules')),
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kids_teacher_rooms TO authenticated;
GRANT ALL ON public.kids_teacher_rooms TO service_role;
ALTER TABLE public.kids_teacher_rooms ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_kids_teacher_of_room(_user_id uuid, _room_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kids_teacher_rooms WHERE room_id = _room_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_kids_teacher_of_page(_user_id uuid, _page_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kids_teacher_rooms tr
    JOIN public.kids_rooms r ON r.id = tr.room_id
    WHERE r.page_id = _page_id AND tr.user_id = _user_id
  );
$$;

-- =========================================================================
-- kids_guardians
-- =========================================================================
CREATE TABLE public.kids_guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text NOT NULL,
  photo_path text,
  birth_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (birth_date <= (CURRENT_DATE - INTERVAL '18 years'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kids_guardians TO authenticated;
GRANT ALL ON public.kids_guardians TO service_role;
ALTER TABLE public.kids_guardians ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- kids_children
-- =========================================================================
CREATE TABLE public.kids_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.kids_pages(id) ON DELETE CASCADE,
  suggested_room_id uuid REFERENCES public.kids_rooms(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  birth_date date NOT NULL,
  photo_path text,
  allergies text,
  restrictions text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (birth_date >= (CURRENT_DATE - INTERVAL '13 years'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kids_children TO authenticated;
GRANT ALL ON public.kids_children TO service_role;
ALTER TABLE public.kids_children ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- kids_guardian_children (N:N)
-- =========================================================================
CREATE TABLE public.kids_guardian_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id uuid NOT NULL REFERENCES public.kids_guardians(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.kids_children(id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'responsavel',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(guardian_id, child_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kids_guardian_children TO authenticated;
GRANT ALL ON public.kids_guardian_children TO service_role;
ALTER TABLE public.kids_guardian_children ENABLE ROW LEVEL SECURITY;

-- Helper: is guardian of child
CREATE OR REPLACE FUNCTION public.is_guardian_of(_user_id uuid, _child_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kids_guardian_children gc
    JOIN public.kids_guardians g ON g.id = gc.guardian_id
    WHERE gc.child_id = _child_id AND g.user_id = _user_id
  );
$$;

-- =========================================================================
-- kids_consents
-- =========================================================================
CREATE TABLE public.kids_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page_id uuid NOT NULL REFERENCES public.kids_pages(id) ON DELETE CASCADE,
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  UNIQUE(user_id, page_id, version)
);
GRANT SELECT, INSERT ON public.kids_consents TO authenticated;
GRANT ALL ON public.kids_consents TO service_role;
ALTER TABLE public.kids_consents ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- kids_checkins
-- =========================================================================
CREATE TABLE public.kids_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.kids_children(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.kids_rooms(id) ON DELETE CASCADE,
  pickup_code text NOT NULL,
  checkin_at timestamptz NOT NULL DEFAULT now(),
  checkin_by uuid NOT NULL,
  checkout_at timestamptz,
  checkout_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_kids_checkins_active ON public.kids_checkins(room_id) WHERE checkout_at IS NULL;
CREATE INDEX idx_kids_checkins_child ON public.kids_checkins(child_id);
GRANT SELECT, INSERT, UPDATE ON public.kids_checkins TO authenticated;
GRANT ALL ON public.kids_checkins TO service_role;
ALTER TABLE public.kids_checkins ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- kids_dynamic_tokens (60s rotating QR)
-- =========================================================================
CREATE TABLE public.kids_dynamic_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.kids_rooms(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_kids_dyn_tokens_room ON public.kids_dynamic_tokens(room_id, expires_at DESC);
GRANT SELECT, INSERT, DELETE ON public.kids_dynamic_tokens TO authenticated;
GRANT ALL ON public.kids_dynamic_tokens TO service_role;
ALTER TABLE public.kids_dynamic_tokens ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- kids_content
-- =========================================================================
CREATE TABLE public.kids_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.kids_pages(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.kids_rooms(id) ON DELETE CASCADE,
  content_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  body text,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_kids_content_page_date ON public.kids_content(page_id, content_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kids_content TO authenticated;
GRANT ALL ON public.kids_content TO service_role;
ALTER TABLE public.kids_content ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- POLICIES: kids_pages
-- =========================================================================
CREATE POLICY "kids_pages read for authenticated" ON public.kids_pages FOR SELECT TO authenticated USING (true);
CREATE POLICY "kids_pages read public" ON public.kids_pages FOR SELECT TO anon USING (true);
CREATE POLICY "kids_pages church leader create" ON public.kids_pages FOR INSERT TO authenticated
  WITH CHECK (public.is_church_leader(auth.uid(), church_id));
CREATE POLICY "kids_pages leader update" ON public.kids_pages FOR UPDATE TO authenticated
  USING (public.is_kids_leader(auth.uid(), id)) WITH CHECK (public.is_kids_leader(auth.uid(), id));
CREATE POLICY "kids_pages church leader delete" ON public.kids_pages FOR DELETE TO authenticated
  USING (public.is_church_leader(auth.uid(), church_id));

-- POLICIES: kids_leaders
CREATE POLICY "kids_leaders read by leader" ON public.kids_leaders FOR SELECT TO authenticated
  USING (public.is_kids_leader(auth.uid(), page_id) OR user_id = auth.uid());
CREATE POLICY "kids_leaders insert by church leader" ON public.kids_leaders FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kids_pages p JOIN public.churches c ON c.id = p.church_id
    WHERE p.id = page_id AND c.leader_id = auth.uid()
  ));
CREATE POLICY "kids_leaders delete by church leader" ON public.kids_leaders FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kids_pages p JOIN public.churches c ON c.id = p.church_id
    WHERE p.id = page_id AND c.leader_id = auth.uid()
  ));

-- POLICIES: kids_rooms
CREATE POLICY "kids_rooms read for authenticated" ON public.kids_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "kids_rooms read public" ON public.kids_rooms FOR SELECT TO anon USING (true);
CREATE POLICY "kids_rooms leader manage" ON public.kids_rooms FOR ALL TO authenticated
  USING (public.is_kids_leader(auth.uid(), page_id)) WITH CHECK (public.is_kids_leader(auth.uid(), page_id));

-- POLICIES: kids_teacher_rooms
CREATE POLICY "kids_teacher_rooms read" ON public.kids_teacher_rooms FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.kids_rooms r WHERE r.id = room_id AND public.is_kids_leader(auth.uid(), r.page_id)
  ));
CREATE POLICY "kids_teacher_rooms leader manage" ON public.kids_teacher_rooms FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kids_rooms r WHERE r.id = room_id AND public.is_kids_leader(auth.uid(), r.page_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kids_rooms r WHERE r.id = room_id AND public.is_kids_leader(auth.uid(), r.page_id)));

-- POLICIES: kids_guardians (owner-only)
CREATE POLICY "kids_guardians self" ON public.kids_guardians FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Kids leaders can read guardians of children in their page (via child join, done in RPC when needed)
CREATE POLICY "kids_guardians read by kids leader via child" ON public.kids_guardians FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kids_guardian_children gc
    JOIN public.kids_children ch ON ch.id = gc.child_id
    WHERE gc.guardian_id = kids_guardians.id AND public.is_kids_leader(auth.uid(), ch.page_id)
  ));

-- POLICIES: kids_children
CREATE POLICY "kids_children guardian manage" ON public.kids_children FOR ALL TO authenticated
  USING (public.is_guardian_of(auth.uid(), id)) WITH CHECK (created_by = auth.uid() OR public.is_guardian_of(auth.uid(), id));
CREATE POLICY "kids_children leader read all" ON public.kids_children FOR SELECT TO authenticated
  USING (public.is_kids_leader(auth.uid(), page_id));
CREATE POLICY "kids_children teacher read active" ON public.kids_children FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kids_checkins ci
    WHERE ci.child_id = kids_children.id AND ci.checkout_at IS NULL
      AND public.is_kids_teacher_of_room(auth.uid(), ci.room_id)
  ));

-- POLICIES: kids_guardian_children
CREATE POLICY "kids_guardian_children guardian" ON public.kids_guardian_children FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kids_guardians g WHERE g.id = guardian_id AND g.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kids_guardians g WHERE g.id = guardian_id AND g.user_id = auth.uid()));
CREATE POLICY "kids_guardian_children leader read" ON public.kids_guardian_children FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kids_children ch WHERE ch.id = child_id AND public.is_kids_leader(auth.uid(), ch.page_id)
  ));

-- POLICIES: kids_consents
CREATE POLICY "kids_consents self" ON public.kids_consents FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "kids_consents self insert" ON public.kids_consents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "kids_consents leader read" ON public.kids_consents FOR SELECT TO authenticated
  USING (public.is_kids_leader(auth.uid(), page_id));

-- POLICIES: kids_checkins
CREATE POLICY "kids_checkins guardian own children" ON public.kids_checkins FOR SELECT TO authenticated
  USING (public.is_guardian_of(auth.uid(), child_id));
CREATE POLICY "kids_checkins guardian insert" ON public.kids_checkins FOR INSERT TO authenticated
  WITH CHECK (public.is_guardian_of(auth.uid(), child_id) AND checkin_by = auth.uid());
CREATE POLICY "kids_checkins teacher read active room" ON public.kids_checkins FOR SELECT TO authenticated
  USING (public.is_kids_teacher_of_room(auth.uid(), room_id));
CREATE POLICY "kids_checkins teacher checkout" ON public.kids_checkins FOR UPDATE TO authenticated
  USING (public.is_kids_teacher_of_room(auth.uid(), room_id))
  WITH CHECK (public.is_kids_teacher_of_room(auth.uid(), room_id));
CREATE POLICY "kids_checkins leader read all" ON public.kids_checkins FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kids_rooms r WHERE r.id = room_id AND public.is_kids_leader(auth.uid(), r.page_id)));

-- POLICIES: kids_dynamic_tokens
CREATE POLICY "kids_dynamic_tokens read for authenticated" ON public.kids_dynamic_tokens FOR SELECT TO authenticated USING (true);
CREATE POLICY "kids_dynamic_tokens teacher or leader create" ON public.kids_dynamic_tokens FOR INSERT TO authenticated
  WITH CHECK (public.is_kids_teacher_of_room(auth.uid(), room_id) OR EXISTS (
    SELECT 1 FROM public.kids_rooms r WHERE r.id = room_id AND public.is_kids_leader(auth.uid(), r.page_id)
  ));
CREATE POLICY "kids_dynamic_tokens teacher or leader delete" ON public.kids_dynamic_tokens FOR DELETE TO authenticated
  USING (public.is_kids_teacher_of_room(auth.uid(), room_id) OR EXISTS (
    SELECT 1 FROM public.kids_rooms r WHERE r.id = room_id AND public.is_kids_leader(auth.uid(), r.page_id)
  ));

-- POLICIES: kids_content
CREATE POLICY "kids_content read authenticated" ON public.kids_content FOR SELECT TO authenticated
  USING (public.is_kids_leader(auth.uid(), page_id) OR public.is_kids_teacher_of_page(auth.uid(), page_id));
CREATE POLICY "kids_content leader or teacher write" ON public.kids_content FOR INSERT TO authenticated
  WITH CHECK ((public.is_kids_leader(auth.uid(), page_id) OR public.is_kids_teacher_of_page(auth.uid(), page_id)) AND created_by = auth.uid());
CREATE POLICY "kids_content author or leader update" ON public.kids_content FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_kids_leader(auth.uid(), page_id));
CREATE POLICY "kids_content author or leader delete" ON public.kids_content FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_kids_leader(auth.uid(), page_id));

-- =========================================================================
-- updated_at triggers
-- =========================================================================
CREATE TRIGGER trg_kids_pages_upd BEFORE UPDATE ON public.kids_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_kids_rooms_upd BEFORE UPDATE ON public.kids_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_kids_guardians_upd BEFORE UPDATE ON public.kids_guardians FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_kids_children_upd BEFORE UPDATE ON public.kids_children FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_kids_content_upd BEFORE UPDATE ON public.kids_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- RPC: rotate dynamic checkin token (returns current valid or creates new)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.kids_get_or_create_dyn_token(_room_id uuid)
RETURNS TABLE(token text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token text; v_exp timestamptz;
BEGIN
  IF NOT (public.is_kids_teacher_of_room(auth.uid(), _room_id) OR EXISTS (
    SELECT 1 FROM public.kids_rooms r WHERE r.id = _room_id AND public.is_kids_leader(auth.uid(), r.page_id)
  )) THEN
    RAISE EXCEPTION 'Not authorized for this room';
  END IF;

  -- cleanup expired
  DELETE FROM public.kids_dynamic_tokens WHERE expires_at < now() - INTERVAL '5 minutes';

  SELECT dt.token, dt.expires_at INTO v_token, v_exp
  FROM public.kids_dynamic_tokens dt
  WHERE dt.room_id = _room_id AND dt.expires_at > now()
  ORDER BY dt.expires_at DESC LIMIT 1;

  IF v_token IS NULL THEN
    v_token := encode(gen_random_bytes(16), 'hex');
    v_exp := now() + INTERVAL '60 seconds';
    INSERT INTO public.kids_dynamic_tokens (room_id, token, expires_at) VALUES (_room_id, v_token, v_exp);
  END IF;

  RETURN QUERY SELECT v_token, v_exp;
END; $$;

-- =========================================================================
-- RPC: validate dynamic token and create checkin
-- =========================================================================
CREATE OR REPLACE FUNCTION public.kids_perform_checkin(_dynamic_token text, _child_ids uuid[])
RETURNS TABLE(child_id uuid, pickup_code text, checkin_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_room_id uuid; v_cid uuid; v_code text; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT dt.room_id INTO v_room_id
  FROM public.kids_dynamic_tokens dt
  WHERE dt.token = _dynamic_token AND dt.expires_at > now()
  LIMIT 1;

  IF v_room_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired token'; END IF;

  FOREACH v_cid IN ARRAY _child_ids LOOP
    IF NOT public.is_guardian_of(auth.uid(), v_cid) THEN
      RAISE EXCEPTION 'Not guardian of child %', v_cid;
    END IF;

    -- prevent double active checkin
    IF EXISTS (SELECT 1 FROM public.kids_checkins WHERE kids_checkins.child_id = v_cid AND checkout_at IS NULL) THEN
      CONTINUE;
    END IF;

    v_code := lpad((floor(random()*10000))::int::text, 4, '0');
    INSERT INTO public.kids_checkins (child_id, room_id, pickup_code, checkin_by)
    VALUES (v_cid, v_room_id, v_code, auth.uid())
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_cid, v_code, v_id;
  END LOOP;
END; $$;

-- =========================================================================
-- RPC: checkout by pickup code
-- =========================================================================
CREATE OR REPLACE FUNCTION public.kids_perform_checkout(_checkin_id uuid, _pickup_code text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_room uuid; v_stored text;
BEGIN
  SELECT room_id, pickup_code INTO v_room, v_stored
  FROM public.kids_checkins WHERE id = _checkin_id AND checkout_at IS NULL;
  IF v_room IS NULL THEN RAISE EXCEPTION 'Check-in not found or already closed'; END IF;
  IF NOT public.is_kids_teacher_of_room(auth.uid(), v_room) AND NOT EXISTS (
    SELECT 1 FROM public.kids_rooms r WHERE r.id = v_room AND public.is_kids_leader(auth.uid(), r.page_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_stored <> _pickup_code THEN RAISE EXCEPTION 'Código inválido'; END IF;
  UPDATE public.kids_checkins SET checkout_at = now(), checkout_by = auth.uid() WHERE id = _checkin_id;
  RETURN true;
END; $$;

-- =========================================================================
-- Realtime for teacher dashboard
-- =========================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.kids_checkins;

-- =========================================================================
-- Storage policies for kids-photos (private bucket)
-- Path convention: kids/{page_id}/{child_id_or_guardian_id}/{filename}
-- =========================================================================
CREATE POLICY "kids-photos guardian upload own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kids-photos' AND owner = auth.uid());

CREATE POLICY "kids-photos guardian read own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'kids-photos' AND owner = auth.uid());

CREATE POLICY "kids-photos guardian delete own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'kids-photos' AND owner = auth.uid());

CREATE POLICY "kids-photos leader read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kids-photos' AND EXISTS (
    SELECT 1 FROM public.kids_pages p
    WHERE (storage.foldername(name))[1] = 'kids'
      AND (storage.foldername(name))[2] = p.id::text
      AND public.is_kids_leader(auth.uid(), p.id)
  )
);

CREATE POLICY "kids-photos teacher read active"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kids-photos' AND EXISTS (
    SELECT 1 FROM public.kids_children ch
    JOIN public.kids_checkins ci ON ci.child_id = ch.id
    WHERE (storage.foldername(name))[3] = ch.id::text
      AND ci.checkout_at IS NULL
      AND public.is_kids_teacher_of_room(auth.uid(), ci.room_id)
  )
);

-- =========================================================================
-- Default consent text v1.0 (used when creating a kids_page without custom text)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.kids_default_consent_text()
RETURNS text LANGUAGE sql IMMUTABLE AS $$
SELECT E'TERMO DE CONSENTIMENTO E RESPONSABILIDADE — LeviKids v1.0\n\n' ||
E'Este termo é elaborado em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD), especialmente o art. 14, e com o Estatuto da Criança e do Adolescente (Lei nº 8.069/1990 — ECA).\n\n' ||
E'1. IDENTIFICAÇÃO DO RESPONSÁVEL\nDeclaro ser maior de 18 anos e o(a) responsável legal pela(s) criança(s) que cadastrarei nesta plataforma.\n\n' ||
E'2. FINALIDADE DO TRATAMENTO DE DADOS\nAutorizo o tratamento dos dados pessoais da(s) criança(s) — nome, data de nascimento, foto, alergias, restrições e observações relevantes — exclusivamente para: (a) identificação segura no ministério infantil da igreja; (b) check-in e check-out controlados por código; (c) comunicação com o(a) responsável via WhatsApp durante o período em que a criança estiver sob os cuidados da igreja; (d) cuidado adequado quanto a alergias e restrições informadas.\n\n' ||
E'3. USO DE IMAGEM\nAs fotos cadastradas serão armazenadas em ambiente privado e criptografado, com acesso restrito ao(s) professor(es) da sala da criança durante o período de permanência e à liderança do ministério. As fotos NÃO serão publicadas em redes sociais, sites, materiais impressos ou compartilhadas com terceiros sem autorização adicional específica e por escrito.\n\n' ||
E'4. SEGURANÇA DO CHECK-OUT\nDeclaro estar ciente de que a retirada da criança somente será autorizada mediante apresentação do código pessoal de 4 dígitos gerado no ato do check-in. Comprometo-me a mantê-lo em sigilo e a não compartilhá-lo com terceiros não autorizados.\n\n' ||
E'5. MINIMIZAÇÃO DE DADOS\nNenhum dado sensível adicional (CPF, RG ou documento da criança) será coletado.\n\n' ||
E'6. DIREITOS DO TITULAR\nA qualquer momento, posso: acessar, corrigir, atualizar ou excluir os dados da(s) criança(s), inclusive as fotos, diretamente na área "Meus Dados" da plataforma. A exclusão será feita de forma definitiva e em cascata, incluindo o histórico de check-ins.\n\n' ||
E'7. COMPARTILHAMENTO\nOs dados NÃO serão compartilhados com terceiros externos à igreja. O aplicativo LEVI atua como operador dos dados conforme instrução da igreja controladora.\n\n' ||
E'8. RETENÇÃO\nOs dados serão mantidos enquanto o vínculo com o ministério infantil estiver ativo ou até que o(a) responsável solicite a exclusão.\n\n' ||
E'9. ACEITE\nAo marcar a opção de aceite, declaro ter lido, compreendido e concordado integralmente com este Termo, autorizando o tratamento dos dados nos termos aqui descritos.';
$$;

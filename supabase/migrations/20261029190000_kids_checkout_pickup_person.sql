-- ============================================================
-- LeviKids: registrar QUEM retirou a criança + controle de avisos por WhatsApp
-- ============================================================

-- 1) Colunas novas em kids_checkins
ALTER TABLE public.kids_checkins
  ADD COLUMN IF NOT EXISTS pickup_guardian_id uuid REFERENCES public.kids_guardians(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pickup_person_name text,
  ADD COLUMN IF NOT EXISTS pickup_is_registered boolean,
  ADD COLUMN IF NOT EXISTS checkin_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkout_notified_at timestamptz;

ALTER TABLE public.kids_checkins
  DROP CONSTRAINT IF EXISTS kids_checkins_pickup_name_len;
ALTER TABLE public.kids_checkins
  ADD CONSTRAINT kids_checkins_pickup_name_len
  CHECK (pickup_person_name IS NULL OR char_length(btrim(pickup_person_name)) BETWEEN 2 AND 120);

-- 2) Lista de responsáveis cadastrados da criança (só nome + parentesco, sem telefone)
--    Acesso: líder da página ou professor escalado HOJE na sala do check-in.
CREATE OR REPLACE FUNCTION public.kids_checkout_candidates(_checkin_id uuid)
RETURNS TABLE(guardian_id uuid, full_name text, relationship text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_room uuid; v_page uuid; v_child uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT c.room_id, r.page_id, c.child_id INTO v_room, v_page, v_child
  FROM public.kids_checkins c
  JOIN public.kids_rooms r ON r.id = c.room_id
  WHERE c.id = _checkin_id AND c.checkout_at IS NULL;
  IF v_room IS NULL THEN RAISE EXCEPTION 'Check-in não encontrado ou já finalizado'; END IF;

  IF NOT public.is_kids_leader(auth.uid(), v_page)
     AND NOT public.is_kids_teacher_scheduled_today(auth.uid(), v_room) THEN
    RAISE EXCEPTION 'Você não está escalado nesta sala hoje';
  END IF;

  RETURN QUERY
  SELECT g.id, g.full_name, gc.relationship
  FROM public.kids_guardian_children gc
  JOIN public.kids_guardians g ON g.id = gc.guardian_id
  WHERE gc.child_id = v_child
  ORDER BY g.full_name;
END; $$;

-- 3) Check-out agora EXIGE informar quem retirou
DROP FUNCTION IF EXISTS public.kids_perform_checkout(uuid);

CREATE OR REPLACE FUNCTION public.kids_perform_checkout(
  _checkin_id uuid,
  _pickup_guardian_id uuid DEFAULT NULL,
  _pickup_person_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_room uuid; v_page uuid; v_child uuid;
  v_name text; v_registered boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT c.room_id, r.page_id, c.child_id INTO v_room, v_page, v_child
  FROM public.kids_checkins c
  JOIN public.kids_rooms r ON r.id = c.room_id
  WHERE c.id = _checkin_id AND c.checkout_at IS NULL
  FOR UPDATE OF c;
  IF v_room IS NULL THEN RAISE EXCEPTION 'Check-in não encontrado ou já finalizado'; END IF;

  -- Líder da página sempre pode; professor precisa estar escalado HOJE nesta sala
  IF NOT public.is_kids_leader(auth.uid(), v_page)
     AND NOT public.is_kids_teacher_scheduled_today(auth.uid(), v_room) THEN
    RAISE EXCEPTION 'Você não está escalado nesta sala hoje';
  END IF;

  IF _pickup_guardian_id IS NOT NULL THEN
    -- Responsável cadastrado: precisa estar vinculado a ESTA criança
    SELECT g.full_name INTO v_name
    FROM public.kids_guardian_children gc
    JOIN public.kids_guardians g ON g.id = gc.guardian_id
    WHERE gc.child_id = v_child AND gc.guardian_id = _pickup_guardian_id;
    IF v_name IS NULL THEN RAISE EXCEPTION 'Responsável não vinculado a esta criança'; END IF;
    v_registered := true;
  ELSE
    -- Outra pessoa: nome obrigatório (remove caracteres de controle e espaços repetidos)
    v_name := btrim(regexp_replace(regexp_replace(coalesce(_pickup_person_name, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g'));
    IF char_length(v_name) < 2 THEN RAISE EXCEPTION 'Informe o nome de quem está retirando a criança'; END IF;
    IF char_length(v_name) > 120 THEN RAISE EXCEPTION 'Nome muito longo'; END IF;
    v_registered := false;
  END IF;

  UPDATE public.kids_checkins
  SET checkout_at = now(),
      checkout_by = auth.uid(),
      pickup_guardian_id = _pickup_guardian_id,
      pickup_person_name = v_name,
      pickup_is_registered = v_registered
  WHERE id = _checkin_id;
  RETURN true;
END; $$;

REVOKE EXECUTE ON FUNCTION public.kids_perform_checkout(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kids_perform_checkout(uuid, uuid, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.kids_checkout_candidates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kids_checkout_candidates(uuid) TO authenticated, service_role;

-- 4) Trava: a policy de UPDATE do professor permitiria dar check-out direto na tabela,
--    pulando o registro de quem retirou. O gatilho fecha esse caminho.
CREATE OR REPLACE FUNCTION public.kids_checkins_require_pickup()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.checkout_at IS NULL AND NEW.checkout_at IS NOT NULL
     AND (NEW.pickup_person_name IS NULL OR btrim(NEW.pickup_person_name) = '') THEN
    RAISE EXCEPTION 'Informe quem está retirando a criança (use kids_perform_checkout)';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_kids_checkins_require_pickup ON public.kids_checkins;
CREATE TRIGGER trg_kids_checkins_require_pickup
  BEFORE UPDATE ON public.kids_checkins
  FOR EACH ROW EXECUTE FUNCTION public.kids_checkins_require_pickup();

REVOKE EXECUTE ON FUNCTION public.kids_checkins_require_pickup() FROM PUBLIC, anon, authenticated;

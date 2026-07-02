
-- Block/unblock volunteer per department (soft, no delete)
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_by uuid;

CREATE INDEX IF NOT EXISTS idx_members_blocked ON public.members(department_id) WHERE is_blocked;

-- Trigger: prevent scheduling a blocked member
CREATE OR REPLACE FUNCTION public.prevent_schedule_for_blocked_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_blocked boolean; v_name text;
BEGIN
  SELECT m.is_blocked INTO v_blocked
    FROM public.members m
   WHERE m.department_id = NEW.department_id AND m.user_id = NEW.user_id;
  IF v_blocked THEN
    SELECT name INTO v_name FROM public.profiles WHERE id = NEW.user_id;
    RAISE EXCEPTION 'Voluntário % está bloqueado neste departamento. Desbloqueie antes de escalar.', COALESCE(v_name, 'selecionado');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_prevent_schedule_for_blocked_member ON public.schedules;
CREATE TRIGGER trg_prevent_schedule_for_blocked_member
BEFORE INSERT OR UPDATE OF user_id ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.prevent_schedule_for_blocked_member();

-- RPC for leader to block/unblock
CREATE OR REPLACE FUNCTION public.set_member_blocked(dept_id uuid, target_user_id uuid, blocked boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_department_leader(auth.uid(), dept_id) THEN
    RAISE EXCEPTION 'Apenas o líder pode bloquear/desbloquear voluntários';
  END IF;
  UPDATE public.members
     SET is_blocked = blocked,
         blocked_at = CASE WHEN blocked THEN now() ELSE NULL END,
         blocked_by = CASE WHEN blocked THEN auth.uid() ELSE NULL END
   WHERE department_id = dept_id AND user_id = target_user_id;
  RETURN true;
END; $$;

-- RPC for self-unblock via WhatsApp (service role in edge function)
CREATE OR REPLACE FUNCTION public.unblock_member_by_phone(p_phone text)
RETURNS TABLE(department_id uuid, department_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid; v_norm text; v_tail text;
BEGIN
  v_norm := regexp_replace(COALESCE(p_phone,''), '\D', '', 'g');
  v_tail := right(v_norm, 10);
  IF length(v_tail) < 10 THEN RETURN; END IF;
  SELECT id INTO v_user_id FROM public.profiles
   WHERE right(regexp_replace(COALESCE(whatsapp,''), '\D', '', 'g'), 10) = v_tail
   LIMIT 1;
  IF v_user_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
    WITH upd AS (
      UPDATE public.members m
         SET is_blocked = false, blocked_at = NULL, blocked_by = NULL
       WHERE m.user_id = v_user_id AND m.is_blocked = true
       RETURNING m.department_id
    )
    SELECT d.id, d.name FROM upd JOIN public.departments d ON d.id = upd.department_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.set_member_blocked(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_member_by_phone(text) TO service_role;

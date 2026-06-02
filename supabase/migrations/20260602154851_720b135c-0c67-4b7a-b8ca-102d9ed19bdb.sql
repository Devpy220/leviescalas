-- Tabela de observações/links compartilhados por slot de escala
-- (departamento + data + horário). Editável por qualquer escalado nesse slot.

CREATE TABLE public.slot_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL,
  date DATE NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, date, time_start, time_end)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slot_notes TO authenticated;
GRANT ALL ON public.slot_notes TO service_role;

ALTER TABLE public.slot_notes ENABLE ROW LEVEL SECURITY;

-- Helper: verifica se o usuário está escalado naquele slot
CREATE OR REPLACE FUNCTION public.is_scheduled_in_slot(
  _user_id UUID, _department_id UUID, _date DATE, _time_start TIME, _time_end TIME
)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.schedules s
    WHERE s.department_id = _department_id
      AND s.date = _date
      AND s.time_start = _time_start
      AND s.time_end = _time_end
      AND s.user_id = _user_id
  );
$$;

-- Membros do depto podem ver as observações do slot
CREATE POLICY "Members view slot notes"
ON public.slot_notes FOR SELECT TO authenticated
USING (
  public.is_department_member(auth.uid(), department_id)
  OR public.is_department_coordinator(auth.uid(), department_id)
  OR public.is_department_leader(auth.uid(), department_id)
);

-- Escalados no slot OU líder podem inserir
CREATE POLICY "Scheduled or leader insert slot notes"
ON public.slot_notes FOR INSERT TO authenticated
WITH CHECK (
  public.is_department_leader(auth.uid(), department_id)
  OR public.is_scheduled_in_slot(auth.uid(), department_id, date, time_start, time_end)
);

-- Escalados no slot OU líder podem atualizar
CREATE POLICY "Scheduled or leader update slot notes"
ON public.slot_notes FOR UPDATE TO authenticated
USING (
  public.is_department_leader(auth.uid(), department_id)
  OR public.is_scheduled_in_slot(auth.uid(), department_id, date, time_start, time_end)
)
WITH CHECK (
  public.is_department_leader(auth.uid(), department_id)
  OR public.is_scheduled_in_slot(auth.uid(), department_id, date, time_start, time_end)
);

-- Apenas líder pode deletar
CREATE POLICY "Leaders delete slot notes"
ON public.slot_notes FOR DELETE TO authenticated
USING (public.is_department_leader(auth.uid(), department_id));

CREATE TRIGGER update_slot_notes_updated_at
BEFORE UPDATE ON public.slot_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_slot_notes_lookup
ON public.slot_notes (department_id, date, time_start, time_end);

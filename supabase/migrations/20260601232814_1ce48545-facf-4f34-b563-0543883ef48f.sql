CREATE TABLE public.escala_repertorio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escala_id uuid NOT NULL,
  repertorio_id uuid NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escala_id, repertorio_id)
);

CREATE INDEX idx_escala_repertorio_escala ON public.escala_repertorio(escala_id);
CREATE INDEX idx_escala_repertorio_rep ON public.escala_repertorio(repertorio_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_repertorio TO authenticated;
GRANT ALL ON public.escala_repertorio TO service_role;

ALTER TABLE public.escala_repertorio ENABLE ROW LEVEL SECURITY;

-- Members of the schedule's department can view
CREATE POLICY "Department members view escala_repertorio"
ON public.escala_repertorio FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.schedules s
    WHERE s.id = escala_repertorio.escala_id
      AND (
        is_department_member(auth.uid(), s.department_id)
        OR is_department_coordinator(auth.uid(), s.department_id)
        OR is_department_leader(auth.uid(), s.department_id)
      )
  )
);

-- Only leaders can manage
CREATE POLICY "Leaders insert escala_repertorio"
ON public.escala_repertorio FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.schedules s
    WHERE s.id = escala_repertorio.escala_id
      AND is_department_leader(auth.uid(), s.department_id)
  )
);

CREATE POLICY "Leaders update escala_repertorio"
ON public.escala_repertorio FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.schedules s
    WHERE s.id = escala_repertorio.escala_id
      AND is_department_leader(auth.uid(), s.department_id)
  )
);

CREATE POLICY "Leaders delete escala_repertorio"
ON public.escala_repertorio FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.schedules s
    WHERE s.id = escala_repertorio.escala_id
      AND is_department_leader(auth.uid(), s.department_id)
  )
);

CREATE POLICY "Admins manage escala_repertorio"
ON public.escala_repertorio FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
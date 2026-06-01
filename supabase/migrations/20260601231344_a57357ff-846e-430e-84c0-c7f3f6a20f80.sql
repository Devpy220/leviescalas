CREATE TABLE public.repertorio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  departamento_id uuid NOT NULL,
  titulo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('musica','video','cifra','documento','link')),
  url text,
  cifra text,
  tom text,
  bpm integer,
  tags text[] DEFAULT '{}'::text[],
  observacoes text,
  criado_por uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  ativo boolean NOT NULL DEFAULT true
);

CREATE INDEX idx_repertorio_dept ON public.repertorio(departamento_id) WHERE ativo = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repertorio TO authenticated;
GRANT ALL ON public.repertorio TO service_role;

ALTER TABLE public.repertorio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view repertorio"
ON public.repertorio FOR SELECT TO authenticated
USING (
  public.is_department_member(auth.uid(), departamento_id)
  OR public.is_department_coordinator(auth.uid(), departamento_id)
  OR public.is_department_leader(auth.uid(), departamento_id)
);

CREATE POLICY "Leaders insert repertorio"
ON public.repertorio FOR INSERT TO authenticated
WITH CHECK (
  public.is_department_leader(auth.uid(), departamento_id)
  AND criado_por = auth.uid()
);

CREATE POLICY "Leaders update repertorio"
ON public.repertorio FOR UPDATE TO authenticated
USING (public.is_department_leader(auth.uid(), departamento_id))
WITH CHECK (public.is_department_leader(auth.uid(), departamento_id));

CREATE POLICY "Leaders delete repertorio"
ON public.repertorio FOR DELETE TO authenticated
USING (public.is_department_leader(auth.uid(), departamento_id));

CREATE POLICY "Admins manage repertorio"
ON public.repertorio FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
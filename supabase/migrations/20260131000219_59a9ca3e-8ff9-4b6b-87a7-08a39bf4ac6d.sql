-- Criar enum para status da troca
CREATE TYPE swap_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');

-- Criar tabela de trocas
CREATE TABLE public.schedule_swaps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  requester_schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  target_schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  status swap_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Habilitar RLS
ALTER TABLE public.schedule_swaps ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
-- Membros do departamento podem ver trocas
CREATE POLICY "Members can view department swaps"
ON public.schedule_swaps FOR SELECT
USING (is_department_member(auth.uid(), department_id));

-- Usuários podem criar solicitações de troca para suas próprias escalas
CREATE POLICY "Users can create swap requests"
ON public.schedule_swaps FOR INSERT
WITH CHECK (requester_user_id = auth.uid());

-- Usuários podem atualizar trocas onde são o alvo (aceitar/recusar) ou solicitante (cancelar)
CREATE POLICY "Users can respond to or cancel swaps"
ON public.schedule_swaps FOR UPDATE
USING (target_user_id = auth.uid() OR requester_user_id = auth.uid());

-- Solicitante pode cancelar sua própria solicitação pendente
CREATE POLICY "Requesters can delete pending swaps"
ON public.schedule_swaps FOR DELETE
USING (requester_user_id = auth.uid() AND status = 'pending');

-- Função para executar a troca de escalas
CREATE OR REPLACE FUNCTION public.execute_schedule_swap(swap_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  swap_record schedule_swaps%ROWTYPE;
BEGIN
  -- Buscar a troca
  SELECT * INTO swap_record FROM schedule_swaps WHERE id = swap_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Swap not found';
  END IF;
  
  IF swap_record.status != 'accepted' THEN
    RAISE EXCEPTION 'Swap must be accepted before execution';
  END IF;

  -- Trocar os user_ids das escalas
  UPDATE schedules SET user_id = swap_record.target_user_id 
  WHERE id = swap_record.requester_schedule_id;
  
  UPDATE schedules SET user_id = swap_record.requester_user_id 
  WHERE id = swap_record.target_schedule_id;
  
  -- Marcar troca como resolvida
  UPDATE schedule_swaps SET resolved_at = now() WHERE id = swap_id;
END;
$$;

-- Habilitar realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_swaps;
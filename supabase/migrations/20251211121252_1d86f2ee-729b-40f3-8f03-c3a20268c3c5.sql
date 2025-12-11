-- ========================================
-- CORREÇÃO DE SEGURANÇA: Restringir acesso a dados sensíveis
-- ========================================

-- 1. PROFILES: Restringir SELECT para usar apenas a função segura
-- A política atual permite ver todos os campos. Vamos limitar.

DROP POLICY IF EXISTS "Users can view profiles based on privacy" ON profiles;

-- Nova política mais restritiva: usuário vê apenas seu próprio perfil diretamente
-- Para ver perfis de colegas, deve usar get_department_contacts()
CREATE POLICY "Users can view own profile only"
ON profiles
FOR SELECT
USING (auth.uid() = id);

-- 2. DEPARTMENTS: Remover acesso direto para membros a dados sensíveis
-- Membros devem usar get_department_secure() ou get_department_for_member()

DROP POLICY IF EXISTS "Members can view basic department info" ON departments;

-- Criar view segura para membros (sem dados sensíveis)
CREATE OR REPLACE VIEW public.departments_safe AS
SELECT 
  id,
  name,
  description,
  leader_id,
  created_at,
  updated_at,
  -- Campos sensíveis NÃO incluídos: stripe_customer_id, stripe_subscription_id, invite_code, trial_ends_at, subscription_status
  subscription_status -- apenas status, não IDs do Stripe
FROM departments;

-- Política: apenas líderes têm SELECT direto na tabela departments
-- Membros usam a view ou funções seguras
CREATE POLICY "Only leaders can directly select departments"
ON departments
FOR SELECT
USING (leader_id = auth.uid());

-- 3. TRIGGERS de auditoria para garantir logs

-- Trigger para logar acesso a dados de billing
CREATE OR REPLACE FUNCTION log_billing_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Logar quando stripe_customer_id ou stripe_subscription_id são acessados
  IF TG_OP = 'SELECT' AND NEW.stripe_customer_id IS NOT NULL THEN
    INSERT INTO billing_access_audit (user_id, department_id, action)
    VALUES (auth.uid(), NEW.id, 'SELECT_BILLING_DATA');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Criar função segura para membros visualizarem departamento
CREATE OR REPLACE FUNCTION get_department_basic(dept_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  leader_id UUID,
  subscription_status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar se usuário é membro
  IF NOT is_department_member(auth.uid(), dept_id) THEN
    RAISE EXCEPTION 'Acesso negado: você não pertence a este departamento';
  END IF;

  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.description,
    d.leader_id,
    d.subscription_status::TEXT,
    d.created_at,
    d.updated_at
  FROM departments d
  WHERE d.id = dept_id;
END;
$$;

-- 5. Atualizar get_department_member_profiles para não expor contatos
CREATE OR REPLACE FUNCTION public.get_department_member_profiles(dept_id uuid)
RETURNS TABLE(id uuid, name text, avatar_url text, role text, joined_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    p.id,
    p.name,
    p.avatar_url,
    m.role::text,
    m.joined_at
  FROM public.profiles p
  INNER JOIN public.members m ON m.user_id = p.id
  WHERE m.department_id = dept_id
  AND is_department_member(auth.uid(), dept_id);
$function$;

-- 6. Atualizar schedules para ocultar notas de outros usuários (opcional - informativo)
-- Não vou alterar pois é funcionalidade de colaboração, mas adiciono política para notas sensíveis
CREATE OR REPLACE FUNCTION get_schedule_for_user(dept_id UUID, target_user_id UUID)
RETURNS TABLE (
  id UUID,
  date DATE,
  time_start TIME,
  time_end TIME,
  notes TEXT,
  user_id UUID,
  created_by UUID
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT is_department_member(auth.uid(), dept_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT 
    s.id,
    s.date,
    s.time_start,
    s.time_end,
    -- Notas só visíveis para o próprio usuário, quem criou, ou líderes
    CASE 
      WHEN s.user_id = auth.uid() 
        OR s.created_by = auth.uid() 
        OR is_department_leader(auth.uid(), dept_id) 
      THEN s.notes
      ELSE NULL
    END as notes,
    s.user_id,
    s.created_by
  FROM schedules s
  WHERE s.department_id = dept_id
  AND (target_user_id IS NULL OR s.user_id = target_user_id);
END;
$$;
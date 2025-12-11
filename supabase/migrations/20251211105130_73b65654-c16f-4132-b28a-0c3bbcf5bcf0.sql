-- ========================================
-- TABELA DE AUDITORIA PARA ACESSOS A DADOS DE FATURAMENTO
-- ========================================

CREATE TABLE public.billing_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  department_id UUID NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consultas eficientes
CREATE INDEX idx_billing_audit_user_id ON public.billing_access_audit(user_id);
CREATE INDEX idx_billing_audit_department_id ON public.billing_access_audit(department_id);
CREATE INDEX idx_billing_audit_created_at ON public.billing_access_audit(created_at DESC);

-- RLS para a tabela de auditoria (apenas líderes podem ver logs de seus departamentos)
ALTER TABLE public.billing_access_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaders can view audit logs for their departments"
ON public.billing_access_audit
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id = billing_access_audit.department_id
    AND d.leader_id = auth.uid()
  )
);

-- ========================================
-- FUNÇÃO SEGURA PARA OBTER DEPARTAMENTOS
-- ========================================

CREATE OR REPLACE FUNCTION public.get_department_secure(dept_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  leader_id UUID,
  invite_code TEXT,
  subscription_status TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  user_role TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_leader BOOLEAN;
  v_user_role TEXT;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Check if user is a member of the department
  SELECT m.role::TEXT INTO v_user_role
  FROM public.members m
  WHERE m.department_id = dept_id AND m.user_id = v_user_id;
  
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this department';
  END IF;
  
  -- Check if user is leader
  SELECT EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id = dept_id AND d.leader_id = v_user_id
  ) INTO v_is_leader;
  
  -- Log access if user is accessing billing data (leader)
  IF v_is_leader THEN
    INSERT INTO public.billing_access_audit (user_id, department_id, action)
    VALUES (v_user_id, dept_id, 'VIEW_BILLING_DATA');
  END IF;
  
  -- Return data with conditional stripe fields
  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.description,
    d.leader_id,
    CASE 
      WHEN v_is_leader THEN d.invite_code 
      ELSE NULL 
    END as invite_code,
    d.subscription_status::TEXT,
    CASE 
      WHEN v_is_leader THEN d.stripe_customer_id
      ELSE NULL
    END as stripe_customer_id,
    CASE 
      WHEN v_is_leader THEN d.stripe_subscription_id
      ELSE NULL
    END as stripe_subscription_id,
    CASE 
      WHEN v_is_leader THEN d.trial_ends_at
      ELSE NULL
    END as trial_ends_at,
    d.created_at,
    d.updated_at,
    v_user_role as user_role
  FROM public.departments d
  WHERE d.id = dept_id;
END;
$$;

-- ========================================
-- FUNÇÃO PARA LISTAR LOGS DE AUDITORIA
-- ========================================

CREATE OR REPLACE FUNCTION public.get_billing_audit_logs(dept_id UUID, limit_count INT DEFAULT 100)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  action TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is department leader
  IF NOT EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id = dept_id AND d.leader_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only department leaders can view audit logs';
  END IF;
  
  RETURN QUERY
  SELECT 
    a.id,
    a.user_id,
    p.name as user_name,
    a.action,
    a.created_at
  FROM public.billing_access_audit a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  WHERE a.department_id = dept_id
  ORDER BY a.created_at DESC
  LIMIT limit_count;
END;
$$;
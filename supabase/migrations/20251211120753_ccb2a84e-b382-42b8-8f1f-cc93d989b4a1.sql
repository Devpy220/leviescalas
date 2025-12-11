-- ========================================
-- CENÁRIO 4: Compartilhamento controlado de contatos
-- ========================================

-- Adicionar coluna de controle de privacidade
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS share_contact BOOLEAN DEFAULT FALSE;

-- Remover políticas antigas de SELECT
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Nova política: ver próprio perfil OU perfis básicos de colegas de departamento
CREATE POLICY "Users can view profiles based on privacy"
ON profiles
FOR SELECT
USING (
  -- Sempre pode ver próprio perfil completo
  auth.uid() = id
  OR
  -- Pode ver perfis de colegas do mesmo departamento
  EXISTS (
    SELECT 1
    FROM members m1
    INNER JOIN members m2 ON m1.department_id = m2.department_id
    WHERE m1.user_id = auth.uid()
    AND m2.user_id = profiles.id
  )
);

-- ========================================
-- Função para obter contatos do departamento com privacidade
-- ========================================
CREATE OR REPLACE FUNCTION get_department_contacts(dept_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  avatar_url TEXT,
  email TEXT,
  whatsapp TEXT,
  role TEXT,
  share_contact BOOLEAN
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar se o usuário pertence ao departamento
  IF NOT is_department_member(auth.uid(), dept_id) THEN
    RAISE EXCEPTION 'Acesso negado: você não pertence a este departamento';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.avatar_url,
    CASE 
      -- Mostrar email se é o próprio usuário ou se optou por compartilhar
      WHEN p.id = auth.uid() OR p.share_contact = TRUE THEN p.email
      ELSE '***@***'::TEXT
    END as email,
    CASE 
      -- Mostrar WhatsApp se é o próprio usuário ou se optou por compartilhar
      WHEN p.id = auth.uid() OR p.share_contact = TRUE THEN p.whatsapp
      ELSE '***'::TEXT
    END as whatsapp,
    m.role::TEXT,
    p.share_contact
  FROM profiles p
  INNER JOIN members m ON m.user_id = p.id
  WHERE m.department_id = dept_id
  ORDER BY m.role DESC, p.name;
END;
$$;

-- ========================================
-- Função para usuário atualizar sua privacidade
-- ========================================
CREATE OR REPLACE FUNCTION update_contact_privacy(share BOOLEAN)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
  SET share_contact = share,
      updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

-- ========================================
-- Tabela de auditoria de acesso a perfis sensíveis
-- ========================================
CREATE TABLE IF NOT EXISTS profile_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accessor_user_id UUID NOT NULL,
  accessed_profile_id UUID NOT NULL,
  department_id UUID,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_profile_access_audit_timestamp ON profile_access_audit(accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_access_audit_accessor ON profile_access_audit(accessor_user_id);

-- RLS para auditoria
ALTER TABLE profile_access_audit ENABLE ROW LEVEL SECURITY;

-- Apenas leaders podem ver logs de seus departamentos
CREATE POLICY "Leaders can view audit logs"
ON profile_access_audit
FOR SELECT
USING (
  department_id IS NOT NULL AND is_department_leader(auth.uid(), department_id)
);

-- Sistema pode inserir logs
CREATE POLICY "System can insert audit logs"
ON profile_access_audit
FOR INSERT
WITH CHECK (accessor_user_id = auth.uid());
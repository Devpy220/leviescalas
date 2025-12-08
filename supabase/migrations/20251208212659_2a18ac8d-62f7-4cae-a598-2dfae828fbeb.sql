-- Enum para roles de membros
CREATE TYPE public.member_role AS ENUM ('leader', 'member');

-- Enum para status de assinatura
CREATE TYPE public.subscription_status AS ENUM ('active', 'trial', 'cancelled', 'expired', 'pending');

-- Enum para status de notificação
CREATE TYPE public.notification_status AS ENUM ('pending', 'sent', 'failed');

-- Tabela de perfis de usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabela de departamentos
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  leader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  subscription_status public.subscription_status DEFAULT 'pending' NOT NULL,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabela de membros (relacionamento many-to-many entre usuários e departamentos)
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.member_role DEFAULT 'member' NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(department_id, user_id)
);

-- Tabela de escalas
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabela de notificações
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  status public.notification_status DEFAULT 'pending' NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índices para performance
CREATE INDEX idx_departments_leader ON public.departments(leader_id);
CREATE INDEX idx_departments_invite_code ON public.departments(invite_code);
CREATE INDEX idx_members_department ON public.members(department_id);
CREATE INDEX idx_members_user ON public.members(user_id);
CREATE INDEX idx_schedules_department ON public.schedules(department_id);
CREATE INDEX idx_schedules_user ON public.schedules(user_id);
CREATE INDEX idx_schedules_date ON public.schedules(date);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_status ON public.notifications(status);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para verificar se é líder do departamento
CREATE OR REPLACE FUNCTION public.is_department_leader(_user_id UUID, _department_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.departments
    WHERE id = _department_id AND leader_id = _user_id
  )
$$;

-- Função auxiliar para verificar se é membro do departamento
CREATE OR REPLACE FUNCTION public.is_department_member(_user_id UUID, _department_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE department_id = _department_id AND user_id = _user_id
  )
$$;

-- Políticas RLS para profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Members can view profiles in same department"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m1
      JOIN public.members m2 ON m1.department_id = m2.department_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id
    )
  );

-- Políticas RLS para departments
CREATE POLICY "Leaders can manage own departments"
  ON public.departments FOR ALL
  TO authenticated
  USING (leader_id = auth.uid());

CREATE POLICY "Members can view their departments"
  ON public.departments FOR SELECT
  TO authenticated
  USING (
    public.is_department_member(auth.uid(), id)
  );

CREATE POLICY "Anyone can view department by invite code"
  ON public.departments FOR SELECT
  TO authenticated
  USING (invite_code IS NOT NULL);

-- Políticas RLS para members
CREATE POLICY "Leaders can manage department members"
  ON public.members FOR ALL
  TO authenticated
  USING (public.is_department_leader(auth.uid(), department_id));

CREATE POLICY "Members can view department members"
  ON public.members FOR SELECT
  TO authenticated
  USING (public.is_department_member(auth.uid(), department_id));

CREATE POLICY "Users can add themselves as members"
  ON public.members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove themselves from department"
  ON public.members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Políticas RLS para schedules
CREATE POLICY "Leaders can manage department schedules"
  ON public.schedules FOR ALL
  TO authenticated
  USING (public.is_department_leader(auth.uid(), department_id));

CREATE POLICY "Members can view department schedules"
  ON public.schedules FOR SELECT
  TO authenticated
  USING (public.is_department_member(auth.uid(), department_id));

-- Políticas RLS para notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Leaders can manage notifications for their departments"
  ON public.notifications FOR ALL
  TO authenticated
  USING (
    department_id IS NOT NULL AND public.is_department_leader(auth.uid(), department_id)
  );

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar perfil automaticamente quando usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, whatsapp)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'whatsapp', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger para criar perfil automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Habilitar realtime para tabelas principais
ALTER PUBLICATION supabase_realtime ADD TABLE public.departments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules;
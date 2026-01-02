-- Tabela de disponibilidade semanal dos membros
CREATE TABLE public.member_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  department_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, department_id, day_of_week, time_start, time_end)
);

-- Tabela de preferências dos membros
CREATE TABLE public.member_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  department_id UUID NOT NULL,
  max_schedules_per_month INTEGER NOT NULL DEFAULT 4,
  preferred_sector_ids UUID[] DEFAULT '{}',
  blackout_dates DATE[] DEFAULT '{}',
  min_days_between_schedules INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, department_id)
);

-- Enable RLS
ALTER TABLE public.member_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for member_availability
CREATE POLICY "Users can view own availability"
  ON public.member_availability
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own availability"
  ON public.member_availability
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Leaders can view department availability"
  ON public.member_availability
  FOR SELECT
  USING (is_department_leader(auth.uid(), department_id));

CREATE POLICY "Members can view department availability"
  ON public.member_availability
  FOR SELECT
  USING (is_department_member(auth.uid(), department_id));

-- RLS policies for member_preferences
CREATE POLICY "Users can view own preferences"
  ON public.member_preferences
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own preferences"
  ON public.member_preferences
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Leaders can view department preferences"
  ON public.member_preferences
  FOR SELECT
  USING (is_department_leader(auth.uid(), department_id));

-- Triggers for updated_at
CREATE TRIGGER update_member_availability_updated_at
  BEFORE UPDATE ON public.member_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_preferences_updated_at
  BEFORE UPDATE ON public.member_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
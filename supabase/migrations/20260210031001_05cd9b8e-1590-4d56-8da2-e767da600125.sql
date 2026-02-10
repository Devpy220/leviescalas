
-- Function to check cross-department conflicts
CREATE OR REPLACE FUNCTION public.check_cross_department_conflicts(
  p_user_ids UUID[],
  p_date DATE,
  p_time_start TIME,
  p_time_end TIME,
  p_exclude_department_id UUID
)
RETURNS TABLE(user_id UUID, conflict_department_name TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT s.user_id, d.name AS conflict_department_name
  FROM public.schedules s
  INNER JOIN public.departments d ON d.id = s.department_id
  WHERE s.user_id = ANY(p_user_ids)
    AND s.date = p_date
    AND s.department_id != p_exclude_department_id
    AND s.time_start < p_time_end
    AND s.time_end > p_time_start;
END;
$$;

-- Trigger function to prevent cross-department schedule conflicts on INSERT
CREATE OR REPLACE FUNCTION public.prevent_cross_department_schedule_conflict()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conflict_dept TEXT;
BEGIN
  SELECT d.name INTO v_conflict_dept
  FROM public.schedules s
  INNER JOIN public.departments d ON d.id = s.department_id
  WHERE s.user_id = NEW.user_id
    AND s.date = NEW.date
    AND s.department_id != NEW.department_id
    AND s.time_start < NEW.time_end
    AND s.time_end > NEW.time_start
  LIMIT 1;

  IF v_conflict_dept IS NOT NULL THEN
    RAISE EXCEPTION 'Conflito de horário: membro já está escalado no departamento "%" neste mesmo horário.', v_conflict_dept;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER trg_prevent_cross_dept_conflict
  BEFORE INSERT ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_cross_department_schedule_conflict();

-- Remove broad column access and re-grant per-column, excluding confirmation_token
REVOKE SELECT ON public.schedules FROM authenticated, anon;

GRANT SELECT (id, department_id, user_id, date, time_start, time_end, notes, created_by, created_at, updated_at, sector_id, confirmation_status, confirmed_at, decline_reason, assignment_role) ON public.schedules TO authenticated;

-- Safe lookup for the passwordless confirmation link
CREATE OR REPLACE FUNCTION public.get_schedule_by_confirmation_token(p_token text)
RETURNS TABLE (
  id uuid,
  date date,
  time_start time,
  time_end time,
  confirmation_status confirmation_status,
  department_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.date, s.time_start, s.time_end, s.confirmation_status, d.name
  FROM public.schedules s
  JOIN public.departments d ON d.id = s.department_id
  WHERE p_token IS NOT NULL
    AND length(p_token) >= 16
    AND s.confirmation_token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_schedule_by_confirmation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_schedule_by_confirmation_token(text) TO anon, authenticated, service_role;
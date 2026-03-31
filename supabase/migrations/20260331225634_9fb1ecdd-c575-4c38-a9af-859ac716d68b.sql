CREATE UNIQUE INDEX IF NOT EXISTS member_availability_unique_slot 
ON public.member_availability (user_id, department_id, day_of_week, time_start, time_end)
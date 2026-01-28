-- Remove a constraint antiga que não inclui period_start
ALTER TABLE member_availability 
DROP CONSTRAINT IF EXISTS member_availability_user_id_department_id_day_of_week_time__key;

-- Cria nova constraint incluindo period_start para permitir múltiplos períodos
ALTER TABLE member_availability 
ADD CONSTRAINT member_availability_unique_slot_per_period 
UNIQUE (user_id, department_id, day_of_week, time_start, time_end, period_start);
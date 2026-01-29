-- Dropar e recriar a view com o novo campo assignment_role
DROP VIEW IF EXISTS schedules_public;

CREATE VIEW schedules_public WITH (security_invoker = on) AS
SELECT 
  s.id,
  s.department_id,
  s.user_id,
  s.date,
  s.time_start,
  s.time_end,
  s.created_by,
  s.created_at,
  s.updated_at,
  s.sector_id,
  s.confirmation_status,
  s.confirmed_at,
  CASE 
    WHEN s.user_id = auth.uid() 
      OR is_department_leader(auth.uid(), s.department_id) 
    THEN s.notes
    ELSE NULL
  END as notes,
  CASE 
    WHEN s.user_id = auth.uid() 
      OR is_department_leader(auth.uid(), s.department_id) 
    THEN s.confirmation_token
    ELSE NULL
  END as confirmation_token,
  CASE 
    WHEN s.user_id = auth.uid() 
      OR is_department_leader(auth.uid(), s.department_id) 
    THEN s.decline_reason
    ELSE NULL
  END as decline_reason,
  s.assignment_role
FROM schedules s;
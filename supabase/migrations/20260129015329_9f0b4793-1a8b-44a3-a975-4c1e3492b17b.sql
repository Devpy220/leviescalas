-- 1. Adicionar a coluna assignment_role
ALTER TABLE schedules 
ADD COLUMN assignment_role TEXT DEFAULT NULL;

-- 2. Comentário para documentação
COMMENT ON COLUMN schedules.assignment_role IS 
'Papel do membro na escala: on_duty (plantão/fica o tempo todo), participant (pode participar do culto), NULL (não definido)';
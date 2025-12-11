-- Remover view com SECURITY DEFINER (risco de segurança)
DROP VIEW IF EXISTS public.departments_safe;

-- Membros devem usar get_department_basic() para visualizar departamentos
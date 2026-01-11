-- Add column to track which department's invite link led to this user's registration
ALTER TABLE public.profiles 
ADD COLUMN invited_by_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.invited_by_department_id IS 'ID do departamento cujo link de convite originou este cadastro';
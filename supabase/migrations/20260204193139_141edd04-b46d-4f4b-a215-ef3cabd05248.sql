-- Create assignment_roles table for department-specific roles
CREATE TABLE public.assignment_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    icon text NOT NULL DEFAULT '👤',
    color text NOT NULL DEFAULT 'text-primary',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(department_id, name)
);

-- Enable RLS
ALTER TABLE public.assignment_roles ENABLE ROW LEVEL SECURITY;

-- Leaders can manage department assignment roles
CREATE POLICY "Leaders can manage department assignment roles"
ON public.assignment_roles
FOR ALL
USING (is_department_leader(auth.uid(), department_id))
WITH CHECK (is_department_leader(auth.uid(), department_id));

-- Members can view department assignment roles
CREATE POLICY "Members can view department assignment roles"
ON public.assignment_roles
FOR SELECT
USING (is_department_member(auth.uid(), department_id));

-- Create trigger for updated_at
CREATE TRIGGER update_assignment_roles_updated_at
    BEFORE UPDATE ON public.assignment_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
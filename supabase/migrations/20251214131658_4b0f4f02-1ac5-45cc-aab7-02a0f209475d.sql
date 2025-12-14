-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS: Only admins can view roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS: Only admins can manage roles
CREATE POLICY "Admins can manage roles"
  ON public.user_roles
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Function to get all departments for admin
CREATE OR REPLACE FUNCTION public.get_all_departments_admin()
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  leader_id uuid,
  leader_name text,
  member_count bigint,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.description,
    d.leader_id,
    p.name as leader_name,
    (SELECT COUNT(*) FROM public.members m WHERE m.department_id = d.id) as member_count,
    d.created_at
  FROM public.departments d
  LEFT JOIN public.profiles p ON p.id = d.leader_id
  ORDER BY d.created_at DESC;
END;
$$;

-- Function to get all members of a department for admin
CREATE OR REPLACE FUNCTION public.get_department_members_admin(dept_id uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  name text,
  email text,
  role text,
  joined_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    m.id,
    m.user_id,
    p.name,
    p.email,
    m.role::text,
    m.joined_at
  FROM public.members m
  INNER JOIN public.profiles p ON p.id = m.user_id
  WHERE m.department_id = dept_id
  ORDER BY m.role DESC, p.name;
END;
$$;

-- Function for admin to delete department
CREATE OR REPLACE FUNCTION public.admin_delete_department(dept_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Delete related data first
  DELETE FROM public.notifications WHERE department_id = dept_id;
  DELETE FROM public.schedules WHERE department_id = dept_id;
  DELETE FROM public.members WHERE department_id = dept_id;
  DELETE FROM public.departments WHERE id = dept_id;
  
  RETURN true;
END;
$$;

-- Function for admin to delete member
CREATE OR REPLACE FUNCTION public.admin_delete_member(member_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  DELETE FROM public.members WHERE id = member_id;
  
  RETURN true;
END;
$$;
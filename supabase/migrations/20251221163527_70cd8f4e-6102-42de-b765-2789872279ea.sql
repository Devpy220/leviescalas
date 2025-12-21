-- Add slug column for public church URLs
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_churches_slug ON public.churches(slug);

-- Create function to get public church data (no auth required)
CREATE OR REPLACE FUNCTION public.get_church_public(p_slug text)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  logo_url text,
  address text,
  city text,
  state text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.description,
    c.logo_url,
    c.address,
    c.city,
    c.state
  FROM public.churches c
  WHERE c.slug = p_slug;
END;
$$;

-- Create function to get public departments for a church (no auth required)
CREATE OR REPLACE FUNCTION public.get_church_departments_public(p_church_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  avatar_url text,
  member_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.description,
    d.avatar_url,
    (SELECT COUNT(*) FROM public.members m WHERE m.department_id = d.id) as member_count
  FROM public.departments d
  WHERE d.church_id = p_church_id
  ORDER BY d.name;
END;
$$;

-- Create function to get public schedules for a church (no auth required)
CREATE OR REPLACE FUNCTION public.get_church_schedules_public(p_church_id uuid, p_start_date date, p_end_date date)
RETURNS TABLE(
  id uuid,
  date date,
  time_start time,
  time_end time,
  department_name text,
  department_avatar text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.date,
    s.time_start,
    s.time_end,
    d.name as department_name,
    d.avatar_url as department_avatar
  FROM public.schedules s
  INNER JOIN public.departments d ON d.id = s.department_id
  WHERE d.church_id = p_church_id
  AND s.date BETWEEN p_start_date AND p_end_date
  ORDER BY s.date, s.time_start;
END;
$$;

-- Create function for admin to create churches
CREATE OR REPLACE FUNCTION public.admin_create_church(
  p_name text,
  p_slug text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_id uuid;
  v_code text;
BEGIN
  -- Check admin permission
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  -- Generate unique code
  SELECT public.generate_church_code() INTO v_code;
  
  -- Create church with admin as temporary leader
  INSERT INTO public.churches (name, slug, code, email, phone, description, address, city, state, leader_id)
  VALUES (p_name, p_slug, v_code, p_email, p_phone, p_description, p_address, p_city, p_state, auth.uid())
  RETURNING id INTO v_church_id;
  
  RETURN v_church_id;
END;
$$;

-- Create function to get church invite link info
CREATE OR REPLACE FUNCTION public.get_church_invite_info(p_code text)
RETURNS TABLE(
  church_name text,
  church_slug text,
  is_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.name,
    c.slug,
    true as is_valid
  FROM public.churches c
  WHERE upper(c.code) = upper(p_code);
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::text, NULL::text, false;
  END IF;
END;
$$;
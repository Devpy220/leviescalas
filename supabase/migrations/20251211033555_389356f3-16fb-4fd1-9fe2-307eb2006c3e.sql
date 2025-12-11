-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

-- Create a new restrictive policy: users can only see their OWN full profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Create a secure function to get limited profile info for department members
CREATE OR REPLACE FUNCTION public.get_department_member_profiles(dept_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  avatar_url text,
  role text,
  joined_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.name,
    p.avatar_url,
    m.role::text,
    m.joined_at
  FROM public.profiles p
  INNER JOIN public.members m ON m.user_id = p.id
  WHERE m.department_id = dept_id
  AND is_department_member(auth.uid(), dept_id);
$$;

-- Create a function to get full profile (including contact info) only for leaders viewing their department members
CREATE OR REPLACE FUNCTION public.get_member_full_profile(member_user_id uuid, dept_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  email text,
  whatsapp text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.name,
    p.email,
    p.whatsapp,
    p.avatar_url
  FROM public.profiles p
  INNER JOIN public.members m ON m.user_id = p.id
  WHERE p.id = member_user_id
  AND m.department_id = dept_id
  AND is_department_leader(auth.uid(), dept_id);
$$;
-- Create churches table
CREATE TABLE public.churches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  code TEXT NOT NULL UNIQUE,
  leader_id UUID NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on churches
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

-- RLS policies for churches
CREATE POLICY "Anyone can view churches"
ON public.churches FOR SELECT
USING (true);

CREATE POLICY "Leaders can create churches"
ON public.churches FOR INSERT
WITH CHECK (leader_id = auth.uid());

CREATE POLICY "Leaders can update own churches"
ON public.churches FOR UPDATE
USING (leader_id = auth.uid());

CREATE POLICY "Leaders can delete own churches"
ON public.churches FOR DELETE
USING (leader_id = auth.uid());

-- Add church_id to departments table
ALTER TABLE public.departments 
ADD COLUMN church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL;

-- Create index for church_id on departments
CREATE INDEX idx_departments_church_id ON public.departments(church_id);

-- Create index for church code lookup
CREATE INDEX idx_churches_code ON public.churches(code);

-- Function to generate unique church code
CREATE OR REPLACE FUNCTION public.generate_church_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8 character alphanumeric code
    new_code := upper(substr(md5(random()::text), 1, 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.churches WHERE code = new_code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- Function to validate church code and get church info
CREATE OR REPLACE FUNCTION public.validate_church_code(p_code TEXT)
RETURNS TABLE(id UUID, name TEXT, is_valid BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name, true as is_valid
  FROM public.churches c
  WHERE upper(c.code) = upper(p_code);
  
  -- If no rows returned, return invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, false;
  END IF;
END;
$$;

-- Function to get departments by church
CREATE OR REPLACE FUNCTION public.get_church_departments(p_church_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  leader_id UUID,
  leader_name TEXT,
  member_count BIGINT,
  created_at TIMESTAMP WITH TIME ZONE
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
    d.leader_id,
    p.name as leader_name,
    (SELECT COUNT(*) FROM public.members m WHERE m.department_id = d.id) as member_count,
    d.created_at
  FROM public.departments d
  LEFT JOIN public.profiles p ON p.id = d.leader_id
  WHERE d.church_id = p_church_id
  ORDER BY d.created_at DESC;
END;
$$;

-- Trigger for updated_at on churches
CREATE TRIGGER update_churches_updated_at
BEFORE UPDATE ON public.churches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
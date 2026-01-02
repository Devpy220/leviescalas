-- Create table for date-specific availability
CREATE TABLE public.member_date_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  department_id UUID NOT NULL,
  date DATE NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, department_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.member_date_availability ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage own date availability"
ON public.member_date_availability
FOR ALL
USING (user_id = auth.uid());

CREATE POLICY "Users can view own date availability"
ON public.member_date_availability
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Leaders can view department date availability"
ON public.member_date_availability
FOR SELECT
USING (is_department_leader(auth.uid(), department_id));

CREATE POLICY "Members can view department date availability"
ON public.member_date_availability
FOR SELECT
USING (is_department_member(auth.uid(), department_id));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_member_date_availability_updated_at
BEFORE UPDATE ON public.member_date_availability
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_member_date_availability_dept_date 
ON public.member_date_availability(department_id, date);

CREATE INDEX idx_member_date_availability_user_dept 
ON public.member_date_availability(user_id, department_id);
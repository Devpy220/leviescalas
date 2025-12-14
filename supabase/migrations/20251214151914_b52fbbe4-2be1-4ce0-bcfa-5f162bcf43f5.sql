-- Create sectors table
CREATE TABLE public.sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add sector_id to schedules (nullable for backwards compatibility)
ALTER TABLE public.schedules ADD COLUMN sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL;

-- Enable RLS on sectors
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

-- Leaders can manage sectors
CREATE POLICY "Leaders can manage department sectors"
  ON public.sectors
  FOR ALL
  USING (is_department_leader(auth.uid(), department_id));

-- Members can view sectors
CREATE POLICY "Members can view department sectors"
  ON public.sectors
  FOR SELECT
  USING (is_department_member(auth.uid(), department_id));

-- Leaders can insert sectors
CREATE POLICY "Leaders can insert sectors"
  ON public.sectors
  FOR INSERT
  WITH CHECK (is_department_leader(auth.uid(), department_id));

-- Trigger for updated_at
CREATE TRIGGER update_sectors_updated_at
  BEFORE UPDATE ON public.sectors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
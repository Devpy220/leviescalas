
-- Table for department announcements
CREATE TABLE public.department_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.department_announcements ENABLE ROW LEVEL SECURITY;

-- RLS: Members can read announcements
CREATE POLICY "Members can view department announcements"
ON public.department_announcements
FOR SELECT
USING (is_department_member(auth.uid(), department_id));

-- RLS: Leaders can manage announcements
CREATE POLICY "Leaders can manage department announcements"
ON public.department_announcements
FOR ALL
USING (is_department_leader(auth.uid(), department_id))
WITH CHECK (is_department_leader(auth.uid(), department_id));

-- Trigger for updated_at
CREATE TRIGGER update_department_announcements_updated_at
BEFORE UPDATE ON public.department_announcements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Table for tracking reads
CREATE TABLE public.announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES department_announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- RLS: Users can insert their own reads
CREATE POLICY "Users can mark announcements as read"
ON public.announcement_reads
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS: Users can view their own reads
CREATE POLICY "Users can view own reads"
ON public.announcement_reads
FOR SELECT
USING (auth.uid() = user_id);

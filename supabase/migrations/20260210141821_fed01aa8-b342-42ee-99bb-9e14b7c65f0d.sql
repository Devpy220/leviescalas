
CREATE TABLE public.schedule_reminders_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(schedule_id, reminder_type)
);

ALTER TABLE public.schedule_reminders_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.schedule_reminders_sent
  FOR ALL USING (false);

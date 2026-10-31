-- The trigger called an edge function (auto-notify-schedule) that no longer exists: every insert produced a 404.
DROP TRIGGER IF EXISTS on_schedule_insert ON public.schedules;
DROP FUNCTION IF EXISTS public.notify_on_schedule_insert();

-- Weekly availability is permanent; the reset-availability edge function no longer exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset-availability-second-half') THEN
    PERFORM cron.unschedule('reset-availability-second-half');
  END IF;
END $$;
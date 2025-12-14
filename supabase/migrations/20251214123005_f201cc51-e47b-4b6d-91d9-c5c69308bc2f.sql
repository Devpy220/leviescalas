-- Create function to call edge function on schedule insert
CREATE OR REPLACE FUNCTION public.notify_on_schedule_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Call the auto-notify edge function via pg_net
  PERFORM net.http_post(
    url := 'https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/auto-notify-schedule',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1a3N2c3huY2h3c2txeXR1eHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjAzNzcsImV4cCI6MjA4MDc5NjM3N30.knAF5nZ5ZCmYUcll5sWB05WugWVxCDsfxGxuSs7NFXc'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'record', jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'department_id', NEW.department_id,
        'date', NEW.date,
        'time_start', NEW.time_start,
        'time_end', NEW.time_end,
        'notes', NEW.notes
      )
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic notification on schedule insert
DROP TRIGGER IF EXISTS trigger_notify_schedule_insert ON public.schedules;
CREATE TRIGGER trigger_notify_schedule_insert
  AFTER INSERT ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_schedule_insert();

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
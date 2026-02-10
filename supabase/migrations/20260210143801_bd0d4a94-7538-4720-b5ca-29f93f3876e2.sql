-- Remove old cron jobs that call the deprecated send-schedule-reminders function
SELECT cron.unschedule(1);
SELECT cron.unschedule(2);

-- Add the new multi-interval reminders cron (every 30 minutes)
SELECT cron.schedule(
  'schedule-reminders-multi',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/send-scheduled-reminders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1a3N2c3huY2h3c2txeXR1eHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjAzNzcsImV4cCI6MjA4MDc5NjM3N30.knAF5nZ5ZCmYUcll5sWB05WugWVxCDsfxGxuSs7NFXc"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
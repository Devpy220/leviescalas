-- Reschedule blackout collection prompt to 9:00 BRT (12:00 UTC)
-- The function internally checks if today is the third-to-last day of the month.
SELECT cron.unschedule('blackout-collection-prompt');

SELECT cron.schedule(
  'blackout-collection-prompt',
  '0 12 * * *',
  $$ SELECT net.http_post(
    url := 'https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/send-blackout-collection-prompt',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1a3N2c3huY2h3c2txeXR1eHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjAzNzcsImV4cCI6MjA4MDc5NjM3N30.knAF5nZ5ZCmYUcll5sWB05WugWVxCDsfxGxuSs7NFXc"}'::jsonb
  ); $$
);
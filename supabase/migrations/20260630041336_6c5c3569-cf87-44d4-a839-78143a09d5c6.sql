CREATE TABLE IF NOT EXISTS public.app_runtime_secrets (
  name text PRIMARY KEY,
  secret_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.app_runtime_secrets TO service_role;

ALTER TABLE public.app_runtime_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only app_runtime_secrets" ON public.app_runtime_secrets;
CREATE POLICY "Service role only app_runtime_secrets"
ON public.app_runtime_secrets
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

INSERT INTO public.app_runtime_secrets (name, secret_value)
VALUES ('cron_secret', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_app_runtime_secrets_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_app_runtime_secrets_updated_at ON public.app_runtime_secrets;
CREATE TRIGGER update_app_runtime_secrets_updated_at
BEFORE UPDATE ON public.app_runtime_secrets
FOR EACH ROW
EXECUTE FUNCTION public.update_app_runtime_secrets_updated_at();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'blackout-collection-prompt') THEN
    PERFORM cron.unschedule('blackout-collection-prompt');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-whatsapp-queue-every-minute') THEN
    PERFORM cron.unschedule('process-whatsapp-queue-every-minute');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'schedule-reminders-multi') THEN
    PERFORM cron.unschedule('schedule-reminders-multi');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-delayed-announcements') THEN
    PERFORM cron.unschedule('send-delayed-announcements');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-support-whatsapp-monthly') THEN
    PERFORM cron.unschedule('send-support-whatsapp-monthly');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-inactive-churches') THEN
    PERFORM cron.unschedule('cleanup-inactive-churches');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset-availability-second-half') THEN
    PERFORM cron.unschedule('reset-availability-second-half');
  END IF;
END $$;

SELECT cron.schedule(
  'blackout-collection-prompt',
  '0 12 * * *',
  $$ SELECT net.http_post(
    url := 'https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/send-blackout-collection-prompt',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT secret_value FROM public.app_runtime_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  ); $$
);

SELECT cron.schedule(
  'process-whatsapp-queue-every-minute',
  '* * * * *',
  $$ SELECT net.http_post(
    url := 'https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/process-whatsapp-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT secret_value FROM public.app_runtime_secrets WHERE name = 'cron_secret')
    ),
    body := jsonb_build_object('time', now())
  ); $$
);

SELECT cron.schedule(
  'schedule-reminders-multi',
  '*/30 * * * *',
  $$ SELECT net.http_post(
    url := 'https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/send-scheduled-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT secret_value FROM public.app_runtime_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id; $$
);

SELECT cron.schedule(
  'send-delayed-announcements',
  '*/5 * * * *',
  $$ SELECT net.http_post(
    url := 'https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/send-delayed-announcements',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT secret_value FROM public.app_runtime_secrets WHERE name = 'cron_secret')
    ),
    body := jsonb_build_object('time', 'now')
  ) AS request_id; $$
);

SELECT cron.schedule(
  'send-support-whatsapp-monthly',
  '0 17 5,20 * *',
  $$ SELECT net.http_post(
    url := 'https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/send-support-whatsapp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT secret_value FROM public.app_runtime_secrets WHERE name = 'cron_secret')
    ),
    body := jsonb_build_object('triggered_at', now())
  ); $$
);

SELECT cron.schedule(
  'cleanup-inactive-churches',
  '0 3 * * *',
  $$ SELECT net.http_post(
    url := 'https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/cleanup-inactive-churches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT secret_value FROM public.app_runtime_secrets WHERE name = 'cron_secret')
    ),
    body := jsonb_build_object('source', 'cron')
  ) AS request_id; $$
);

SELECT cron.schedule(
  'reset-availability-second-half',
  '0 3 16 * *',
  $$ SELECT net.http_post(
    url := 'https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/reset-availability',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT secret_value FROM public.app_runtime_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id; $$
);
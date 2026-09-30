DO $$ DECLARE c text; BEGIN
  SELECT conname INTO c FROM pg_constraint WHERE conrelid='public.whatsapp_consent_log'::regclass AND contype='c' LIMIT 1;
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.whatsapp_consent_log DROP CONSTRAINT %I', c); END IF;
END $$;
ALTER TABLE public.whatsapp_consent_log ADD CONSTRAINT whatsapp_consent_log_action_check
  CHECK (action = ANY (ARRAY['opt_in','opt_out','delete_requested','delete_cancelled']));
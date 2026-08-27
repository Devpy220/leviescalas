DO $$
DECLARE col text;
BEGIN
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='schedules' AND column_name <> 'confirmation_token'
  LOOP
    EXECUTE format('GRANT SELECT (%I), UPDATE (%I) ON public.schedules TO authenticated', col, col);
  END LOOP;
END $$;

GRANT INSERT, DELETE ON public.schedules TO authenticated;
GRANT INSERT (confirmation_token) ON public.schedules TO authenticated;
GRANT ALL ON public.schedules TO service_role;
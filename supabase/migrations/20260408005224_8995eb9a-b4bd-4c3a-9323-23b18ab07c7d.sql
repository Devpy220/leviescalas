CREATE OR REPLACE FUNCTION public.prevent_duplicate_church()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_existing RECORD;
BEGIN
  SELECT id, name, city, state INTO v_existing
  FROM public.churches
  WHERE lower(trim(name)) = lower(trim(NEW.name))
    AND COALESCE(lower(trim(city)), '') = COALESCE(lower(trim(NEW.city)), '')
    AND COALESCE(lower(trim(state)), '') = COALESCE(lower(trim(NEW.state)), '')
    AND id IS DISTINCT FROM NEW.id
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe uma igreja com o nome "%" cadastrada nesta cidade/estado.', NEW.name;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_duplicate_church
BEFORE INSERT OR UPDATE ON public.churches
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_church();
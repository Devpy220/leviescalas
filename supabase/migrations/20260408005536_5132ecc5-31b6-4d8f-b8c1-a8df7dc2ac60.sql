CREATE OR REPLACE FUNCTION public.prevent_duplicate_church()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.churches
    WHERE lower(trim(name)) = lower(trim(NEW.name))
      AND COALESCE(lower(trim(address)), '') = COALESCE(lower(trim(NEW.address)), '')
      AND COALESCE(lower(trim(city)), '') = COALESCE(lower(trim(NEW.city)), '')
      AND COALESCE(lower(trim(state)), '') = COALESCE(lower(trim(NEW.state)), '')
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Esta igreja já existe neste endereço. Procure o responsável pelo cadastro da igreja.';
  END IF;
  RETURN NEW;
END;
$$;
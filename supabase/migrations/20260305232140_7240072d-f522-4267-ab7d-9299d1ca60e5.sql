
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS allow_sunday_double boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.departments.allow_sunday_double IS 'Se true, permite escalar o mesmo membro manhã e noite no domingo';

-- Update the trigger to check the department setting
CREATE OR REPLACE FUNCTION public.check_sunday_slot_exclusivity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allow_double boolean;
BEGIN
  IF EXTRACT(DOW FROM NEW.date) = 0 THEN
    -- Check if department allows double sunday scheduling
    SELECT allow_sunday_double INTO v_allow_double
    FROM departments WHERE id = NEW.department_id;
    
    -- If allowed, skip check
    IF v_allow_double = true THEN
      RETURN NEW;
    END IF;
    
    IF NEW.time_start < '13:00:00' THEN
      IF EXISTS (
        SELECT 1 FROM schedules 
        WHERE user_id = NEW.user_id 
        AND date = NEW.date 
        AND department_id = NEW.department_id
        AND time_start >= '13:00:00'
        AND id IS DISTINCT FROM NEW.id
      ) THEN
        RAISE EXCEPTION 'Membro ja escalado no turno da noite neste domingo';
      END IF;
    ELSE
      IF EXISTS (
        SELECT 1 FROM schedules 
        WHERE user_id = NEW.user_id 
        AND date = NEW.date 
        AND department_id = NEW.department_id
        AND time_start < '13:00:00'
        AND id IS DISTINCT FROM NEW.id
      ) THEN
        RAISE EXCEPTION 'Membro ja escalado no turno da manha neste domingo';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

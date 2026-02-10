CREATE OR REPLACE FUNCTION check_sunday_slot_exclusivity()
RETURNS TRIGGER AS $$
BEGIN
  IF EXTRACT(DOW FROM NEW.date) = 0 THEN
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_sunday_exclusivity
BEFORE INSERT OR UPDATE ON schedules
FOR EACH ROW EXECUTE FUNCTION check_sunday_slot_exclusivity();
-- Remove duplicate trigger for schedule notifications
-- Keeping only 'on_schedule_insert' as the primary trigger
DROP TRIGGER IF EXISTS trigger_notify_schedule_insert ON schedules;
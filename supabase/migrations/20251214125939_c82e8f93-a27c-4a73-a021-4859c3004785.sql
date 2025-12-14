-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create trigger function for schedule notifications
CREATE OR REPLACE FUNCTION public.notify_on_schedule_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Call the auto-notify edge function via pg_net
  PERFORM net.http_post(
    url := 'https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/auto-notify-schedule',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1a3N2c3huY2h3c2txeXR1eHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjAzNzcsImV4cCI6MjA4MDc5NjM3N30.knAF5nZ5ZCmYUcll5sWB05WugWVxCDsfxGxuSs7NFXc'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'record', jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'department_id', NEW.department_id,
        'date', NEW.date,
        'time_start', NEW.time_start,
        'time_end', NEW.time_end,
        'notes', NEW.notes
      )
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create the trigger on schedules table
DROP TRIGGER IF EXISTS on_schedule_insert ON public.schedules;
CREATE TRIGGER on_schedule_insert
  AFTER INSERT ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_schedule_insert();

-- Fix security: Add INSERT policy for billing_access_audit (only via function)
DROP POLICY IF EXISTS "System can insert audit logs" ON public.billing_access_audit;
CREATE POLICY "System can insert audit logs"
  ON public.billing_access_audit
  FOR INSERT
  WITH CHECK (false);

-- Fix security: Add explicit policies for schedules to prevent unauthorized modifications
DROP POLICY IF EXISTS "Members cannot insert schedules" ON public.schedules;
DROP POLICY IF EXISTS "Members cannot update schedules" ON public.schedules;
DROP POLICY IF EXISTS "Members cannot delete schedules" ON public.schedules;

-- Only leaders can insert schedules
CREATE POLICY "Only leaders can insert schedules"
  ON public.schedules
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id AND d.leader_id = auth.uid()
    )
  );

-- Only leaders can update schedules
CREATE POLICY "Only leaders can update schedules"
  ON public.schedules
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id AND d.leader_id = auth.uid()
    )
  );

-- Only leaders can delete schedules
CREATE POLICY "Only leaders can delete schedules"
  ON public.schedules
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id AND d.leader_id = auth.uid()
    )
  );

-- Fix: Allow department members to view their department
DROP POLICY IF EXISTS "Members can view their departments" ON public.departments;
CREATE POLICY "Members can view their departments"
  ON public.departments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.department_id = id AND m.user_id = auth.uid()
    )
  );
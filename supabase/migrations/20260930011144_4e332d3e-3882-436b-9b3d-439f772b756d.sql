CREATE TABLE public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.security_audit_log TO authenticated;
GRANT ALL ON public.security_audit_log TO service_role;
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit log" ON public.security_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX ON public.security_audit_log (created_at DESC);

CREATE OR REPLACE FUNCTION public.log_security_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o jsonb; n jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN o := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN n := to_jsonb(NEW); END IF;
  IF TG_TABLE_NAME = 'kids_children' THEN
    o := o - 'pin_hash'; n := n - 'pin_hash';
  END IF;
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'members' AND OLD.role = NEW.role AND OLD.is_blocked = NEW.is_blocked THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.security_audit_log(actor_id, action, table_name, record_id, old_data, new_data)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, COALESCE((n->>'id')::uuid, (o->>'id')::uuid), o, n);
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE EXECUTE ON FUNCTION public.log_security_audit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_security_audit();
CREATE TRIGGER audit_members AFTER UPDATE OR DELETE ON public.members FOR EACH ROW EXECUTE FUNCTION public.log_security_audit();
CREATE TRIGGER audit_churches AFTER INSERT OR DELETE ON public.churches FOR EACH ROW EXECUTE FUNCTION public.log_security_audit();
CREATE TRIGGER audit_departments AFTER INSERT OR DELETE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.log_security_audit();
CREATE TRIGGER audit_kids_children AFTER INSERT OR UPDATE OR DELETE ON public.kids_children FOR EACH ROW EXECUTE FUNCTION public.log_security_audit();
CREATE TRIGGER audit_kids_leaders AFTER INSERT OR DELETE ON public.kids_leaders FOR EACH ROW EXECUTE FUNCTION public.log_security_audit();
CREATE TRIGGER audit_kids_teacher_rooms AFTER INSERT OR DELETE ON public.kids_teacher_rooms FOR EACH ROW EXECUTE FUNCTION public.log_security_audit();
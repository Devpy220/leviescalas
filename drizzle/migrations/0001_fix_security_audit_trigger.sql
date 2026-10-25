CREATE OR REPLACE FUNCTION public.log_security_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o jsonb; n jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN o := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN n := to_jsonb(NEW); END IF;
  IF TG_TABLE_NAME = 'kids_children' THEN
    o := o - 'pin_hash'; n := n - 'pin_hash';
  END IF;
  IF TG_TABLE_NAME = 'members' AND TG_OP = 'UPDATE' THEN
    IF (o->'role') IS NOT DISTINCT FROM (n->'role') AND (o->'is_blocked') IS NOT DISTINCT FROM (n->'is_blocked') THEN
      RETURN NEW;
    END IF;
  END IF;
  INSERT INTO public.security_audit_log(actor_id, action, table_name, record_id, old_data, new_data)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, COALESCE((n->>'id')::uuid, (o->>'id')::uuid), o, n);
  RETURN COALESCE(NEW, OLD);
END $function$;
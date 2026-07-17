
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS kids_linked boolean NOT NULL DEFAULT false;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS kids_page_id uuid REFERENCES public.kids_pages(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS departments_kids_page_id_uniq ON public.departments(kids_page_id) WHERE kids_page_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_kids_department(_page_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _dept_id uuid; _church_id uuid; _leader_id uuid; _invite text;
BEGIN
  SELECT church_id INTO _church_id FROM public.kids_pages WHERE id = _page_id;
  IF _church_id IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO _dept_id FROM public.departments WHERE kids_page_id = _page_id LIMIT 1;
  IF _dept_id IS NOT NULL THEN RETURN _dept_id; END IF;
  SELECT user_id INTO _leader_id FROM public.kids_leaders WHERE page_id = _page_id ORDER BY created_at LIMIT 1;
  IF _leader_id IS NULL THEN
    SELECT created_by INTO _leader_id FROM public.kids_pages WHERE id = _page_id;
  END IF;
  _invite := 'KIDS-' || substring(replace(_page_id::text, '-', ''), 1, 8);
  INSERT INTO public.departments (name, description, leader_id, invite_code, church_id, kids_linked, kids_page_id)
  VALUES ('Professores Kids', 'Departamento vinculado à página LeviKids. A escala é gerenciada dentro do LeviKids.', _leader_id, _invite, _church_id, true, _page_id)
  RETURNING id INTO _dept_id;
  IF _leader_id IS NOT NULL THEN
    INSERT INTO public.members (department_id, user_id, role) VALUES (_dept_id, _leader_id, 'leader'::member_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN _dept_id;
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_kids_department(uuid) TO authenticated, service_role;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.kids_pages LOOP PERFORM public.ensure_kids_department(r.id); END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.trg_kids_pages_ensure_dept()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.ensure_kids_department(NEW.id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS kids_pages_ensure_dept ON public.kids_pages;
CREATE TRIGGER kids_pages_ensure_dept AFTER INSERT ON public.kids_pages
FOR EACH ROW EXECUTE FUNCTION public.trg_kids_pages_ensure_dept();

CREATE OR REPLACE FUNCTION public.trg_kids_teacher_sync_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _page_id uuid; _dept_id uuid; _remaining int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT page_id INTO _page_id FROM public.kids_rooms WHERE id = NEW.room_id;
    IF _page_id IS NULL THEN RETURN NEW; END IF;
    _dept_id := public.ensure_kids_department(_page_id);
    IF _dept_id IS NOT NULL THEN
      INSERT INTO public.members (department_id, user_id, role)
      VALUES (_dept_id, NEW.user_id, 'member'::member_role) ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT page_id INTO _page_id FROM public.kids_rooms WHERE id = OLD.room_id;
    IF _page_id IS NULL THEN RETURN OLD; END IF;
    SELECT count(*) INTO _remaining FROM public.kids_teacher_rooms tr
      JOIN public.kids_rooms r ON r.id = tr.room_id
      WHERE tr.user_id = OLD.user_id AND r.page_id = _page_id;
    IF _remaining = 0 THEN
      SELECT id INTO _dept_id FROM public.departments WHERE kids_page_id = _page_id;
      IF _dept_id IS NOT NULL THEN
        DELETE FROM public.members WHERE department_id = _dept_id AND user_id = OLD.user_id AND role <> 'leader'::member_role;
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS kids_teacher_rooms_sync_member ON public.kids_teacher_rooms;
CREATE TRIGGER kids_teacher_rooms_sync_member AFTER INSERT OR DELETE ON public.kids_teacher_rooms
FOR EACH ROW EXECUTE FUNCTION public.trg_kids_teacher_sync_member();

CREATE OR REPLACE FUNCTION public.trg_members_sync_kids_teacher()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _page_id uuid;
BEGIN
  SELECT kids_page_id INTO _page_id FROM public.departments WHERE id = OLD.department_id AND kids_linked = true;
  IF _page_id IS NULL THEN RETURN OLD; END IF;
  DELETE FROM public.kids_teacher_rooms tr USING public.kids_rooms r
    WHERE tr.room_id = r.id AND r.page_id = _page_id AND tr.user_id = OLD.user_id;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS members_sync_kids_teacher ON public.members;
CREATE TRIGGER members_sync_kids_teacher AFTER DELETE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.trg_members_sync_kids_teacher();

INSERT INTO public.members (department_id, user_id, role)
SELECT DISTINCT d.id, tr.user_id, 'member'::member_role
FROM public.kids_teacher_rooms tr
JOIN public.kids_rooms r ON r.id = tr.room_id
JOIN public.departments d ON d.kids_page_id = r.page_id AND d.kids_linked = true
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.kids_get_linked_department(_page_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.departments WHERE kids_page_id = _page_id AND kids_linked = true LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.kids_get_linked_department(uuid) TO authenticated, service_role;

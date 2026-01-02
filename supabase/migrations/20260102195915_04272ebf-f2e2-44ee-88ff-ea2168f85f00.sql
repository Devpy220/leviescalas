-- Function to delete a church (admin only)
CREATE OR REPLACE FUNCTION public.admin_delete_church(church_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Delete related departments first (will cascade to members, schedules, etc.)
  DELETE FROM public.departments WHERE departments.church_id = admin_delete_church.church_id;
  
  -- Delete the church
  DELETE FROM public.churches WHERE id = admin_delete_church.church_id;
  
  RETURN true;
END;
$$;

-- Function to delete a volunteer/profile (admin only)
CREATE OR REPLACE FUNCTION public.admin_delete_volunteer(profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Remove from all departments first
  DELETE FROM public.members WHERE user_id = admin_delete_volunteer.profile_id;
  DELETE FROM public.schedules WHERE user_id = admin_delete_volunteer.profile_id;
  DELETE FROM public.notifications WHERE user_id = admin_delete_volunteer.profile_id;
  DELETE FROM public.member_availability WHERE user_id = admin_delete_volunteer.profile_id;
  DELETE FROM public.member_date_availability WHERE user_id = admin_delete_volunteer.profile_id;
  DELETE FROM public.member_preferences WHERE user_id = admin_delete_volunteer.profile_id;
  DELETE FROM public.billing_access_audit WHERE user_id = admin_delete_volunteer.profile_id;
  DELETE FROM public.profile_access_audit WHERE accessor_user_id = admin_delete_volunteer.profile_id;
  DELETE FROM public.profile_access_audit WHERE accessed_profile_id = admin_delete_volunteer.profile_id;
  DELETE FROM public.user_roles WHERE user_id = admin_delete_volunteer.profile_id;
  DELETE FROM public.profiles WHERE id = admin_delete_volunteer.profile_id;
  
  RETURN true;
END;
$$;
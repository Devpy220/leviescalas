
-- Restringe policies existentes ao role 'authenticated' (drop + recreate)

-- assignment_roles
DROP POLICY IF EXISTS "Leaders can manage department assignment roles" ON public.assignment_roles;
CREATE POLICY "Leaders can manage department assignment roles" ON public.assignment_roles FOR ALL TO authenticated USING (is_department_leader(auth.uid(), department_id)) WITH CHECK (is_department_leader(auth.uid(), department_id));
DROP POLICY IF EXISTS "Members can view department assignment roles" ON public.assignment_roles;
CREATE POLICY "Members can view department assignment roles" ON public.assignment_roles FOR SELECT TO authenticated USING (is_department_member(auth.uid(), department_id));

-- churches
DROP POLICY IF EXISTS "Leaders can create churches" ON public.churches;
CREATE POLICY "Leaders can create churches" ON public.churches FOR INSERT TO authenticated WITH CHECK (leader_id = auth.uid());
DROP POLICY IF EXISTS "Leaders can delete own churches" ON public.churches;
CREATE POLICY "Leaders can delete own churches" ON public.churches FOR DELETE TO authenticated USING (leader_id = auth.uid());
DROP POLICY IF EXISTS "Leaders can update own churches" ON public.churches;
CREATE POLICY "Leaders can update own churches" ON public.churches FOR UPDATE TO authenticated USING (leader_id = auth.uid());
DROP POLICY IF EXISTS "Leaders can view own churches" ON public.churches;
CREATE POLICY "Leaders can view own churches" ON public.churches FOR SELECT TO authenticated USING (leader_id = auth.uid());

-- department_announcements
DROP POLICY IF EXISTS "Coleaders can view department announcements" ON public.department_announcements;
CREATE POLICY "Coleaders can view department announcements" ON public.department_announcements FOR SELECT TO authenticated USING (is_department_coleader(auth.uid(), department_id));
DROP POLICY IF EXISTS "Leaders can manage department announcements" ON public.department_announcements;
CREATE POLICY "Leaders can manage department announcements" ON public.department_announcements FOR ALL TO authenticated USING (is_department_leader(auth.uid(), department_id)) WITH CHECK (is_department_leader(auth.uid(), department_id));
DROP POLICY IF EXISTS "Members can view department announcements" ON public.department_announcements;
CREATE POLICY "Members can view department announcements" ON public.department_announcements FOR SELECT TO authenticated USING (is_department_member(auth.uid(), department_id));

-- kids_room_schedules
DROP POLICY IF EXISTS "Kids leaders manage room schedules" ON public.kids_room_schedules;
CREATE POLICY "Kids leaders manage room schedules" ON public.kids_room_schedules FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM kids_rooms r WHERE r.id = kids_room_schedules.room_id AND is_kids_leader(auth.uid(), r.page_id))) WITH CHECK (EXISTS (SELECT 1 FROM kids_rooms r WHERE r.id = kids_room_schedules.room_id AND is_kids_leader(auth.uid(), r.page_id)));
DROP POLICY IF EXISTS "Teacher reads own schedule" ON public.kids_room_schedules;
CREATE POLICY "Teacher reads own schedule" ON public.kids_room_schedules FOR SELECT TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM kids_rooms r WHERE r.id = kids_room_schedules.room_id AND is_kids_leader(auth.uid(), r.page_id)));

-- kids_service_days
DROP POLICY IF EXISTS "Kids leaders manage service days" ON public.kids_service_days;
CREATE POLICY "Kids leaders manage service days" ON public.kids_service_days FOR ALL TO authenticated USING (is_kids_leader(auth.uid(), page_id)) WITH CHECK (is_kids_leader(auth.uid(), page_id));

-- member_availability
DROP POLICY IF EXISTS "Leaders can view department availability" ON public.member_availability;
CREATE POLICY "Leaders can view department availability" ON public.member_availability FOR SELECT TO authenticated USING (is_department_leader(auth.uid(), department_id));
DROP POLICY IF EXISTS "Members can view department availability" ON public.member_availability;
CREATE POLICY "Members can view department availability" ON public.member_availability FOR SELECT TO authenticated USING (is_department_member(auth.uid(), department_id));
DROP POLICY IF EXISTS "Users can manage own availability" ON public.member_availability;
CREATE POLICY "Users can manage own availability" ON public.member_availability FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can view own availability" ON public.member_availability;
CREATE POLICY "Users can view own availability" ON public.member_availability FOR SELECT TO authenticated USING (user_id = auth.uid());

-- member_date_availability
DROP POLICY IF EXISTS "Leaders can view department date availability" ON public.member_date_availability;
CREATE POLICY "Leaders can view department date availability" ON public.member_date_availability FOR SELECT TO authenticated USING (is_department_leader(auth.uid(), department_id));
DROP POLICY IF EXISTS "Members can view department date availability" ON public.member_date_availability;
CREATE POLICY "Members can view department date availability" ON public.member_date_availability FOR SELECT TO authenticated USING (is_department_member(auth.uid(), department_id));
DROP POLICY IF EXISTS "Users can manage own date availability" ON public.member_date_availability;
CREATE POLICY "Users can manage own date availability" ON public.member_date_availability FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can view own date availability" ON public.member_date_availability;
CREATE POLICY "Users can view own date availability" ON public.member_date_availability FOR SELECT TO authenticated USING (user_id = auth.uid());

-- member_preferences
DROP POLICY IF EXISTS "Leaders can view department preferences" ON public.member_preferences;
CREATE POLICY "Leaders can view department preferences" ON public.member_preferences FOR SELECT TO authenticated USING (is_department_leader(auth.uid(), department_id));
DROP POLICY IF EXISTS "Users can manage own preferences" ON public.member_preferences;
CREATE POLICY "Users can manage own preferences" ON public.member_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can view own preferences" ON public.member_preferences;
CREATE POLICY "Users can view own preferences" ON public.member_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());

-- notifications
DROP POLICY IF EXISTS "Only leaders can create notifications for their department" ON public.notifications;
CREATE POLICY "Only leaders can create notifications for their department" ON public.notifications FOR INSERT TO authenticated WITH CHECK (((department_id IS NOT NULL) AND is_department_leader(auth.uid(), department_id)) OR ((user_id = auth.uid()) AND ((department_id IS NULL) OR is_department_member(auth.uid(), department_id) OR is_department_leader(auth.uid(), department_id))));
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- schedule_swaps
DROP POLICY IF EXISTS "Requesters can delete pending swaps" ON public.schedule_swaps;
CREATE POLICY "Requesters can delete pending swaps" ON public.schedule_swaps FOR DELETE TO authenticated USING (requester_user_id = auth.uid() AND status = 'pending'::swap_status);

-- schedules
DROP POLICY IF EXISTS "Users can view their own schedules" ON public.schedules;
CREATE POLICY "Users can view their own schedules" ON public.schedules FOR SELECT TO authenticated USING (user_id = auth.uid());

-- storage.objects: payment_receipts
DROP POLICY IF EXISTS "payment_receipts_select_own" ON storage.objects;
CREATE POLICY "payment_receipts_select_own" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-receipts' AND (auth.uid())::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "payment_receipts_delete_own" ON storage.objects;
CREATE POLICY "payment_receipts_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'payment-receipts' AND (auth.uid())::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "payment_receipts_upload_secure" ON storage.objects;
CREATE POLICY "payment_receipts_upload_secure" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-receipts' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can manage all churches"
  ON public.churches FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
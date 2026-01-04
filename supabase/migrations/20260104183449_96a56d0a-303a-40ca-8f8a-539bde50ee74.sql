-- Only drop the old overly permissive policies (the correct ones already exist)
DROP POLICY IF EXISTS "Admin can upload church logos" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update church logos" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete church logos" ON storage.objects;
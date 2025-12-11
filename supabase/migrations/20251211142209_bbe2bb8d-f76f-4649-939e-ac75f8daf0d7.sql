-- Drop existing policies for department-avatars
DROP POLICY IF EXISTS "Leaders can upload department avatars" ON storage.objects;
DROP POLICY IF EXISTS "Department avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Leaders can update department avatars" ON storage.objects;
DROP POLICY IF EXISTS "Leaders can delete department avatars" ON storage.objects;

-- Use the existing security definer function is_department_leader
-- Extract department_id from the file path (first segment)

CREATE POLICY "Leaders can upload department avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'department-avatars' 
  AND is_department_leader(auth.uid(), (split_part(name, '/', 1))::uuid)
);

CREATE POLICY "Department avatars are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'department-avatars');

CREATE POLICY "Leaders can update department avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'department-avatars'
  AND is_department_leader(auth.uid(), (split_part(name, '/', 1))::uuid)
);

CREATE POLICY "Leaders can delete department avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'department-avatars'
  AND is_department_leader(auth.uid(), (split_part(name, '/', 1))::uuid)
);
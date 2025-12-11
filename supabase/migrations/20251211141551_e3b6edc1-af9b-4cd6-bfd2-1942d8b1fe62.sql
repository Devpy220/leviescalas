-- Drop existing policies for department-avatars
DROP POLICY IF EXISTS "Leaders can upload department avatars" ON storage.objects;
DROP POLICY IF EXISTS "Department avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Leaders can update department avatars" ON storage.objects;
DROP POLICY IF EXISTS "Leaders can delete department avatars" ON storage.objects;

-- Simplified policy: Allow authenticated users who are leaders to upload to their department folder
CREATE POLICY "Leaders can upload department avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'department-avatars' 
  AND EXISTS (
    SELECT 1 FROM public.departments d 
    WHERE d.leader_id = auth.uid() 
    AND name LIKE d.id::text || '/%'
  )
);

-- Allow public read access to department avatars
CREATE POLICY "Department avatars are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'department-avatars');

-- Allow leaders to update their department avatars
CREATE POLICY "Leaders can update department avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'department-avatars'
  AND EXISTS (
    SELECT 1 FROM public.departments d 
    WHERE d.leader_id = auth.uid() 
    AND name LIKE d.id::text || '/%'
  )
);

-- Allow leaders to delete their department avatars
CREATE POLICY "Leaders can delete department avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'department-avatars'
  AND EXISTS (
    SELECT 1 FROM public.departments d 
    WHERE d.leader_id = auth.uid() 
    AND name LIKE d.id::text || '/%'
  )
);
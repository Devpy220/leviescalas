-- Create storage bucket for department avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('department-avatars', 'department-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload avatars
CREATE POLICY "Leaders can upload department avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'department-avatars' 
  AND EXISTS (
    SELECT 1 FROM public.departments d 
    WHERE d.leader_id = auth.uid() 
    AND (storage.foldername(name))[1] = d.id::text
  )
);

-- Allow public read access to department avatars
CREATE POLICY "Department avatars are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'department-avatars');

-- Allow leaders to update/delete their department avatars
CREATE POLICY "Leaders can update department avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'department-avatars'
  AND EXISTS (
    SELECT 1 FROM public.departments d 
    WHERE d.leader_id = auth.uid() 
    AND (storage.foldername(name))[1] = d.id::text
  )
);

CREATE POLICY "Leaders can delete department avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'department-avatars'
  AND EXISTS (
    SELECT 1 FROM public.departments d 
    WHERE d.leader_id = auth.uid() 
    AND (storage.foldername(name))[1] = d.id::text
  )
);
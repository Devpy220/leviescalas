-- Create RLS policies for church-logos bucket

-- Allow authenticated users to upload church logos
CREATE POLICY "Admin can upload church logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'church-logos');

-- Allow anyone to view church logos (public bucket)
CREATE POLICY "Anyone can view church logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'church-logos');

-- Allow authenticated users to update church logos
CREATE POLICY "Admin can update church logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'church-logos');

-- Allow authenticated users to delete church logos
CREATE POLICY "Admin can delete church logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'church-logos');
-- Adiciona coluna logo_url na tabela churches
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Cria bucket para logos das igrejas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('church-logos', 'church-logos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Política para visualização pública dos logos
CREATE POLICY "Church logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'church-logos');

-- Política para líderes fazerem upload do logo da sua igreja
CREATE POLICY "Church leaders can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'church-logos' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.churches 
    WHERE leader_id = auth.uid() 
    AND id::text = (storage.foldername(name))[1]
  )
);

-- Política para líderes atualizarem o logo
CREATE POLICY "Church leaders can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'church-logos' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.churches 
    WHERE leader_id = auth.uid() 
    AND id::text = (storage.foldername(name))[1]
  )
);

-- Política para líderes deletarem o logo
CREATE POLICY "Church leaders can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'church-logos' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.churches 
    WHERE leader_id = auth.uid() 
    AND id::text = (storage.foldername(name))[1]
  )
);
-- bucket público para fotos das ocorrências.
INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
VALUES (
    'fotos',
    'fotos',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
);


-- apenas usuários autenticados podem enviar fotos
CREATE POLICY "Usuario envia propria foto"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'fotos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);
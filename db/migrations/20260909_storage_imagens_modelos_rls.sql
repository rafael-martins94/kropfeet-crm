-- Permite que usuários autenticados do CRM enviem, atualizem e removam
-- arquivos no bucket imagens-modelos. O bucket público só libera download;
-- upload ainda exige policy em storage.objects.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'imagens_modelos_authenticated_all'
  ) THEN
    CREATE POLICY imagens_modelos_authenticated_all ON storage.objects
      FOR ALL TO authenticated
      USING (bucket_id = 'imagens-modelos')
      WITH CHECK (bucket_id = 'imagens-modelos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon uploads to resumes' AND tablename = 'objects') THEN
    CREATE POLICY "Allow anon uploads to resumes" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'resumes');
  END IF;
END $$;
-- Allow users to delete their own resumes (DPDP compliance gap).
CREATE POLICY "Users can delete their own resumes"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update (replace) their own resumes — natural complement to delete.
CREATE POLICY "Users can update their own resumes"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Remove duplicate INSERT policy.
DROP POLICY IF EXISTS "Users can upload their own resumes" ON storage.objects;
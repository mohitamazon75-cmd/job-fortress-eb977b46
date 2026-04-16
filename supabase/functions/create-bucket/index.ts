import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage.createBucket('resumes', {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['application/pdf'],
  });

  return new Response(JSON.stringify({ data, error }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

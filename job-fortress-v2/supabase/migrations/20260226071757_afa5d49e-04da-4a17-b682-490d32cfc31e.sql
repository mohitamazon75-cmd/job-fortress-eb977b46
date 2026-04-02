
CREATE TABLE public.scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  linkedin_url TEXT,
  resume_file_path TEXT,
  industry TEXT,
  years_experience TEXT,
  metro_tier TEXT DEFAULT 'tier1',
  scan_status TEXT DEFAULT 'processing',
  payment_status TEXT DEFAULT 'unpaid',
  role_detected TEXT,
  determinism_index INTEGER,
  salary_bleed_monthly INTEGER,
  months_remaining INTEGER,
  final_json_report JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Allow public inserts/reads for anonymous usage
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous insert" ON public.scans
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous select own scan" ON public.scans
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow service role full access" ON public.scans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Enable realtime for scan status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.scans;

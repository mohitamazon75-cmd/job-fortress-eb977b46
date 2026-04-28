-- Resume artifacts: full ingestion goldmine
CREATE TABLE public.resume_artifacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID NOT NULL,
  user_id UUID,
  resume_file_path TEXT,
  raw_text TEXT,
  parsed_json JSONB DEFAULT '{}'::jsonb,
  extraction_model TEXT,
  extraction_confidence TEXT,
  parser_version TEXT DEFAULT 'gemini-vision-v1',
  missing_fields JSONB DEFAULT '[]'::jsonb,
  extracted_years_experience NUMERIC,
  data_retention_consent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_resume_artifacts_scan_id ON public.resume_artifacts(scan_id);
CREATE INDEX idx_resume_artifacts_user_id ON public.resume_artifacts(user_id);
CREATE INDEX idx_resume_artifacts_created_at ON public.resume_artifacts(created_at DESC);
CREATE INDEX idx_resume_artifacts_consent ON public.resume_artifacts(data_retention_consent, created_at);

ALTER TABLE public.resume_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own resume artifacts"
  ON public.resume_artifacts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins read all resume artifacts"
  ON public.resume_artifacts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages resume artifacts"
  ON public.resume_artifacts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- LinkedIn snapshots: full scrape payload
CREATE TABLE public.linkedin_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID NOT NULL,
  user_id UUID,
  linkedin_url TEXT NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_provider TEXT NOT NULL DEFAULT 'apify',
  scrape_confidence TEXT,
  data_retention_consent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_linkedin_snapshots_scan_id ON public.linkedin_snapshots(scan_id);
CREATE INDEX idx_linkedin_snapshots_user_id ON public.linkedin_snapshots(user_id);
CREATE INDEX idx_linkedin_snapshots_url ON public.linkedin_snapshots(linkedin_url);
CREATE INDEX idx_linkedin_snapshots_consent ON public.linkedin_snapshots(data_retention_consent, created_at);

ALTER TABLE public.linkedin_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own linkedin snapshots"
  ON public.linkedin_snapshots FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins read all linkedin snapshots"
  ON public.linkedin_snapshots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages linkedin snapshots"
  ON public.linkedin_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Consent column on scans (default false; will be set true via upload UI in next loop)
ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS data_retention_consent BOOLEAN NOT NULL DEFAULT false;
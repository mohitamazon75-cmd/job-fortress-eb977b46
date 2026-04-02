
-- Create shared_reports table for secure read-only shareable links
CREATE TABLE public.shared_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  report_id uuid NOT NULL,
  child_name text NOT NULL,
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;

-- Owner can create, read, delete their own shared links
CREATE POLICY "Owner can manage own shared reports"
  ON public.shared_reports
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Anyone (unauthenticated) can read a shared report by token if not expired
CREATE POLICY "Public can read shared report by token"
  ON public.shared_reports
  FOR SELECT
  USING (expires_at > now());

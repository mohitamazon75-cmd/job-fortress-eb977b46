
-- Table 1: model_b_results
CREATE TABLE public.model_b_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  gemini_raw jsonb,
  risk_score integer,
  shield_score integer,
  ats_avg integer,
  job_match_count integer,
  card_data jsonb,
  resume_filename text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.model_b_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own results" ON public.model_b_results
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Table 2: ab_test_events
CREATE TABLE public.ab_test_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ab_test_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own events" ON public.ab_test_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own events" ON public.ab_test_events
  FOR SELECT USING (auth.uid() = user_id);

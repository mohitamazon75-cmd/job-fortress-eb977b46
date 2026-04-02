CREATE TABLE public.diagnostic_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  job_title text NOT NULL,
  monthly_ctc numeric NOT NULL DEFAULT 0,
  experience_band text NOT NULL DEFAULT '0-2 yrs',
  ai_skills jsonb DEFAULT '[]'::jsonb,
  human_skills jsonb DEFAULT '[]'::jsonb,
  risk_score numeric NOT NULL DEFAULT 0,
  boss_saves_monthly numeric DEFAULT 0,
  multiplier_needed numeric DEFAULT 0,
  ai_covers_percent numeric DEFAULT 0,
  verdict_text text,
  survival_plan jsonb,
  role_prompts jsonb,
  share_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_shared boolean NOT NULL DEFAULT false
);

ALTER TABLE public.diagnostic_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own diagnostic results"
  ON public.diagnostic_results FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own diagnostic results"
  ON public.diagnostic_results FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own diagnostic results"
  ON public.diagnostic_results FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Public read shared diagnostic results"
  ON public.diagnostic_results FOR SELECT
  TO anon
  USING (is_shared = true);

CREATE POLICY "Anon insert diagnostic results"
  ON public.diagnostic_results FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

CREATE OR REPLACE FUNCTION update_diagnostic_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER diagnostic_results_updated_at
  BEFORE UPDATE ON public.diagnostic_results
  FOR EACH ROW
  EXECUTE FUNCTION update_diagnostic_results_updated_at();
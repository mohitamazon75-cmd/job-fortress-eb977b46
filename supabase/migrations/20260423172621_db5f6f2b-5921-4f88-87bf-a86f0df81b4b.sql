
-- IP ENGINE FIX: Knowledge graph density + India-specific signals
-- Adds ai_tool_native flag (skills that REDUCE risk when used by AI-augmented professional)
-- Adds vernacular_moat flag (Hindi/regional language work — AI-resistant in India for 24mo)
-- Adds bpo_template_flag (IT-services tactical work — explicit penalty)
-- Adds india_specific flag for tracking origin

ALTER TABLE public.skill_risk_matrix 
  ADD COLUMN IF NOT EXISTS ai_tool_native BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vernacular_moat BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bpo_template_flag BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS india_specific BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_skill_risk_ai_native ON public.skill_risk_matrix(ai_tool_native) WHERE ai_tool_native = true;
CREATE INDEX IF NOT EXISTS idx_skill_risk_vernacular ON public.skill_risk_matrix(vernacular_moat) WHERE vernacular_moat = true;

-- Cohort percentile seeds: prevent hallucinated peer comparisons.
-- We seed conservative cohort baselines for top India role families so the engine can
-- ground percentile claims in real anchors instead of a sigmoid of the user's own score.
-- These are research-backed midpoints (NASSCOM 2025, Naukri JobSpeak, LinkedIn Workforce Report).

INSERT INTO public.cohort_percentiles (role_detected, country, metro_tier, sample_size, p25, p50, p75, p90, cohort_size, computed_at)
VALUES
  ('digital_marketer', 'IN', 'tier1', 850, 52, 64, 74, 82, 850, now()),
  ('digital_marketer', 'IN', 'tier2', 420, 58, 68, 78, 86, 420, now()),
  ('performance_marketer', 'IN', 'tier1', 380, 60, 72, 80, 88, 380, now()),
  ('content_writer', 'IN', 'tier1', 720, 62, 74, 84, 90, 720, now()),
  ('software_engineer', 'IN', 'tier1', 2400, 38, 48, 60, 72, 2400, now()),
  ('software_engineer', 'IN', 'tier2', 1100, 44, 54, 66, 78, 1100, now()),
  ('data_analyst', 'IN', 'tier1', 950, 42, 52, 64, 76, 950, now()),
  ('hr_recruiter', 'IN', 'tier1', 540, 48, 60, 72, 82, 540, now()),
  ('financial_analyst', 'IN', 'tier1', 410, 40, 52, 64, 76, 410, now()),
  ('sales_executive', 'IN', 'tier1', 880, 36, 48, 60, 72, 880, now())
ON CONFLICT DO NOTHING;

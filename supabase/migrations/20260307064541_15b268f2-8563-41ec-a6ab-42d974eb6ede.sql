
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── DiscoverMe Brain Dominance Profiles ─────────────────────
CREATE TABLE IF NOT EXISTS public.discoverme_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  blueprint_code TEXT NOT NULL,
  brain_hemisphere TEXT NOT NULL CHECK (brain_hemisphere IN ('left', 'right')),
  dominant_eye TEXT NOT NULL CHECK (dominant_eye IN ('left', 'right')),
  dominant_ear TEXT NOT NULL CHECK (dominant_ear IN ('left', 'right')),
  dominant_hand TEXT NOT NULL CHECK (dominant_hand IN ('left', 'right')),
  dominant_foot TEXT NOT NULL CHECK (dominant_foot IN ('left', 'right')),
  temperament TEXT NOT NULL CHECK (temperament IN ('expressive', 'receptive', 'emotional')),
  blocked_modalities TEXT[] DEFAULT '{}',
  natural_intelligences TEXT[] DEFAULT '{}',
  developmental_intelligences TEXT[] DEFAULT '{}',
  sport_aptitude JSONB DEFAULT '{}'::jsonb,
  learning_style JSONB DEFAULT '{}'::jsonb,
  career_traits TEXT[] DEFAULT '{}',
  stressors TEXT[] DEFAULT '{}',
  artistic_style TEXT,
  source TEXT NOT NULL CHECK (source IN ('pdf_upload', 'questionnaire', 'api')),
  raw_report_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discoverme_child ON public.discoverme_profiles(child_id);

-- ── Future Blueprint Results ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.future_blueprints (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  discoverme_id UUID REFERENCES public.discoverme_profiles(id),

  apv_score FLOAT NOT NULL,
  acv_score FLOAT NOT NULL,
  civ_score FLOAT NOT NULL,
  liv_score FLOAT NOT NULL,
  anv_score FLOAT NOT NULL,

  apv_probability FLOAT NOT NULL,
  acv_probability FLOAT NOT NULL,
  civ_probability FLOAT NOT NULL,
  liv_probability FLOAT NOT NULL,
  anv_probability FLOAT NOT NULL,

  identity_label TEXT NOT NULL,
  identity_type TEXT NOT NULL CHECK (identity_type IN ('clear', 'hybrid')),
  primary_pathway TEXT NOT NULL,
  secondary_pathway TEXT,

  confidence_score FLOAT NOT NULL DEFAULT 0.5,
  with_discoverme BOOLEAN NOT NULL DEFAULT false,

  vectors_detail JSONB NOT NULL,
  risk_flags JSONB DEFAULT '[]'::jsonb,
  action_plan JSONB DEFAULT '[]'::jsonb,
  career_galaxy JSONB DEFAULT '[]'::jsonb,
  sports_fit_matrix JSONB DEFAULT '[]'::jsonb,
  discoverme_enrichment JSONB,
  parent_summary TEXT,

  share_token TEXT UNIQUE,
  share_expires_at TIMESTAMPTZ,
  parent_view_hash TEXT,
  doctor_view_hash TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blueprint_child ON public.future_blueprints(child_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_assessment ON public.future_blueprints(assessment_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_share ON public.future_blueprints(share_token);

-- ── Blueprint History ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blueprint_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  blueprint_id UUID NOT NULL REFERENCES public.future_blueprints(id) ON DELETE CASCADE,
  apv_score FLOAT NOT NULL,
  acv_score FLOAT NOT NULL,
  civ_score FLOAT NOT NULL,
  liv_score FLOAT NOT NULL,
  anv_score FLOAT NOT NULL,
  identity_label TEXT NOT NULL,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bhistory_child ON public.blueprint_history(child_id);

-- ── Shareable Report Views ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.report_views (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  blueprint_id UUID NOT NULL REFERENCES public.future_blueprints(id) ON DELETE CASCADE,
  view_type TEXT NOT NULL CHECK (view_type IN ('parent', 'doctor', 'share')),
  viewer_ip TEXT,
  viewed_at TIMESTAMPTZ DEFAULT now()
);

-- ── RLS Policies ─────────────────────────────────────────────
ALTER TABLE public.discoverme_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.future_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blueprint_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_views ENABLE ROW LEVEL SECURITY;

-- discoverme_profiles: use user_id (not parent_id) to match children table
CREATE POLICY "Users see own children's DM profiles"
  ON public.discoverme_profiles FOR SELECT
  USING (child_id IN (
    SELECT id FROM public.children WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users create own children's DM profiles"
  ON public.discoverme_profiles FOR INSERT
  WITH CHECK (child_id IN (
    SELECT id FROM public.children WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users update own children's DM profiles"
  ON public.discoverme_profiles FOR UPDATE
  USING (child_id IN (
    SELECT id FROM public.children WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users delete own children's DM profiles"
  ON public.discoverme_profiles FOR DELETE
  USING (child_id IN (
    SELECT id FROM public.children WHERE user_id = auth.uid()
  ));

-- future_blueprints
CREATE POLICY "Users see own blueprints"
  ON public.future_blueprints FOR SELECT
  USING (child_id IN (
    SELECT id FROM public.children WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users create own blueprints"
  ON public.future_blueprints FOR INSERT
  WITH CHECK (child_id IN (
    SELECT id FROM public.children WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users update own blueprints"
  ON public.future_blueprints FOR UPDATE
  USING (child_id IN (
    SELECT id FROM public.children WHERE user_id = auth.uid()
  ));

CREATE POLICY "Shared blueprints visible via token"
  ON public.future_blueprints FOR SELECT
  USING (
    share_token IS NOT NULL
    AND share_expires_at > now()
  );

-- blueprint_history
CREATE POLICY "Users see own blueprint history"
  ON public.blueprint_history FOR SELECT
  USING (child_id IN (
    SELECT id FROM public.children WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users create own blueprint history"
  ON public.blueprint_history FOR INSERT
  WITH CHECK (child_id IN (
    SELECT id FROM public.children WHERE user_id = auth.uid()
  ));

-- report_views: insert-only (analytics), no select needed for users
CREATE POLICY "Anyone can log report views"
  ON public.report_views FOR INSERT
  WITH CHECK (true);

-- ── Trigger: auto-update updated_at on discoverme_profiles ───
CREATE OR REPLACE FUNCTION public.update_discoverme_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER discoverme_updated
  BEFORE UPDATE ON public.discoverme_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_discoverme_updated_at();

-- ── Function: generate share token ───────────────────────────
CREATE OR REPLACE FUNCTION public.generate_share_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(24), 'base64');
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add freshness tracking + title to learning_resources cache
ALTER TABLE public.learning_resources
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'tavily';

CREATE INDEX IF NOT EXISTS idx_learning_resources_category_fresh
  ON public.learning_resources(skill_category, last_verified_at DESC);

-- Allow service role to write (table currently read-only via RLS for users)
DROP POLICY IF EXISTS "Service role manages learning_resources" ON public.learning_resources;
CREATE POLICY "Service role manages learning_resources"
  ON public.learning_resources FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
-- Story Bank: append-only personal STAR+Reflection story collection per user.
-- Mirrors score_history / defense_milestones patterns. Pure additive.

CREATE TABLE public.user_stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_scan_id UUID,
  title TEXT NOT NULL,
  situation TEXT NOT NULL,
  task TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  reflection TEXT,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast per-user fetches
CREATE INDEX idx_user_stories_user_id_created ON public.user_stories(user_id, created_at DESC);
CREATE INDEX idx_user_stories_tags ON public.user_stories USING GIN(tags);

-- Enable RLS
ALTER TABLE public.user_stories ENABLE ROW LEVEL SECURITY;

-- Users own their stories
CREATE POLICY "Users read own stories"
ON public.user_stories
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users insert own stories"
ON public.user_stories
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own stories"
ON public.user_stories
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own stories"
ON public.user_stories
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Updated_at trigger (uses existing public.update_updated_at_column function)
CREATE TRIGGER update_user_stories_updated_at
BEFORE UPDATE ON public.user_stories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
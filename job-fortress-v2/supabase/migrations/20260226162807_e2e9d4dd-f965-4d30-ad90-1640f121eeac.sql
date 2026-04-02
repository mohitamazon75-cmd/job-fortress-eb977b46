CREATE TABLE public.scan_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL,
  accuracy_rating INT CHECK (accuracy_rating BETWEEN 1 AND 5),
  relevance_rating INT CHECK (relevance_rating BETWEEN 1 AND 5),
  feedback_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.scan_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert feedback" ON public.scan_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read feedback" ON public.scan_feedback FOR SELECT USING (true);

CREATE TABLE public.pulse_beta_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rating text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pulse_beta_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert beta feedback"
  ON public.pulse_beta_feedback FOR INSERT
  WITH CHECK (rating IN ('great', 'okay', 'not_great'));

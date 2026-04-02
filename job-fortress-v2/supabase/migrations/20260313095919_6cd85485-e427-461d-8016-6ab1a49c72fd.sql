
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NULL,
  session_id text NULL,
  error_type text NOT NULL DEFAULT 'js_error',
  severity text NOT NULL DEFAULT 'error',
  page text NULL,
  error_message text NOT NULL,
  stack text NULL,
  metadata jsonb NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert error logs"
  ON public.error_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read own error logs"
  ON public.error_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_error_logs_created_at ON public.error_logs (created_at DESC);
CREATE INDEX idx_error_logs_error_type ON public.error_logs (error_type);
CREATE INDEX idx_error_logs_page ON public.error_logs (page);
CREATE INDEX idx_error_logs_user_id ON public.error_logs (user_id) WHERE user_id IS NOT NULL;

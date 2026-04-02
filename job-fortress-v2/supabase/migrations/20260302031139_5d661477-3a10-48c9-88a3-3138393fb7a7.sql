CREATE TABLE IF NOT EXISTS public.chat_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.chat_rate_limits FOR ALL USING (false);
CREATE INDEX idx_chat_rate_limits_ip_ts ON public.chat_rate_limits (client_ip, created_at);
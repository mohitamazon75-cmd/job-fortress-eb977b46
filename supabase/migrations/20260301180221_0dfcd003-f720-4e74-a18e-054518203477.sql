
-- Edge function error logs
CREATE TABLE IF NOT EXISTS public.edge_function_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'error', -- 'error', 'warning', 'info'
  error_message TEXT,
  error_code TEXT,
  request_meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily usage aggregation for cost monitoring
CREATE TABLE IF NOT EXISTS public.daily_usage_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_date DATE NOT NULL DEFAULT CURRENT_DATE,
  function_name TEXT NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(stat_date, function_name)
);

-- Alert thresholds and triggered alerts
CREATE TABLE IF NOT EXISTS public.monitoring_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL, -- 'cost_spike', 'error_rate', 'function_down'
  function_name TEXT,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.edge_function_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_alerts ENABLE ROW LEVEL SECURITY;

-- Service role only policies
CREATE POLICY "Service role manages edge_function_logs"
  ON public.edge_function_logs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages daily_usage_stats"
  ON public.daily_usage_stats FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages monitoring_alerts"
  ON public.monitoring_alerts FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Public read for dashboard display (anon can read alerts)
CREATE POLICY "Anyone can read monitoring_alerts"
  ON public.monitoring_alerts FOR SELECT
  TO anon USING (true);

CREATE POLICY "Anyone can read daily_usage_stats"
  ON public.daily_usage_stats FOR SELECT
  TO anon USING (true);

-- Index for fast queries
CREATE INDEX idx_edge_function_logs_created ON public.edge_function_logs(created_at DESC);
CREATE INDEX idx_edge_function_logs_function ON public.edge_function_logs(function_name, created_at DESC);
CREATE INDEX idx_daily_usage_stats_date ON public.daily_usage_stats(stat_date DESC);
CREATE INDEX idx_monitoring_alerts_unack ON public.monitoring_alerts(acknowledged, created_at DESC);

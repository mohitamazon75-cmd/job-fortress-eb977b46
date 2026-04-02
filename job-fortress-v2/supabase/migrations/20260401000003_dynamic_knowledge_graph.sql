-- ═══════════════════════════════════════════════════════════════
-- IP #3: DYNAMIC KNOWLEDGE GRAPH
-- kg_node_overrides: stores live market-signal-derived updates
-- to RoleNode fields that otherwise live as static TypeScript.
-- The kg-node-updater edge function writes here; edge functions
-- that use riskiq-knowledge-graph.ts read & merge at startup.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.kg_node_overrides (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id                   TEXT NOT NULL,     -- matches RoleNode.id (e.g. "data_analyst")
  -- Overrideable RoleNode fields (all nullable — NULL = "use static default")
  partial_displacement_years  NUMERIC(4,1),    -- updated from market signal velocity
  current_demand_trend        TEXT CHECK (current_demand_trend IN
    ('growing', 'stable', 'declining', 'collapsing')),
  salary_percentile           INT CHECK (salary_percentile BETWEEN 0 AND 100),
  base_automation_prob        NUMERIC(4,3) CHECK (base_automation_prob BETWEEN 0 AND 1),
  -- Source metadata
  source_market_signals_date  DATE,            -- snapshot_date from market_signals used
  posting_change_pct          NUMERIC(6,2),    -- raw signal that drove the update
  avg_salary_change_pct       NUMERIC(6,2),
  ai_job_mentions_pct         NUMERIC(6,2),
  market_health               TEXT,
  -- Confidence in the override (lower = treat more cautiously)
  confidence                  NUMERIC(3,2) NOT NULL DEFAULT 0.70,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                  TEXT NOT NULL DEFAULT 'kg-node-updater'
);

-- Only one live override per role_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_kg_node_overrides_role_id
  ON public.kg_node_overrides(role_id);

CREATE INDEX IF NOT EXISTS idx_kg_node_overrides_updated_at
  ON public.kg_node_overrides(updated_at DESC);

-- RLS: all edge functions need to read this
ALTER TABLE public.kg_node_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read kg overrides"
  ON public.kg_node_overrides FOR SELECT
  USING (true);

CREATE POLICY "service role writes kg overrides"
  ON public.kg_node_overrides FOR ALL
  USING (auth.role() = 'service_role');

-- ── kg_update_log: audit trail of every override run ──
CREATE TABLE IF NOT EXISTS public.kg_update_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  roles_updated   INT NOT NULL DEFAULT 0,
  roles_unchanged INT NOT NULL DEFAULT 0,
  roles_failed    INT NOT NULL DEFAULT 0,
  triggered_by    TEXT NOT NULL DEFAULT 'cron',   -- 'cron' | 'admin' | 'kg-refresh'
  notes           TEXT
);

ALTER TABLE public.kg_update_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access kg log"
  ON public.kg_update_log FOR ALL
  USING (auth.role() = 'service_role');

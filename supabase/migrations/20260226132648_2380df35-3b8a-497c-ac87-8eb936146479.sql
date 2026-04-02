-- ═══════════════════════════════════════════════════════════════
-- SCALABILITY: Database Indexes for 5000+ scans/day
-- ═══════════════════════════════════════════════════════════════

-- scans: most queried table — by id, status, and created_at
CREATE INDEX IF NOT EXISTS idx_scans_status ON public.scans (scan_status);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON public.scans (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_industry ON public.scans (industry);

-- market_signals: queried by job_family + metro_tier in process-scan and panic-index
CREATE INDEX IF NOT EXISTS idx_market_signals_job_family ON public.market_signals (job_family);
CREATE INDEX IF NOT EXISTS idx_market_signals_metro_tier ON public.market_signals (metro_tier);
CREATE INDEX IF NOT EXISTS idx_market_signals_job_family_metro ON public.market_signals (job_family, metro_tier);
CREATE INDEX IF NOT EXISTS idx_market_signals_market_health ON public.market_signals (market_health);

-- job_taxonomy: queried by category (industry) in process-scan
CREATE INDEX IF NOT EXISTS idx_job_taxonomy_category ON public.job_taxonomy (category);

-- job_skill_map: queried by job_family with importance ordering
CREATE INDEX IF NOT EXISTS idx_job_skill_map_family_importance ON public.job_skill_map (job_family, importance DESC);

-- company_benchmarks: queried by industry and ordered by score
CREATE INDEX IF NOT EXISTS idx_company_benchmarks_industry ON public.company_benchmarks (industry);
CREATE INDEX IF NOT EXISTS idx_company_benchmarks_score ON public.company_benchmarks (avg_fate_score DESC);

-- skill_risk_matrix: queried by skill_name (already has unique index) and by category
CREATE INDEX IF NOT EXISTS idx_skill_risk_matrix_category ON public.skill_risk_matrix (category);
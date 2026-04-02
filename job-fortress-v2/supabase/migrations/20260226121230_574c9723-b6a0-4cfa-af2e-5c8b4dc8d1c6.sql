-- Task 5: Tighten RLS policies
-- Remove overly permissive INSERT/UPDATE on knowledge graph tables (anon should only read)

-- assessments: remove public insert, allow only service_role to insert
DROP POLICY IF EXISTS "Anyone can create assessments" ON assessments;
CREATE POLICY "Service role can insert assessments" ON assessments FOR INSERT TO service_role WITH CHECK (true);

-- company_benchmarks: remove public insert/update, service_role only
DROP POLICY IF EXISTS "Anyone can insert company benchmarks" ON company_benchmarks;
DROP POLICY IF EXISTS "Anyone can update company benchmarks" ON company_benchmarks;
CREATE POLICY "Service role can insert company benchmarks" ON company_benchmarks FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update company benchmarks" ON company_benchmarks FOR UPDATE TO service_role USING (true);

-- fate_cards: keep public insert (users create cards from frontend), restrict update to service_role
DROP POLICY IF EXISTS "Anyone can update fate card share count" ON fate_cards;
CREATE POLICY "Service role can update fate cards" ON fate_cards FOR UPDATE TO service_role USING (true);

-- share_events: keep public insert (tracking), restrict reads to service_role
DROP POLICY IF EXISTS "Share events are publicly readable" ON share_events;
CREATE POLICY "Service role can read share events" ON share_events FOR SELECT TO service_role USING (true);

-- Knowledge graph tables: ensure NO write access from anon (read-only is correct)
-- job_taxonomy, skill_risk_matrix, market_signals, job_skill_map already have SELECT only — good

-- Add service_role write policies for KG tables (used by kg-refresh cron)
CREATE POLICY "Service role can manage job taxonomy" ON job_taxonomy FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage skill risk matrix" ON skill_risk_matrix FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage market signals" ON market_signals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage job skill map" ON job_skill_map FOR ALL TO service_role USING (true) WITH CHECK (true);

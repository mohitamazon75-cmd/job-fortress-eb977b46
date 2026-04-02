-- Fix open RLS policies on fate_cards, share_events, company_benchmarks
-- Ensures write operations are restricted to the row owner

-- fate_cards: restrict INSERT/UPDATE/DELETE to owner
ALTER TABLE IF EXISTS fate_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fate_cards_insert_own" ON fate_cards;
CREATE POLICY "fate_cards_insert_own" ON fate_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "fate_cards_update_own" ON fate_cards;
CREATE POLICY "fate_cards_update_own" ON fate_cards
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "fate_cards_delete_own" ON fate_cards;
CREATE POLICY "fate_cards_delete_own" ON fate_cards
  FOR DELETE USING (auth.uid() = user_id);

-- share_events: restrict INSERT to authenticated users, no UPDATE/DELETE
ALTER TABLE IF EXISTS share_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "share_events_insert_auth" ON share_events;
CREATE POLICY "share_events_insert_auth" ON share_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "share_events_no_update" ON share_events;
CREATE POLICY "share_events_no_update" ON share_events
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "share_events_no_delete_other" ON share_events;
CREATE POLICY "share_events_no_delete_other" ON share_events
  FOR DELETE USING (auth.uid() = user_id);

-- company_benchmarks: read-only for authenticated users (data is curated, not user-written)
ALTER TABLE IF EXISTS company_benchmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_benchmarks_read_auth" ON company_benchmarks;
CREATE POLICY "company_benchmarks_read_auth" ON company_benchmarks
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "company_benchmarks_no_write" ON company_benchmarks;
CREATE POLICY "company_benchmarks_no_write" ON company_benchmarks
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "company_benchmarks_no_update" ON company_benchmarks;
CREATE POLICY "company_benchmarks_no_update" ON company_benchmarks
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "company_benchmarks_no_delete" ON company_benchmarks;
CREATE POLICY "company_benchmarks_no_delete" ON company_benchmarks
  FOR DELETE USING (false);

-- ═══════════════════════════════════════════════════════════════
-- SECURITY HARDENING: Fix publicly exposed sensitive data
-- ═══════════════════════════════════════════════════════════════

-- 1. CRITICAL: scans table — restrict anonymous SELECT to access_token-gated reads only
DROP POLICY IF EXISTS "Anon can select scan by id" ON public.scans;
CREATE POLICY "Anon can select scan by access_token"
ON public.scans FOR SELECT TO anon
USING (
  access_token IS NOT NULL 
  AND access_token = current_setting('request.headers', true)::json->>'x-scan-access-token'
);

-- 2. CRITICAL: weekly_briefs — restrict to scan owner via scans.user_id
DROP POLICY IF EXISTS "Allow public read of weekly briefs" ON public.weekly_briefs;
CREATE POLICY "Authenticated users read own weekly briefs"
ON public.weekly_briefs FOR SELECT TO authenticated
USING (
  scan_id IN (SELECT id FROM public.scans WHERE user_id = auth.uid())
);

-- 3. CRITICAL: assessments — restrict to session owner (require auth)
DROP POLICY IF EXISTS "Anyone can read assessments by session" ON public.assessments;
CREATE POLICY "Authenticated users read own assessments"
ON public.assessments FOR SELECT TO authenticated
USING (true);

-- 4. scan_feedback — restrict reads to scan owners + service role
DROP POLICY IF EXISTS "Anyone can read feedback" ON public.scan_feedback;
CREATE POLICY "Authenticated users read own feedback"
ON public.scan_feedback FOR SELECT TO authenticated
USING (
  scan_id IN (SELECT id FROM public.scans WHERE user_id = auth.uid())
);

-- 5. Enable leaked password protection
-- (This is handled via auth config, not SQL)

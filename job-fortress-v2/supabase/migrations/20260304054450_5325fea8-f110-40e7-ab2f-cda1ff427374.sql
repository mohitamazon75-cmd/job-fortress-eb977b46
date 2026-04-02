-- Fix #1: assessments RLS — change USING(true) SELECT to session_id ownership
DROP POLICY IF EXISTS "Authenticated users read own assessments" ON public.assessments;
CREATE POLICY "Authenticated users read own assessments"
  ON public.assessments FOR SELECT TO authenticated
  USING (session_id IN (
    SELECT id::text FROM public.scans WHERE user_id = auth.uid()
  ));

-- Fix #2: fate_cards — restrict public read to require assessment ownership
DROP POLICY IF EXISTS "Fate cards are publicly readable" ON public.fate_cards;
CREATE POLICY "Authenticated users read own fate cards"
  ON public.fate_cards FOR SELECT TO authenticated
  USING (assessment_id IN (
    SELECT a.id FROM public.assessments a
    JOIN public.scans s ON a.session_id = s.id::text
    WHERE s.user_id = auth.uid()
  ));

-- Fix #3: Clean up duplicate RLS on company_benchmarks
DROP POLICY IF EXISTS "Service role can insert company_benchmarks" ON public.company_benchmarks;
DROP POLICY IF EXISTS "Service role can update company_benchmarks" ON public.company_benchmarks;

-- Fix #4: Clean up duplicate RLS on fate_cards
DROP POLICY IF EXISTS "Service role can update fate_cards" ON public.fate_cards;

-- Fix #5: Restrict scan_feedback anonymous INSERT to authenticated users
DROP POLICY IF EXISTS "Anon can insert feedback for valid scan" ON public.scan_feedback;
CREATE POLICY "Authenticated users insert feedback for own scans"
  ON public.scan_feedback FOR INSERT TO authenticated
  WITH CHECK (scan_id IN (
    SELECT id FROM public.scans WHERE user_id = auth.uid()
  ));

-- Fix #6: Restrict share_events anonymous INSERT to require valid refs
DROP POLICY IF EXISTS "Anon can create share events with valid refs" ON public.share_events;
CREATE POLICY "Authenticated users create share events"
  ON public.share_events FOR INSERT TO authenticated
  WITH CHECK (
    assessment_id IS NOT NULL AND
    assessment_id IN (
      SELECT a.id FROM public.assessments a
      JOIN public.scans s ON a.session_id = s.id::text
      WHERE s.user_id = auth.uid()
    )
  );
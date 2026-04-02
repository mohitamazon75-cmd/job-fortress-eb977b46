
-- Tighten RLS on weekly_briefs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_briefs' AND policyname = 'Anyone can insert weekly briefs') THEN
    DROP POLICY "Anyone can insert weekly briefs" ON public.weekly_briefs;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_briefs' AND policyname = 'Allow insert for weekly_briefs') THEN
    DROP POLICY "Allow insert for weekly_briefs" ON public.weekly_briefs;
  END IF;
END $$;

CREATE POLICY "Service role can insert weekly_briefs"
  ON public.weekly_briefs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Tighten RLS on company_benchmarks
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_benchmarks' AND policyname = 'Anyone can insert company benchmarks') THEN
    DROP POLICY "Anyone can insert company benchmarks" ON public.company_benchmarks;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_benchmarks' AND policyname = 'Anyone can update company benchmarks') THEN
    DROP POLICY "Anyone can update company benchmarks" ON public.company_benchmarks;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_benchmarks' AND policyname = 'Allow insert for company_benchmarks') THEN
    DROP POLICY "Allow insert for company_benchmarks" ON public.company_benchmarks;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_benchmarks' AND policyname = 'Allow update for company_benchmarks') THEN
    DROP POLICY "Allow update for company_benchmarks" ON public.company_benchmarks;
  END IF;
END $$;

CREATE POLICY "Service role can insert company_benchmarks"
  ON public.company_benchmarks FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update company_benchmarks"
  ON public.company_benchmarks FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Tighten RLS on fate_cards
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fate_cards' AND policyname = 'Anyone can update fate cards') THEN
    DROP POLICY "Anyone can update fate cards" ON public.fate_cards;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fate_cards' AND policyname = 'Allow update for fate_cards') THEN
    DROP POLICY "Allow update for fate_cards" ON public.fate_cards;
  END IF;
END $$;

CREATE POLICY "Service role can update fate_cards"
  ON public.fate_cards FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

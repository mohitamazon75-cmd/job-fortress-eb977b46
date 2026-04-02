
-- ── Sprint 17: Report unlock payments ─────────────────────────────────────────
-- Stores payment/unlock status per child so the paywall gate can check it

CREATE TABLE public.report_unlocks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  child_id     UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  amount_paise INTEGER NOT NULL DEFAULT 99900,   -- ₹999 in paise
  currency     TEXT NOT NULL DEFAULT 'INR',
  payment_id   TEXT,                              -- Razorpay payment_id (set after capture)
  order_id     TEXT,                              -- Razorpay order_id
  status       TEXT NOT NULL DEFAULT 'pending',   -- pending | paid | refunded
  unlocked_at  TIMESTAMP WITH TIME ZONE,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, child_id)                      -- one record per child per user
);

ALTER TABLE public.report_unlocks ENABLE ROW LEVEL SECURITY;

-- Users can read their own unlock records
CREATE POLICY "Users can view own unlocks"
  ON public.report_unlocks FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own unlock record (to start a payment flow)
CREATE POLICY "Users can insert own unlocks"
  ON public.report_unlocks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own unlock record (to store payment_id etc.)
CREATE POLICY "Users can update own unlocks"
  ON public.report_unlocks FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for fast child lookups
CREATE INDEX idx_report_unlocks_child_id ON public.report_unlocks(child_id);
CREATE INDEX idx_report_unlocks_user_id  ON public.report_unlocks(user_id);

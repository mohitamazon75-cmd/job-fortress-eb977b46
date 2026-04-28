-- Event-level idempotency ledger for webhooks (Razorpay etc.)
-- Distinct from existing scan-level idempotency (which only catches "this scan
-- is already paid"). This catches "this exact webhook event has been processed"
-- which is the canonical Razorpay-recommended pattern.

CREATE TABLE IF NOT EXISTS public.processed_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     text NOT NULL,         -- 'razorpay' | future
  event_id     text NOT NULL,         -- Razorpay event.id (e.g. evt_xxx)
  event_type   text,                  -- e.g. 'payment.captured'
  payload      jsonb,                 -- raw event for audit
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT processed_events_unique UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_processed_events_provider_created
  ON public.processed_events (provider, created_at DESC);

-- RLS: deny everyone. Only service-role bypasses RLS.
ALTER TABLE public.processed_events ENABLE ROW LEVEL SECURITY;

-- No policies created on purpose: service-role bypasses RLS,
-- everyone else gets zero rows.

COMMENT ON TABLE public.processed_events IS
  'Webhook event-level idempotency ledger. INSERT with ON CONFLICT DO NOTHING to short-circuit replays.';

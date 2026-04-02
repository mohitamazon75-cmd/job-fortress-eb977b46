-- Migration: 20260326000002_add_posting_volume_proxy_to_market_signals.sql
-- Add new fields to market_signals table to support posting_volume_proxy
-- This migration makes posting_volume_30d optional (legacy) and adds the new honest fields

ALTER TABLE public.market_signals
ADD COLUMN IF NOT EXISTS posting_volume_proxy INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS posting_volume_source TEXT DEFAULT 'search_result_count',
ADD COLUMN IF NOT EXISTS posting_volume_note TEXT DEFAULT 'Based on web search result count — not a live job board count';

-- Create index on posting_volume_source for query optimization
CREATE INDEX IF NOT EXISTS idx_market_signals_posting_volume_source
ON public.market_signals(posting_volume_source);

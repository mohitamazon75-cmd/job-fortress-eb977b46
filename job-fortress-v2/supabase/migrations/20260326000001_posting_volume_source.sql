-- Migration: 20260326000001_posting_volume_source.sql
-- Mark legacy delta records so they can be distinguished from post-fix records
-- This does NOT alter any score or computed value — it only adds provenance metadata

UPDATE score_history
SET delta_summary = delta_summary || '{"posting_change_source": "legacy_estimate"}'::jsonb
WHERE delta_summary ? 'posting_change_pct'
  AND NOT delta_summary ? 'posting_change_source';

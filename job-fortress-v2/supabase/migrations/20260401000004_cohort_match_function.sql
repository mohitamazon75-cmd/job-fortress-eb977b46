-- ═══════════════════════════════════════════════════════════════
-- SQL function: match_scan_vectors
-- Called by the cohort-match edge function via supabase.rpc()
-- Uses pgvector cosine distance (<=>)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.match_scan_vectors(
  query_embedding   vector(16),
  match_count       INT DEFAULT 200,
  filter_role       TEXT DEFAULT NULL,
  filter_city       TEXT DEFAULT NULL,
  exclude_scan_id   UUID DEFAULT NULL
)
RETURNS TABLE (
  scan_id         UUID,
  stability_score INT,
  doom_months     INT,
  delta_stability INT,
  distance        FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    sv.scan_id,
    sv.stability_score,
    sv.doom_months,
    sv.delta_stability,
    (sv.embedding <=> query_embedding)::FLOAT AS distance
  FROM public.scan_vectors sv
  WHERE
    (filter_role IS NULL OR sv.role_family = filter_role)
    AND (filter_city IS NULL OR sv.city = filter_city)
    AND (exclude_scan_id IS NULL OR sv.scan_id <> exclude_scan_id)
  ORDER BY sv.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Grant execute to authenticated + anon roles (edge functions run as service_role)
GRANT EXECUTE ON FUNCTION public.match_scan_vectors TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_scan_vectors TO anon;
GRANT EXECUTE ON FUNCTION public.match_scan_vectors TO service_role;

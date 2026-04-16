-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Add semantic embedding columns
ALTER TABLE public.scan_vectors
  ADD COLUMN IF NOT EXISTS semantic_embedding extensions.vector(1536),
  ADD COLUMN IF NOT EXISTS semantic_model     TEXT DEFAULT 'text-embedding-3-small';

CREATE INDEX IF NOT EXISTS idx_scan_vectors_semantic_hnsw
  ON public.scan_vectors
  USING hnsw (semantic_embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE semantic_embedding IS NOT NULL;

COMMENT ON COLUMN public.scan_vectors.semantic_embedding IS
  '1536-dim text-embedding-3-small of concise profile text.';
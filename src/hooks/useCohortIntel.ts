// ═══════════════════════════════════════════════════════════════
// useCohortIntel — IP #1: Cohort Intelligence Engine (React hook)
// ═══════════════════════════════════════════════════════════════
// Fetches cohort intelligence for a given scan_id.
// Tries the cohort_cache table first (fast, no compute).
// Falls back to calling the cohort-match edge function if no
// cached result exists (triggers computation + caching).
//
// Usage:
//   const { data, loading, error } = useCohortIntel(scan?.id);
//
// Returns CohortData | null, with the ready-to-render insight_text.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CohortData {
  cohort_size: number;
  cohort_label: string;
  pct_improved: number | null;
  top_skill_gain: string | null;
  median_doom_months: number | null;
  median_stability: number | null;
  insight_text: string;
  computed_at: string;
}

interface UseCohortIntelResult {
  data: CohortData | null;
  loading: boolean;
  error: string | null;
}

export function useCohortIntel(scanId: string | undefined): UseCohortIntelResult {
  const [data, setData] = useState<CohortData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!scanId) return;
    if (fetchedForRef.current === scanId) return; // already fetched this scan
    fetchedForRef.current = scanId;

    let cancelled = false;

    async function fetchCohort() {
      setLoading(true);
      setError(null);

      try {
        // ── 1. Check cohort_cache first (fast path) ────────
        const { data: cached } = await supabase
          .from('cohort_cache')
          .select('*')
          .eq('scan_id', scanId!)
          .single();

        if (!cancelled && cached) {
          setData(cached as CohortData);
          setLoading(false);
          return;
        }

        // ── 2. Cache miss — call cohort-match edge function ─
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) {
          setLoading(false);
          return;
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const resp = await fetch(`${supabaseUrl}/functions/v1/cohort-match`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ scan_id: scanId }),
        });

        if (!cancelled) {
          if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            setError((errData as any).error ?? 'Failed to load cohort data');
          } else {
            const result = await resp.json();
            setData(result as CohortData);
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Could not load cohort data');
          setLoading(false);
        }
      }
    }

    fetchCohort();
    return () => { cancelled = true; };
  }, [scanId]);

  return { data, loading, error };
}

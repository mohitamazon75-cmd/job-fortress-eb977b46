import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LiveToolThreat {
  tool_name: string;
  automates: string;
  adoption: 'Mainstream' | 'Growing' | 'Early';
  evidence: string;
}

export interface LiveBook {
  title: string;
  author: string;
  year: number;
  why_relevant: string;
}

export interface LiveCourse {
  title: string;
  platform: string;
  url: string;
  why_relevant: string;
}

export interface LiveVideo {
  title: string;
  channel: string;
  why_relevant: string;
}

export interface PivotValidation {
  role: string;
  is_viable: boolean;
  active_postings_estimate: string;
  salary_range_lpa: string;
  top_companies_hiring: string[];
  evidence: string;
}

export interface LiveEnrichment {
  tool_threats: LiveToolThreat[];
  threat_summary: string | null;
  threat_citations: string[];
  books: LiveBook[];
  courses: LiveCourse[];
  videos: LiveVideo[];
  resource_citations: string[];
  pivot_validation: PivotValidation[];
  pivot_citations: string[];
  enriched_at: string;
  source: string;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_CACHE_KEY_PREFIX = 'jb_enrichment_';

export function useLiveEnrichment(
  role: string,
  industry: string,
  skills: string[],
  moatSkills: string[],
  pivotRoles: string[],
  scanId?: string,
  country?: string | null
) {
  const [data, setData] = useState<LiveEnrichment | null>(null);
  const [loading, setLoading] = useState(true);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!role) { setLoading(false); return; }

    let cancelled = false;

    const run = async () => {
      // Step 0: Check sessionStorage (avoids re-fetching on tab refresh / dashboard re-render)
      const sessionKey = `${SESSION_CACHE_KEY_PREFIX}${scanId || role}`;
      try {
        const sessionCached = sessionStorage.getItem(sessionKey);
        if (sessionCached) {
          const parsed = JSON.parse(sessionCached);
          if (parsed?.data && Date.now() - (parsed.ts || 0) < 30 * 60 * 1000) { // 30 min session cache
            if (!cancelled) {
              setData(parsed.data as LiveEnrichment);
              setCachedAt(parsed.cachedAt || null);
              setLoading(false);
            }
            return;
          }
        }
      } catch {}

      // Step 1: Check cache in scans table
      if (scanId) {
        const { data: row } = await (supabase
          .from('scans' as any)
          .select('enrichment_cache, enrichment_cached_at')
          .eq('id', scanId) as any)
          .single();

        const cached = row as any;
        if (cached?.enrichment_cache && cached?.enrichment_cached_at) {
          const age = Date.now() - new Date(cached.enrichment_cached_at).getTime();
          if (age < CACHE_TTL_MS) {
            if (!cancelled) {
              setData(cached.enrichment_cache as LiveEnrichment);
              setCachedAt(cached.enrichment_cached_at);
              setLoading(false);
              // Persist to session
              try { sessionStorage.setItem(sessionKey, JSON.stringify({ data: cached.enrichment_cache, cachedAt: cached.enrichment_cached_at, ts: Date.now() })); } catch {}
            }
            return;
          }
        }
      }

      // Step 2: Fetch fresh data via consolidated market-signals function
      try {
        const { data: result, error } = await supabase.functions.invoke('market-signals', {
          body: { signal_type: 'enrich', role, industry, skills, moatSkills, pivotRoles, country },
        });

        if (!error && result && !result.error && !cancelled) {
          const enrichment = result as LiveEnrichment;
          setData(enrichment);
          const now = new Date().toISOString();
          setCachedAt(now);
          // Persist to session
          try { sessionStorage.setItem(sessionKey, JSON.stringify({ data: enrichment, cachedAt: now, ts: Date.now() })); } catch {}

          // Step 3: Cache result in DB
          if (scanId) {
            await (supabase
              .from('scans' as any)
              .update({
                enrichment_cache: enrichment as any,
                enrichment_cached_at: now,
              } as any)
              .eq('id', scanId) as any);
          }
        }
      } catch {
        // silently fail
      }

      if (!cancelled) setLoading(false);
    };

    run();
    return () => { cancelled = true; };
  }, [role, industry, scanId]);

  return { data, loading, cachedAt };
}

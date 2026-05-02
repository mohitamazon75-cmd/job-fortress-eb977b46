import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

/**
 * AdminShadowParity — operator-only view of deterministic vs LLM
 * resume-match parity. Reads `shadow_match_log` (admin-RLS gated).
 *
 * The B2 plan: prove the deterministic Resume-Matcher engine matches
 * the LLM's self-reported jd_match_analysis.match_pct on real scans,
 * then promote the deterministic engine to primary path (kills LLM cost
 * for JD-matching).
 *
 * Promotion criteria:
 *   - >= 50 rows logged
 *   - MAE (det_rewritten vs llm) <= 15 points
 *   - >= 70% of rows in "≤25 pt gap" bucket
 *
 * If those don't hold, the gap is real and the det engine needs tuning
 * before it can replace the LLM score. This page tells the truth, not
 * a story.
 */

interface ShadowRow {
  id: string;
  function_name: string | null;
  role: string | null;
  has_jd: boolean | null;
  det_pct: number | null;
  det_pct_original: number | null;
  det_pct_rewritten: number | null;
  rewritten_text_chars: number | null;
  llm_pct: number | null;
  resume_source: string | null;
  runtime_ms: number | null;
  created_at: string;
}

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function mae(pairs: Array<[number, number]>): number {
  if (!pairs.length) return 0;
  return mean(pairs.map(([a, b]) => Math.abs(a - b)));
}

function correlationBucket(diff: number): '≤10' | '11–25' | '>25' {
  const d = Math.abs(diff);
  if (d <= 10) return '≤10';
  if (d <= 25) return '11–25';
  return '>25';
}

export default function AdminShadowParity() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ShadowRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('shadow_match_log' as any)
          .select('id,function_name,role,has_jd,det_pct,det_pct_original,det_pct_rewritten,rewritten_text_chars,llm_pct,resume_source,runtime_ms,created_at')
          .order('created_at', { ascending: false })
          .limit(500);
        if (cancelled) return;
        if (queryError) {
          setError(queryError.message);
          setRows([]);
          return;
        }
        setRows((data ?? []) as unknown as ShadowRow[]);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'unknown error');
          setRows([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <h1 className="text-2xl font-bold mb-4">Shadow Parity — Error</h1>
        <p className="text-destructive">{error}</p>
        <button
          onClick={() => navigate('/admin/monitor')}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded"
        >
          Back to admin
        </button>
      </div>
    );
  }

  if (rows === null) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        Loading shadow parity log…
      </div>
    );
  }

  // Apples-to-apples pairs: det_rewritten vs llm_pct (the real comparison)
  const rewrittenPairs: Array<[number, number]> = rows
    .filter((r) => r.det_pct_rewritten != null && r.llm_pct != null)
    .map((r) => [r.det_pct_rewritten as number, r.llm_pct as number]);

  // Apples-to-oranges pairs (legacy): det_original vs llm_pct
  const originalPairs: Array<[number, number]> = rows
    .filter((r) => r.det_pct_original != null && r.llm_pct != null)
    .map((r) => [r.det_pct_original as number, r.llm_pct as number]);

  const maeRewritten = mae(rewrittenPairs);
  const maeOriginal = mae(originalPairs);

  // Bucket distribution (apples-to-apples)
  const buckets = { '≤10': 0, '11–25': 0, '>25': 0 } as Record<string, number>;
  for (const [d, l] of rewrittenPairs) {
    buckets[correlationBucket(d - l)]++;
  }
  const totalBucketed = rewrittenPairs.length || 1;
  const pctTight = ((buckets['≤10'] / totalBucketed) * 100).toFixed(0);
  const pctMid = ((buckets['11–25'] / totalBucketed) * 100).toFixed(0);
  const pctWide = ((buckets['>25'] / totalBucketed) * 100).toFixed(0);

  // Resume source breakdown
  const sourceCounts: Record<string, number> = {};
  for (const r of rows) {
    const k = r.resume_source ?? 'unknown';
    sourceCounts[k] = (sourceCounts[k] ?? 0) + 1;
  }

  // Promotion gate
  const promotionReady =
    rewrittenPairs.length >= 50 &&
    maeRewritten <= 15 &&
    (buckets['≤10'] + buckets['11–25']) / totalBucketed >= 0.7;

  return (
    <div className="min-h-screen bg-background text-foreground p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Shadow Parity — Det vs LLM</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Resume-Matcher (deterministic) vs LLM <code>jd_match_analysis.match_pct</code>.
            Apples-to-apples = det scores the rewritten resume.
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/monitor')}
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded text-sm"
        >
          ← Admin
        </button>
      </div>

      {/* Promotion gate */}
      <div className={`p-4 rounded-lg mb-6 border ${promotionReady ? 'bg-green-500/10 border-green-500/40' : 'bg-amber-500/10 border-amber-500/40'}`}>
        <div className="font-semibold">
          {promotionReady ? '✅ READY to promote det engine to primary' : '⏳ NOT YET ready to promote'}
        </div>
        <div className="text-xs mt-1 opacity-80">
          Gate: ≥50 rows · MAE ≤15 · ≥70% within 25-pt gap.
          Current: {rewrittenPairs.length} rows · MAE {maeRewritten.toFixed(1)} · {((buckets['≤10'] + buckets['11–25']) / totalBucketed * 100).toFixed(0)}% within 25 pt.
        </div>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-card border rounded-lg">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Rows logged</div>
          <div className="text-2xl font-bold mt-1">{rows.length}</div>
        </div>
        <div className="p-4 bg-card border rounded-lg">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">MAE — Rewritten vs LLM</div>
          <div className="text-2xl font-bold mt-1">{maeRewritten.toFixed(1)} pt</div>
          <div className="text-xs text-muted-foreground mt-1">apples-to-apples · n={rewrittenPairs.length}</div>
        </div>
        <div className="p-4 bg-card border rounded-lg">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">MAE — Original vs LLM</div>
          <div className="text-2xl font-bold mt-1">{maeOriginal.toFixed(1)} pt</div>
          <div className="text-xs text-muted-foreground mt-1">apples-to-oranges · n={originalPairs.length}</div>
        </div>
        <div className="p-4 bg-card border rounded-lg">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Tight buckets (≤25 pt)</div>
          <div className="text-2xl font-bold mt-1">
            {((buckets['≤10'] + buckets['11–25']) / totalBucketed * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Bucket breakdown */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Gap distribution (rewritten vs LLM)</h2>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
            <div className="text-xs text-muted-foreground">≤10 pt gap (great)</div>
            <div className="text-xl font-bold">{buckets['≤10']} <span className="text-sm font-normal opacity-70">({pctTight}%)</span></div>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded">
            <div className="text-xs text-muted-foreground">11–25 pt gap (acceptable)</div>
            <div className="text-xl font-bold">{buckets['11–25']} <span className="text-sm font-normal opacity-70">({pctMid}%)</span></div>
          </div>
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
            <div className="text-xs text-muted-foreground">&gt;25 pt gap (drift)</div>
            <div className="text-xl font-bold">{buckets['>25']} <span className="text-sm font-normal opacity-70">({pctWide}%)</span></div>
          </div>
        </div>
      </div>

      {/* Resume source */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Resume source</h2>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(sourceCounts).map(([src, n]) => (
            <div key={src} className="px-3 py-2 bg-secondary text-secondary-foreground rounded text-sm">
              <code>{src}</code>: <strong>{n}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Recent rows table */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Recent rows ({Math.min(rows.length, 50)})</h2>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="p-2">When</th>
                <th className="p-2">Role</th>
                <th className="p-2">JD?</th>
                <th className="p-2">Source</th>
                <th className="p-2">Rewritten chars</th>
                <th className="p-2">det_orig</th>
                <th className="p-2">det_rewr</th>
                <th className="p-2">LLM</th>
                <th className="p-2">Δ (rewr−llm)</th>
                <th className="p-2">ms</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((r) => {
                const delta =
                  r.det_pct_rewritten != null && r.llm_pct != null
                    ? r.det_pct_rewritten - r.llm_pct
                    : null;
                const deltaClass =
                  delta == null ? 'text-muted-foreground' :
                  Math.abs(delta) <= 10 ? 'text-green-500' :
                  Math.abs(delta) <= 25 ? 'text-amber-500' : 'text-red-500';
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="p-2 max-w-[160px] truncate">{r.role ?? '—'}</td>
                    <td className="p-2">{r.has_jd ? '✓' : '—'}</td>
                    <td className="p-2"><code className="text-xs">{r.resume_source ?? '—'}</code></td>
                    <td className="p-2">{r.rewritten_text_chars ?? '—'}</td>
                    <td className="p-2">{r.det_pct_original ?? '—'}</td>
                    <td className="p-2 font-semibold">{r.det_pct_rewritten ?? '—'}</td>
                    <td className="p-2">{r.llm_pct ?? '—'}</td>
                    <td className={`p-2 font-mono ${deltaClass}`}>
                      {delta == null ? '—' : (delta > 0 ? `+${delta}` : delta)}
                    </td>
                    <td className="p-2 text-muted-foreground">{r.runtime_ms ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No shadow rows yet. Trigger a Resume Weaponizer run with a JD to populate.
          </p>
        )}
      </div>
    </div>
  );
}

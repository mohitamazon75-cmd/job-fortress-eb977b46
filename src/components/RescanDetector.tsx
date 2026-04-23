import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { type ScanReport } from '@/lib/scan-engine';

const PENDING_SCAN_MODE_KEY = 'jb_pending_scan_mode';

interface PreviousScan {
  id: string;
  role_detected: string | null;
  industry: string | null;
  scan_status: string | null;
  created_at: string;
  final_json_report: any;
}

interface RescanDetectorProps {
  onViewPrevious: (report: ScanReport, scanId: string) => void;
  onStartNew: () => void;
}

export default function RescanDetector({ onViewPrevious, onStartNew }: RescanDetectorProps) {
  const [previousScans, setPreviousScans] = useState<PreviousScan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If the user came here after starting a new scan flow, never surface old scans.
    try {
      const lsIntent = localStorage.getItem('jb_fresh_scan_intent');
      const ssPending = sessionStorage.getItem('jb_pending_input');
      const pendingMode = localStorage.getItem(PENDING_SCAN_MODE_KEY);
      const hasPendingWork = lsIntent === '1' || Boolean(ssPending) || pendingMode === 'resume' || pendingMode === 'linkedin';
      if (hasPendingWork) {
        localStorage.removeItem('jb_fresh_scan_intent');
        onStartNew();
        return;
      }
    } catch { /* non-fatal */ }

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data } = await supabase.from('scans')
          .select('id, role_detected, industry, scan_status, created_at, final_json_report')
          .eq('user_id', user.id)
          .eq('scan_status', 'complete')
          .order('created_at', { ascending: false })
          .limit(3);

        setPreviousScans((data || []) as PreviousScan[]);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [onStartNew]);

  // Auto-advance when no previous scans
  useEffect(() => {
    if (!loading && previousScans.length === 0) onStartNew();
  }, [loading, previousScans.length, onStartNew]);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
    </div>
  );

  if (previousScans.length === 0) return null;

  const formatDate = (d: string) => {
    const diffDays = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-3"
      >
        {/* ── PRIMARY CTA: Start New Scan — always at top, always dominant ── */}
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            try { localStorage.removeItem('jb_fresh_scan_intent'); } catch {}
            onStartNew();
          }}
          className="w-full flex items-center justify-between p-5 rounded-2xl text-primary-foreground font-bold text-base"
          style={{ background: 'var(--gradient-primary)', boxShadow: '0 8px 32px hsl(var(--primary) / 0.3)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-base font-black">Start New Analysis</div>
              <div className="text-xs opacity-75">Upload a new resume or LinkedIn URL</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5" />
        </motion.button>

        {/* ── Divider ── */}
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
            or view previous
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* ── Previous scans — secondary, compact ── */}
        <div className="space-y-2">
          {previousScans.map((scan, idx) => {
            const report = scan.final_json_report as (ScanReport & { determinism_index?: number }) | null;
            // determinism_index = automation risk (higher = WORSE).
            // Convert to Career Position Score (100 - DI, higher = SAFER) so the
            // displayed number, color, and trend arrow all share one consistent
            // mental model with the hero score on the report page.
            const di = report?.determinism_index ?? null;
            const careerScore = di == null ? null : Math.max(0, Math.min(100, 100 - di));
            const prevScan = previousScans[idx + 1];
            const prevDi = prevScan?.final_json_report?.determinism_index ?? null;
            const prevCareerScore = prevDi == null ? null : Math.max(0, Math.min(100, 100 - prevDi));
            const delta = (careerScore != null && prevCareerScore != null)
              ? careerScore - prevCareerScore
              : null;
            const scoreColor = careerScore == null ? 'text-muted-foreground' :
              careerScore >= 70 ? 'text-green-600' : careerScore >= 50 ? 'text-blue-600' :
              careerScore >= 35 ? 'text-amber-600' : 'text-destructive';

            return (
              <motion.button
                key={scan.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + idx * 0.05 }}
                onClick={() => { if (report) onViewPrevious(report, scan.id); }}
                disabled={!report}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left disabled:opacity-40 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {scan.role_detected || 'Career Analysis'}
                    </p>
                    {idx === 0 && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
                        Latest
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {scan.industry} · {formatDate(scan.created_at)}
                    {delta != null && delta !== 0 && (
                      <span className={`ml-2 inline-flex items-center gap-0.5 ${delta > 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        {delta > 0 ? '+' : ''}{delta}
                      </span>
                    )}
                    {delta === 0 && (
                      <span className="ml-2 inline-flex items-center gap-0.5 text-muted-foreground">
                        <Minus className="w-2.5 h-2.5" />0
                      </span>
                    )}
                  </p>
                </div>
                {careerScore !== null && (
                  <span className={`text-sm font-black tabular-nums flex-shrink-0 ml-3 ${scoreColor}`}>
                    {careerScore}/100
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

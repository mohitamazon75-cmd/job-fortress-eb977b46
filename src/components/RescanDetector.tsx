import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, ArrowRight, Plus, TrendingUp, TrendingDown, Minus, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { type ScanReport } from '@/lib/scan-engine';

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
      } catch (e) {
        console.debug('[rescan-detector] error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Auto-advance when no previous scans — must be in useEffect to avoid render-time side effects
  useEffect(() => {
    if (!loading && previousScans.length === 0) {
      onStartNew();
    }
  }, [loading, previousScans.length, onStartNew]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Checking for previous analyses...</div>
      </div>
    );
  }

  if (previousScans.length === 0) {
    // Render nothing while useEffect triggers onStartNew
    return null;
  }

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const getDaysSince = (d: string) => {
    return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
  };

  const getDiColor = (di: number) => {
    if (di >= 70) return 'text-prophet-green bg-prophet-green/10 border-prophet-green/20';
    if (di >= 50) return 'text-primary bg-primary/10 border-primary/20';
    if (di >= 35) return 'text-prophet-gold bg-prophet-gold/10 border-prophet-gold/20';
    return 'text-destructive bg-destructive/10 border-destructive/20';
  };

  const latestScan = previousScans[0];
  const daysSinceLatest = latestScan ? getDaysSince(latestScan.created_at) : 0;
  const isDueForRescan = daysSinceLatest >= 30;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-4"
      >
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--gradient-primary)' }}>
            <Clock className="w-6 h-6 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-black text-foreground">Welcome Back!</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isDueForRescan
              ? `It's been ${daysSinceLatest} days — the AI landscape shifts fast. Your score may have changed.`
              : `You have ${previousScans.length} previous ${previousScans.length === 1 ? 'analysis' : 'analyses'}. View your results or start fresh.`
            }
          </p>
        </div>

        {/* Rescan nudge */}
        {isDueForRescan && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-prophet-gold/25 bg-prophet-gold/5 p-3 flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 text-prophet-gold flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-prophet-gold">Rescan recommended</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                AI adoption in your sector has likely shifted since your last scan {daysSinceLatest} days ago. A new scan reflects current market signals.
              </p>
            </div>
          </motion.div>
        )}

        {/* Previous scans */}
        <div className="space-y-2">
          {previousScans.map((scan, idx) => {
            const report = scan.final_json_report as (ScanReport & { determinism_index?: number }) | null;
            const di = report?.determinism_index ?? null;
            const days = getDaysSince(scan.created_at);
            // Compare to next scan if available
            const prevScan = previousScans[idx + 1];
            const prevDi = prevScan?.final_json_report?.determinism_index ?? null;
            const delta = (di != null && prevDi != null) ? di - prevDi : null;

            return (
              <motion.button
                key={scan.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.06 }}
                onClick={() => {
                  if (report) onViewPrevious(report, scan.id);
                }}
                disabled={!report}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left disabled:opacity-50 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-foreground truncate">
                      {scan.role_detected || 'Career Analysis'}
                    </p>
                    {idx === 0 && (
                      <span className="text-[11px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">Latest</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-[11px] text-muted-foreground">
                      {scan.industry || 'Unknown industry'} · {formatDate(scan.created_at)}
                    </p>
                    {/* Delta indicator */}
                    {delta !== null && (
                      <span className={`flex items-center gap-0.5 text-[10px] font-black ${delta > 0 ? 'text-prophet-green' : delta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : delta < 0 ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                        {delta > 0 ? '+' : ''}{delta} pts
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* DI score badge */}
                  {di !== null && (
                    <span className={`text-xs font-black px-2 py-1 rounded-lg border tabular-nums ${getDiColor(di)}`}>
                      {di}/100
                    </span>
                  )}
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* New scan button */}
        <button
          onClick={onStartNew}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 transition-colors font-bold text-sm"
        >
          {isDueForRescan
            ? <><RefreshCw className="w-4 h-4" /> Run New Scan — Market has shifted</>
            : <><Plus className="w-4 h-4" /> Start New Analysis</>
          }
        </button>
      </motion.div>
    </div>
  );
}

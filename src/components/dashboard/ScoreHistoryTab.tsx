import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import ScoreHistoryChart from './ScoreHistoryChart';
import { toast } from 'sonner';
import { Loader2, RotateCcw } from 'lucide-react';

interface ScoreHistoryRecord {
  id: string;
  scan_id: string;
  determinism_index: number;
  survivability_score: number | null;
  moat_score: number | null;
  role_detected: string | null;
  industry: string | null;
  created_at: string;
  delta_summary?: {
    score_change: number;
    moved_up: string[];
    moved_down: string[];
    new_risks: string[];
    new_moats: string[];
    summary_text: string;
  };
}

export interface ScoreHistoryTabProps {
  userId: string;
  locale?: string;
}

const PLACEHOLDER_LINES = [1, 2, 3]; // For skeleton loading

export default function ScoreHistoryTab({ userId, locale = 'en' }: ScoreHistoryTabProps) {
  const [records, setRecords] = useState<ScoreHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // i18n strings
  const strings = {
    en: {
      empty: "Run your first scan to see your score history here.",
      singleScanMsg: "Rescan in 30+ days to see your trend.",
      enrollNudge: "Enroll in rescan nudge emails",
      viewReport: "View report",
      rescanNow: "Rescan Now",
      score: "Score",
      loading: "Loading your score history...",
    },
    hi: {
      empty: "अपना पहला स्कैन करें अपने स्कोर इतिहास को देखने के लिए।",
      singleScanMsg: "अपनी प्रवृत्ति देखने के लिए 30+ दिनों में पुनः स्कैन करें।",
      enrollNudge: "रीस्कैन नज़ दई ईमेल में नामांकन करें",
      viewReport: "रिपोर्ट देखें",
      rescanNow: "अभी पुनः स्कैन करें",
      score: "स्कोर",
      loading: "आपका स्कोर इतिहास लोड हो रहा है...",
    },
  };

  const i18n = strings[locale as keyof typeof strings] || strings.en;

  // Fetch score history on mount
  useEffect(() => {
    const fetchScoreHistory = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('score_history')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }); // Oldest first

        if (error) throw error;

        setRecords((data as any) || []);
        setError(null);
      } catch (err) {
        console.error('[ScoreHistoryTab] Fetch error:', err);
        setError('Failed to load score history');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchScoreHistory();
    }
  }, [userId]);

  // Handle enroll nudge emails
  const handleEnrollNudge = async () => {
    try {
      const result = await supabase.functions.invoke('nurture-emails', {
        body: { campaign: 'rescan_nudge', user_id: userId }
      });
      if (result.error) {
        throw result.error;
      }
      toast.success('Enrolled in rescan nudge emails', {
        description: 'We\'ll remind you when it\'s time to rescan.',
      });
    } catch (err) {
      console.error('[ScoreHistoryTab] Nudge enrollment failed:', err);
      toast.error('Failed to enroll', {
        description: 'Please try again later.',
      });
    }
  };

  // Empty state
  if (!loading && records.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-8">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <RotateCcw className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-black text-foreground mb-1">Your score history starts here</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">{i18n.empty}</p>
          </div>
          <div className="max-w-sm mx-auto rounded-xl border border-border bg-card p-4 text-left space-y-2">
            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Why rescan?</p>
            <div className="space-y-1.5">
              {[
                'Track if AI risk is rising or falling in your field',
                'Measure the impact of new skills you\'ve added',
                'See if market conditions shifted since your last scan',
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">→</span>
                  <span className="text-xs text-muted-foreground">{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-8">
        <div className="flex items-center justify-center mb-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">{i18n.loading}</span>
        </div>
        <div className="space-y-2">
          {PLACEHOLDER_LINES.map((line) => (
            <div key={line} className="h-12 bg-secondary rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-8">
        <div className="text-center text-red-500">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Single scan state
  if (records.length === 1) {
    const record = records[0];
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-8 space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-4 text-foreground">Your Score Trend</h3>
          <ScoreHistoryChart
            data={[
              {
                date: record.created_at,
                score: record.determinism_index,
                scanId: record.scan_id,
                deltaText: record.delta_summary?.summary_text,
              },
            ]}
            onSelectScan={() => {}}
          />
          <p className="text-muted-foreground text-center mt-4">{i18n.singleScanMsg}</p>
        </div>

        <div className="bg-secondary/50 rounded-lg p-6 border border-border">
          <h4 className="font-semibold mb-3 text-foreground">Stay Updated</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Get email reminders to rescan and track how your market position evolves.
          </p>
          <button
            onClick={handleEnrollNudge}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            {i18n.enrollNudge}
          </button>
        </div>
      </div>
    );
  }

  // Multiple scans state (≥2)
  const chartData = records.map((r) => ({
    date: r.created_at,
    score: r.determinism_index,
    scanId: r.scan_id,
    deltaText: r.delta_summary?.summary_text,
  }));

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-8 space-y-8">
      {/* Chart */}
      <div>
        <h3 className="text-xl font-semibold mb-4 text-foreground">Your Score Trend</h3>
        <ScoreHistoryChart data={chartData} onSelectScan={() => {}} />
      </div>

      {/* Scan List */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-foreground">Your Scans</h3>
        <div className="space-y-3">
          {records.map((record) => {
            const date = new Date(record.created_at);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const deltaText = record.delta_summary?.summary_text;

            return (
              <div
                key={record.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{dateStr}</span>
                    <span className="text-sm font-semibold text-foreground">
                      {i18n.score}: {record.determinism_index}
                    </span>
                  </div>
                  {deltaText && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{deltaText}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    // Placeholder — can navigate to scan report in future
                  }}
                  className="ml-4 px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  {i18n.viewReport}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rescan CTA */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-6 border border-primary/20">
        <h4 className="font-semibold mb-2 text-foreground">Ready for another scan?</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Monitor how market conditions and your skills position evolves. New scans give you fresh insights.
        </p>
        <button
          onClick={() => {
            // Trigger rescan — parent component will handle this
            window.location.href = '/';
          }}
          className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          {i18n.rescanNow}
        </button>
      </div>
    </div>
  );
}

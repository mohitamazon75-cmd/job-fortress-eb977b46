import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ExternalLink, Loader2, Sparkles, Brain, BookOpen, Lock, Zap, Check } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/use-subscription';
import ProUpgradeModal from '@/components/ProUpgradeModal';

interface AITool {
  name: string;
  trending_signal: string;
  why_you: string;
}

interface Keyword {
  term: string;
  definition?: string;
}

interface HomeworkItem {
  title: string;
  author?: string;
  why: string;
  url?: string;
}

interface CheatSheetData {
  ai_tools?: AITool[];
  keywords?: Keyword[];
  homework?: Record<string, HomeworkItem | null>;
}

export default function InterviewCheatSheetCard({ report, scanId }: { report: ScanReport; scanId?: string }) {
  const { isActive } = useSubscription();
  const [data, setData] = useState<CheatSheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProModal, setShowProModal] = useState(false);

  const fetchCheatSheet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('cheat-sheet', {
        body: {
          role: report.role,
          industry: report.industry,
          skills: report.all_skills || [],
          country: (report as ScanReport & { country?: string }).country || 'IN',
        },
      });
      if (err) throw err;
      if (result?.error) throw new Error(result.error);
      setData(result as CheatSheetData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [report]);

  useEffect(() => {
    if (!data && !loading && isActive) fetchCheatSheet();
  }, [isActive, fetchCheatSheet, data, loading]);

  // ── Pro gate: show upgrade teaser ────────────────────────────
  if (!isActive) {
    return (
      <>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border-2 border-primary/30 bg-primary/[0.04] p-5 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">Pro Feature</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Interview Cheat Sheet is a Pro feature. Unlock it to get AI-curated talking points, industry keywords to drop, and weekend homework tailored to your interviews.
            </p>
          </div>
          <div className="space-y-1.5 text-left max-w-xs mx-auto">
            {[
              'AI tools to mention that impress',
              'Keywords to drop in conversation',
              'Curated weekend deep-dives',
              'Personalized to your role & industry',
            ].map(f => (
              <div key={f} className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-prophet-green flex-shrink-0" />
                <span className="text-xs text-foreground/80">{f}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowProModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm hover:bg-primary/90 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Unlock Pro — from ₹300/mo
          </button>
          <p className="text-[11px] text-muted-foreground">
            One upgrade · unlocks all 4 Pro cards in this report
          </p>
        </motion.div>
        <ProUpgradeModal
          isOpen={showProModal}
          onClose={() => setShowProModal(false)}
        />
      </>
    );
  }

  if (loading && !data) {
    return (
      <div className="rounded-xl border-2 border-primary/20 bg-primary/[0.03] p-5 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
        <p className="text-sm font-bold text-foreground">Building your interview cheat sheet...</p>
        <p className="text-[11px] text-muted-foreground">AI tools, keywords & homework for {report.role}</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border-2 border-destructive/20 bg-destructive/5 p-5 text-center space-y-3">
        <AlertTriangle className="w-6 h-6 text-destructive mx-auto" />
        <p className="text-sm text-destructive font-medium">{error}</p>
        <button onClick={fetchCheatSheet} className="text-xs font-bold text-primary hover:underline">Try Again</button>
      </div>
    );
  }

  if (!data) return null;

  const aiTools = data.ai_tools || [];
  const keywords = data.keywords || [];
  const homework = data.homework || {};

  const trendingBadge = (signal: string) => {
    const config: Record<string, { bg: string; text: string }> = {
      viral: { bg: 'bg-destructive/10', text: 'text-destructive' },
      surging: { bg: 'bg-prophet-green/10', text: 'text-prophet-green' },
      emerging: { bg: 'bg-prophet-cyan/10', text: 'text-prophet-cyan' },
      sleeper: { bg: 'bg-prophet-gold/10', text: 'text-prophet-gold' },
    };
    const c = config[signal] || config.emerging;
    return <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>{signal}</span>;
  };

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border-2 border-primary/20 bg-primary/[0.03] p-4">
        <p className="text-[11px] font-black uppercase tracking-widest text-primary/70 mb-2">
          <Sparkles className="w-3 h-3 inline mr-1" />AI TOOLS TO MENTION IN INTERVIEWS
        </p>
        <div className="space-y-2">
          {aiTools.slice(0, 5).map((tool, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[10px] font-black text-primary bg-primary/10 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-foreground">{tool.name}</span>
                  {trendingBadge(tool.trending_signal)}
                </div>
                <p className="text-[10px] text-muted-foreground">{tool.why_you}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-xl border-2 border-prophet-green/20 bg-prophet-green/[0.03] p-4">
        <p className="text-[11px] font-black uppercase tracking-widest text-prophet-green/70 mb-2">
          <Brain className="w-3 h-3 inline mr-1" />KEYWORDS TO DROP IN CONVERSATION
        </p>
        <div className="flex flex-wrap gap-1.5">
          {keywords.slice(0, 8).map((kw, i: number) => (
            <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-lg border border-prophet-green/20 bg-prophet-green/5 text-prophet-green" title={kw.definition}>
              {kw.term}
            </span>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-xl border-2 border-border bg-card p-4">
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-2">
          <BookOpen className="w-3 h-3 inline mr-1" />WEEKEND HOMEWORK
        </p>
        <div className="space-y-2">
          {Object.entries(homework).map(([type, item]) => {
            if (!item) return null;
            const icons: Record<string, string> = { book: '📖', video: '🎬', course: '🎓', blog: '📰' };
            return (
              <div key={type} className="flex items-start gap-2 rounded-lg bg-muted/40 p-2.5">
                <span className="text-sm flex-shrink-0">{icons[type] || '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">{item.title}</p>
                  {item.author && <p className="text-[10px] text-muted-foreground">by {item.author}</p>}
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.why}</p>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5 mt-0.5">
                      <ExternalLink className="w-2.5 h-2.5" /> Open
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

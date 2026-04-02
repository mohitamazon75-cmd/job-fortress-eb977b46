import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Loader2, Brain, BookOpen, Rocket, Clock, Target, GraduationCap, Play, FileText, WifiOff, Lock, Zap, Check, Flame, TrendingUp, Leaf, Star, Code2, Palette, BarChart2, MessageSquare, Bot, Wrench } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/use-subscription';
import ProUpgradeModal from '@/components/ProUpgradeModal';

interface AITool {
  name: string;
  tagline?: string;
  trending_signal: string;
  why_you: string;
  category?: string;
}

interface Keyword {
  term: string;
  definition?: string;
  relevance?: string;
  hot_level?: string;
}

interface HomeworkItem {
  title: string;
  author?: string;
  channel?: string;
  platform?: string;
  source?: string;
  why: string;
  url?: string;
}

interface SkillUpgradeData {
  ai_tools?: AITool[];
  keywords?: Keyword[];
  homework?: Record<string, HomeworkItem | null>;
  ai_unavailable?: boolean;
}

export default function SkillUpgradePlanCard({ report, scanId }: { report: ScanReport; scanId?: string }) {
  const { isActive } = useSubscription();
  const [data, setData] = useState<SkillUpgradeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProModal, setShowProModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('cheat-sheet', {
        body: {
          role: report.role,
          industry: report.industry,
          skills: report.all_skills || [],
          moatSkills: report.moat_skills || [],
          country: report.country || 'IN',
        },
      });
      if (err) throw err;
      if (result?.error) throw new Error(result.error);
      setData(result as SkillUpgradeData);
      if (result?.ai_unavailable) return; // handled by render path below
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [report]);

  useEffect(() => {
    if (!data && !loading && isActive) fetchData();
  }, [isActive, fetchData, data, loading]);

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
              Your personalized skill upgrade plan is a Pro feature. Unlock it to get AI-curated tools, industry buzzwords and learning resources for your exact role and skill profile.
            </p>
          </div>
          <div className="space-y-1.5 text-left max-w-xs mx-auto">
            {[
              'Tools reshaping your industry right now',
              'Critical buzzwords to master',
              'Curated weekend learning resources',
              'Personalized to your role & skills',
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
        <p className="text-sm font-bold text-foreground">Building your personalized skill upgrade plan...</p>
        <p className="text-[11px] text-muted-foreground">AI tools, concepts & learning resources for {report.role}</p>
      </div>
    );
  }

  if (error && !data) {
    // Show a friendly error — hide raw technical messages from users
    const isAIError = error.toLowerCase().includes('ai') || error.toLowerCase().includes('configured') || error.toLowerCase().includes('non-2xx') || error.toLowerCase().includes('502') || error.toLowerCase().includes('500');
    return (
      <div className="rounded-xl border-2 border-border bg-muted/30 p-5 text-center space-y-3">
        <WifiOff className="w-6 h-6 text-muted-foreground mx-auto" />
        <div>
          <p className="text-sm font-bold text-foreground">
            {isAIError ? 'Skill plan temporarily unavailable' : 'Could not load your skill plan'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isAIError
              ? 'Our AI is taking a quick break. Your personalised tools and resources will be ready soon.'
              : 'Something went wrong loading your skill plan.'}
          </p>
        </div>
        <button onClick={fetchData} className="text-xs font-black text-primary hover:underline uppercase tracking-wider">
          Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

  // AI temporarily unavailable — show placeholder card
  if (data.ai_unavailable) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border-2 border-border bg-muted/20 p-6 text-center space-y-4">
        <WifiOff className="w-8 h-8 text-muted-foreground mx-auto" />
        <div>
          <p className="text-sm font-black text-foreground">Skill Plan Coming Soon</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
            Your personalised AI tools, buzzwords and weekend deep-dives are being prepared.
            This feature is rolling out now — check back shortly.
          </p>
        </div>
        <button onClick={fetchData}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-background text-xs font-bold text-foreground hover:border-primary/30 transition-colors">
          <Rocket className="w-3.5 h-3.5" />
          Retry
        </button>
      </motion.div>
    );
  }

  const aiTools = data.ai_tools || [];
  const keywords = data.keywords || [];
  const homework = data.homework || {};

  const trendingBadge = (signal: string) => {
    const config: Record<string, { bg: string; text: string; label: string; Icon: React.ComponentType<{className?: string}> }> = {
      viral:    { bg: 'bg-destructive/10',      text: 'text-destructive',    label: 'Viral',       Icon: Flame },
      surging:  { bg: 'bg-prophet-green/10',    text: 'text-prophet-green',  label: 'Surging',     Icon: TrendingUp },
      emerging: { bg: 'bg-prophet-cyan/10',     text: 'text-prophet-cyan',   label: 'Emerging',    Icon: Leaf },
      sleeper:  { bg: 'bg-prophet-gold/10',     text: 'text-prophet-gold',   label: 'Sleeper Hit', Icon: Star },
    };
    const c = config[signal] || config.emerging;
    return <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>
      <c.Icon className="w-3 h-3" />{c.label}
    </span>;
  };

  const CategoryIcon = ({ cat }: { cat?: string }) => {
    const icons: Record<string, React.ComponentType<{className?: string}>> = {
      productivity: Zap, coding: Code2, design: Palette,
      analytics: BarChart2, communication: MessageSquare, automation: Bot,
    };
    const Icon = icons[cat || ''] || Wrench;
    return <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />;
  };

  const homeworkConfig: Record<string, { icon: React.ReactNode; label: string; accent: string; bg: string; border: string }> = {
    book: {
      icon: <BookOpen className="w-4 h-4" />, label: 'Read This Book',
      accent: 'text-primary', bg: 'bg-primary/[0.04]', border: 'border-primary/15',
    },
    video: {
      icon: <Play className="w-4 h-4" />, label: 'Watch This Talk',
      accent: 'text-prophet-gold', bg: 'bg-prophet-gold/[0.04]', border: 'border-prophet-gold/15',
    },
    course: {
      icon: <GraduationCap className="w-4 h-4" />, label: 'Take This Course',
      accent: 'text-prophet-green', bg: 'bg-prophet-green/[0.04]', border: 'border-prophet-green/15',
    },
    blog: {
      icon: <FileText className="w-4 h-4" />, label: 'Read This Article',
      accent: 'text-prophet-cyan', bg: 'bg-prophet-cyan/[0.04]', border: 'border-prophet-cyan/15',
    },
  };

  return (
    <div className="space-y-4">
      {/* Section 1: Tools to Learn */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border-2 border-primary/20 bg-primary/[0.03] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Rocket className="w-4 h-4 text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Tools You Should Learn Now</p>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">
          These AI tools are reshaping how {report.role || 'your role'} works. Learning them now puts you ahead.
        </p>
        <div className="space-y-2.5">
          {aiTools.slice(0, 5).map((tool, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.12, duration: 0.35 }}
              className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-1">
                <CategoryIcon cat={tool.category} />
                <span className="text-xs font-black text-foreground">{tool.name}</span>
                {trendingBadge(tool.trending_signal)}
              </div>
              {tool.tagline && (
                <p className="text-xs text-foreground/70 font-medium mb-0.5">{tool.tagline}</p>
              )}
              <p className="text-xs text-muted-foreground">{tool.why_you}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Section 2: Concepts to Master */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-2xl border-2 border-prophet-green/20 bg-prophet-green/[0.03] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-prophet-green" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-prophet-green">Concepts You Must Know</p>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">
          These terms and ideas are shaping your industry right now. Know them cold.
        </p>
        <div className="space-y-2">
          {keywords.slice(0, 8).map((kw, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.35 }}
              className="rounded-lg border border-prophet-green/15 bg-prophet-green/[0.03] px-3 py-2">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-black text-prophet-green">{kw.term}</span>
                {kw.hot_level && <span className="text-[11px]">{kw.hot_level}</span>}
              </div>
              {kw.definition && (
                <p className="text-xs text-foreground/70">{kw.definition}</p>
              )}
              {kw.relevance && (
                <p className="text-xs text-muted-foreground mt-0.5 italic">{kw.relevance}</p>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Section 3: Weekend Deep-Dives — expanded */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-2xl border-2 border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-4 h-4 text-foreground" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">Weekend Deep-Dives</p>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">
          Curated resources to level up — each one picked specifically for a {report.role} in {report.industry}.
        </p>
        <div className="space-y-3">
          {Object.entries(homework).map(([type, item], i) => {
            if (!item) return null;
            const config = homeworkConfig[type] || homeworkConfig.blog;
            const subtitle = item.author ? `by ${item.author}`
              : item.channel ? `by ${item.channel}`
              : item.platform ? `on ${item.platform}`
              : item.source ? `via ${item.source}` : '';

            return (
              <motion.div key={type} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.08 }}
                className={`rounded-xl border-2 ${config.border} ${config.bg} p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={config.accent}>{config.icon}</span>
                  <p className={`text-[11px] font-black uppercase tracking-widest ${config.accent}`}>{config.label}</p>
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full ml-auto flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {type === 'book' ? '4-6 hrs' : type === 'course' ? '3-5 hrs' : type === 'video' ? '30-60 min' : '15-20 min'}
                  </span>
                </div>
                <p className="text-sm font-bold text-foreground leading-snug">{item.title}</p>
                {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
                <p className="text-[11px] text-foreground/70 mt-1.5 leading-relaxed">{item.why}</p>
                {item.url && (
                  <>
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1 mt-2 text-[11px] font-bold ${config.accent} hover:underline`}>
                      <ExternalLink className="w-3 h-3" /> Find it →
                    </a>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic">
                      Link opens to search — verify the exact resource before using.
                    </p>
                  </>
                )}
                {!item.url && (
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(item.title + (item.author ? ' ' + item.author : ''))}`}
                    target="_blank" rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 mt-2 text-[11px] font-bold ${config.accent} hover:underline`}>
                    <ExternalLink className="w-3 h-3" /> Search for it →
                  </a>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Bottom note */}
      <p className="text-[11px] text-muted-foreground/50 text-center italic">
        Resources curated from real-time market intelligence · personalized to your exact skill profile
      </p>
    </div>
  );
}

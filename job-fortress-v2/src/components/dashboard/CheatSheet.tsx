import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap, BookOpen, Video, GraduationCap, Newspaper, ExternalLink, Flame, TrendingUp, Brain, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { type ScanReport } from '@/lib/scan-engine';
import { getVerbatimRole } from '@/lib/role-guard';

interface CheatSheetProps {
  report: ScanReport;
  scanId: string;
  country?: string | null;
}

interface AITool {
  name: string;
  tagline: string;
  why_you: string;
  trending_signal: 'viral' | 'surging' | 'emerging' | 'sleeper';
  category: string;
}

interface Keyword {
  term: string;
  definition: string;
  relevance: string;
  hot_level: string;
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

interface CheatSheetData {
  ai_tools: AITool[];
  keywords: Keyword[];
  homework: {
    book?: HomeworkItem;
    video?: HomeworkItem;
    course?: HomeworkItem;
    blog?: HomeworkItem;
  };
  citations: string[];
  generated_at: string;
  profile_context: { role: string; industry: string; country: string };
}

const SESSION_KEY_PREFIX = 'jb_cheatsheet_';

const trendingBadge: Record<string, { label: string; className: string }> = {
  viral: { label: '🚀 VIRAL', className: 'bg-prophet-red/15 text-prophet-red border-prophet-red/30' },
  surging: { label: '📈 SURGING', className: 'bg-prophet-gold/15 text-prophet-gold border-prophet-gold/30' },
  emerging: { label: '🌱 EMERGING', className: 'bg-primary/15 text-primary border-primary/30' },
  sleeper: { label: '💎 SLEEPER HIT', className: 'bg-prophet-green/15 text-prophet-green border-prophet-green/30' },
};

const categoryIcon: Record<string, string> = {
  productivity: '⚡', coding: '💻', design: '🎨', analytics: '📊', communication: '💬', automation: '🤖',
};

export default function CheatSheet({ report, scanId, country }: CheatSheetProps) {
  const [data, setData] = useState<CheatSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (force = false) => {
    setLoading(true);
    setError(null);

    const sessionKey = `${SESSION_KEY_PREFIX}${scanId}`;

    // Session cache check
    if (!force) {
      try {
        const cached = sessionStorage.getItem(sessionKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.data && Date.now() - (parsed.ts || 0) < 30 * 60 * 1000) {
            setData(parsed.data);
            setLoading(false);
            return;
          }
        }
      } catch {}
    }

    try {
      const verbatimRole = getVerbatimRole(report);
      const { data: result, error: fnError } = await supabase.functions.invoke('cheat-sheet', {
        body: {
          role: verbatimRole,
          industry: report.industry,
          skills: (report.all_skills || [...(report.execution_skills_dead || []), ...(report.moat_skills || [])]).slice(0, 10),
          moatSkills: report.moat_indicators || report.moat_skills || [],
          company: report.linkedin_company,
          country,
          yearsExperience: (report as any).years_experience || (report as any).seniority_tier,
        },
      });

      if (fnError || result?.error) {
        setError(result?.error || 'Failed to generate cheat sheet');
        setLoading(false);
        return;
      }

      setData(result as CheatSheetData);
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify({ data: result, ts: Date.now() }));
      } catch {}
    } catch {
      setError('Network error');
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [scanId]);

  const displayRole = getVerbatimRole(report);
  const displayIndustry = report.industry || 'Technology';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">
          Building your personalized cheat sheet...
        </p>
        <p className="text-xs text-muted-foreground/60">
          Scanning latest AI tools & trends for {displayRole}s
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground mb-3">{error || 'No data available'}</p>
        <button onClick={() => fetchData(true)} className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto">
          <RefreshCw className="w-3 h-3" /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-3">
          <Brain className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-black uppercase tracking-widest text-primary">
            Personalized for {displayRole} · {displayIndustry}
          </span>
        </div>
      </motion.div>

      {/* ═══ SECTION 1: Latest AI Tools ═══ */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-black text-foreground uppercase tracking-wide">AI Tools You Should Know</h3>
            <p className="text-[10px] text-muted-foreground">Trending tools reshaping {displayRole} workflows right now</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.ai_tools.map((tool, i) => {
            const badge = trendingBadge[tool.trending_signal] || trendingBadge.emerging;
            const icon = categoryIcon[tool.category] || '🔧';
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                className="group rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    <h4 className="text-sm font-black text-foreground">{tool.name}</h4>
                  </div>
                  <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full border ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{tool.tagline}</p>
                <div className="flex items-start gap-1.5 bg-primary/[0.04] rounded-lg p-2">
                  <ArrowRight className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-foreground leading-relaxed">{tool.why_you}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* ═══ SECTION 2: Keywords to Remember ═══ */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-prophet-gold/10 border border-prophet-gold/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-prophet-gold" />
          </div>
          <div>
            <h3 className="text-sm font-black text-foreground uppercase tracking-wide">Keywords to Remember</h3>
            <p className="text-[10px] text-muted-foreground">Buzzwords shaping your space — know them before your next meeting</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {data.keywords.map((kw, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.04 }}
              className="rounded-lg border border-border bg-card p-3 hover:border-prophet-gold/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-black text-foreground">{kw.term}</span>
                <span className="text-xs">{kw.hot_level}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-1.5">{kw.definition}</p>
              <p className="text-[10px] text-primary font-medium">↳ {kw.relevance}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ═══ SECTION 3: Homework ═══ */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-prophet-green/10 border border-prophet-green/20 flex items-center justify-center">
            <Flame className="w-4 h-4 text-prophet-green" />
          </div>
          <div>
            <h3 className="text-sm font-black text-foreground uppercase tracking-wide">Your Homework</h3>
            <p className="text-[10px] text-muted-foreground">One of each — curated for your exact profile</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.homework.book && (
            <HomeworkCard
              icon={<BookOpen className="w-4 h-4" />}
              label="📖 Book"
              title={data.homework.book.title}
              subtitle={data.homework.book.author || ''}
              why={data.homework.book.why}
              url={data.homework.book.url}
              color="text-primary"
              bgColor="bg-primary/5"
            />
          )}
          {data.homework.video && (
            <HomeworkCard
              icon={<Video className="w-4 h-4" />}
              label="🎬 Video"
              title={data.homework.video.title}
              subtitle={data.homework.video.channel || ''}
              why={data.homework.video.why}
              url={data.homework.video.url}
              color="text-prophet-red"
              bgColor="bg-prophet-red/5"
            />
          )}
          {data.homework.course && (
            <HomeworkCard
              icon={<GraduationCap className="w-4 h-4" />}
              label="🎓 Course"
              title={data.homework.course.title}
              subtitle={data.homework.course.platform || ''}
              why={data.homework.course.why}
              url={data.homework.course.url}
              color="text-prophet-gold"
              bgColor="bg-prophet-gold/5"
            />
          )}
          {data.homework.blog && (
            <HomeworkCard
              icon={<Newspaper className="w-4 h-4" />}
              label="📝 Blog"
              title={data.homework.blog.title}
              subtitle={data.homework.blog.source || ''}
              why={data.homework.blog.why}
              url={data.homework.blog.url}
              color="text-prophet-green"
              bgColor="bg-prophet-green/5"
            />
          )}
        </div>
      </motion.section>

      {/* Citations */}
      {data.citations.length > 0 && (
        <div className="pt-4 border-t border-border">
          <p className="text-[11px] text-muted-foreground/50 uppercase tracking-widest mb-2">Sources</p>
          <div className="flex flex-wrap gap-1.5">
            {data.citations.slice(0, 6).map((url, i) => {
              const domain = new URL(url).hostname.replace('www.', '');
              return (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-muted-foreground/40 hover:text-primary transition-colors underline">
                  {domain}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Refresh */}
      <div className="text-center pb-4">
        <button onClick={() => fetchData(true)} className="text-[10px] text-muted-foreground/40 hover:text-primary transition-colors flex items-center gap-1 mx-auto">
          <RefreshCw className="w-2.5 h-2.5" /> Refresh cheat sheet
        </button>
      </div>
    </div>
  );
}

function HomeworkCard({ icon, label, title, subtitle, why, url, color, bgColor }: {
  icon: React.ReactNode; label: string; title: string; subtitle: string;
  why: string; url?: string; color: string; bgColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-xl border border-border ${bgColor} p-4 group hover:shadow-md transition-all`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold">{label}</span>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink className={`w-3.5 h-3.5 ${color}`} />
          </a>
        )}
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <h4 className={`text-sm font-black ${color} mb-0.5 hover:underline`}>{title}</h4>
      </a>
      {subtitle && <p className="text-[10px] text-muted-foreground mb-2">{subtitle}</p>}
      <p className="text-[11px] text-foreground/80 leading-relaxed">{why}</p>
    </motion.div>
  );
}

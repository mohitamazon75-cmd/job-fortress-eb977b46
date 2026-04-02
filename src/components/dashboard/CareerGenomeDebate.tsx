import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Sword, Scale, Zap, ExternalLink, Play, AlertTriangle, TrendingUp, TrendingDown, Minus, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type ScanReport } from '@/lib/scan-engine';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/lib/supabase-config';
import DOMPurify from 'dompurify';

// Sanitize config: only allow bold/italic formatting tags, no attributes that run JS
const SAFE_HTML_CONFIG: any = {
  ALLOWED_TAGS: ['strong', 'em', 'br', 'p'],
  ALLOWED_ATTR: ['class'],
};

function sanitizeMarkdown(raw: string): string {
  const withMarkdown = raw
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
  return DOMPurify.sanitize(withMarkdown, SAFE_HTML_CONFIG) as unknown as string;
}

// ── Types ───────────────────────────────────────────────────
interface AgentMessage {
  agent: 'Prosecutor' | 'Defender' | 'Judge';
  content: string;
  complete: boolean;
}

interface EvidenceItem {
  title: string;
  url: string;
  snippet: string;
  score: number;
  side?: 'prosecution' | 'defense';
}

interface DebateVerdict {
  threat_score: number;
  resilience_score: number;
  final_score: number;
  uncertainty: string;
  trajectory?: string;
  disagreement: number;
  evidence_triggered: boolean;
  role?: string;
}

type DebatePhase = 'idle' | 'prosecution' | 'defense' | 'evidence' | 'judgment' | 'complete' | 'error';

// ── Agent Config ────────────────────────────────────────────
const AGENT_CONFIG = {
  Prosecutor: {
    icon: Sword,
    label: 'Career Prosecutor',
    subtitle: 'Identifying every vulnerability',
    bgClass: 'bg-gradient-to-br from-red-500/8 via-red-500/4 to-transparent',
    borderClass: 'border-red-500/20',
    accentClass: 'text-red-600 dark:text-red-400',
    badgeBg: 'bg-red-500/10',
    dotClass: 'bg-red-500',
    ringColor: 'hsl(0, 72%, 51%)',
    avatar: '⚔️',
  },
  Defender: {
    icon: Shield,
    label: 'Career Defender',
    subtitle: 'Building your strategic moats',
    bgClass: 'bg-gradient-to-br from-emerald-500/8 via-emerald-500/4 to-transparent',
    borderClass: 'border-emerald-500/20',
    accentClass: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-500/10',
    dotClass: 'bg-emerald-500',
    ringColor: 'hsl(160, 84%, 39%)',
    avatar: '🛡️',
  },
  Judge: {
    icon: Scale,
    label: 'Impartial Judge',
    subtitle: 'Delivering the final verdict',
    bgClass: 'bg-gradient-to-br from-amber-500/8 via-amber-500/4 to-transparent',
    borderClass: 'border-amber-500/20',
    accentClass: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-500/10',
    dotClass: 'bg-amber-500',
    ringColor: 'hsl(38, 92%, 50%)',
    avatar: '⚖️',
  },
};

// ── Animated Score Ring ─────────────────────────────────────
function ScoreRing({ score, label, color, size = 100, delay = 0 }: { score: number; label: string; color: string; size?: number; delay?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-2 relative">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={center} cy={center} r={radius} stroke="hsl(var(--muted))" strokeWidth="5" fill="none" opacity="0.5" />
          <motion.circle
            cx={center} cy={center} r={radius}
            stroke={color}
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1], delay }}
            strokeDasharray={circumference}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-black text-foreground tabular-nums"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: delay + 0.8 }}
          >
            {score}
          </motion.span>
        </div>
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">{label}</span>
    </div>
  );
}

// ── Phase Progress Bar ──────────────────────────────────────
function PhaseProgress({ phase }: { phase: DebatePhase }) {
  const phases: DebatePhase[] = ['prosecution', 'defense', 'evidence', 'judgment', 'complete'];
  const labels = ['Prosecution', 'Defense', 'Evidence', 'Judgment', 'Verdict'];
  const currentIdx = phases.indexOf(phase);

  return (
    <div className="flex items-center gap-1 w-full">
      {phases.map((p, i) => {
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        const isEvidence = p === 'evidence';
        return (
          <div key={p} className={`flex-1 ${isEvidence && currentIdx < i ? 'opacity-30' : ''}`}>
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                className={`h-1.5 w-full rounded-full transition-colors duration-500 ${
                  isDone ? 'bg-primary' :
                  isActive ? 'bg-primary animate-pulse' :
                  'bg-muted'
                }`}
                layoutId={`phase-bar-${p}`}
              />
              <span className={`text-[11px] font-medium uppercase tracking-wider ${
                isActive ? 'text-foreground' : isDone ? 'text-primary' : 'text-muted-foreground/50'
              }`}>
                {labels[i]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Typing Indicator ────────────────────────────────────────
function TypingIndicator({ agent }: { agent: string }) {
  const cfg = AGENT_CONFIG[agent as keyof typeof AGENT_CONFIG];
  if (!cfg) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <span className="text-lg">{cfg.avatar}</span>
      <span className={`text-xs font-medium ${cfg.accentClass}`}>{cfg.label} is analyzing...</span>
      <div className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Format Agent Content ────────────────────────────────────
function FormatContent({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1.5" />;
        
        // Section headers (### or ## or bold **)
        if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
          return <h4 key={i} className="text-sm font-bold text-foreground mt-3 mb-1">{trimmed.replace(/^#{2,3}\s/, '')}</h4>;
        }
        
        // Exhibit headers
        if (trimmed.match(/^\*\*Exhibit\s+[A-E]/)) {
          return (
            <div key={i} className="mt-2 mb-0.5">
              <span className="text-sm font-bold text-foreground" dangerouslySetInnerHTML={{
                __html: sanitizeMarkdown(trimmed)
              }} />
            </div>
          );
        }

        // Score lines
        if (trimmed.match(/^(THREAT_SCORE|RESILIENCE_SCORE|FINAL_VERDICT_SCORE|UNCERTAINTY|TRAJECTORY):/)) {
          return null; // Hide raw scores, they're shown in the verdict UI
        }

        // Bold text
        if (trimmed.startsWith('**') || trimmed.match(/^\d+\.\s+\*\*/)) {
          return (
            <p key={i} className="text-sm text-foreground/90 leading-relaxed" dangerouslySetInnerHTML={{
              __html: sanitizeMarkdown(trimmed)
            }} />
          );
        }

        // Bullet points
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          return (
            <p key={i} className="text-sm text-foreground/80 leading-relaxed pl-3 border-l-2 border-border/50" dangerouslySetInnerHTML={{
              __html: sanitizeMarkdown(trimmed.slice(2))
            }} />
          );
        }

        return (
          <p key={i} className="text-sm text-foreground/80 leading-relaxed" dangerouslySetInnerHTML={{
            __html: sanitizeMarkdown(trimmed)
          }} />
        );
      })}
    </div>
  );
}

// ── Trajectory Badge ────────────────────────────────────────
function TrajectoryBadge({ trajectory }: { trajectory: string }) {
  const config = {
    ASCENDING: { icon: TrendingUp, label: 'Ascending', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    STABLE: { icon: Minus, label: 'Stable', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    DECLINING: { icon: TrendingDown, label: 'Declining', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    CRITICAL: { icon: AlertTriangle, label: 'Critical', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  }[trajectory] || { icon: Minus, label: trajectory, className: 'bg-muted text-muted-foreground border-border' };
  
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${config.className}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

// ── Main Component ──────────────────────────────────────────
export default function CareerGenomeDebate({ report, scanId }: { report: ScanReport; scanId: string }) {
  const [phase, setPhase] = useState<DebatePhase>('idle');
  const [phaseLabel, setPhaseLabel] = useState('');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [verdict, setVerdict] = useState<DebateVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const roleName = report.current_role || report.role || 'your career';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, evidence, phase]);

  const toggleAgent = useCallback((agent: string) => {
    setExpandedAgents(prev => ({ ...prev, [agent]: !prev[agent] }));
  }, []);

  const startDebate = useCallback(async () => {
    setPhase('prosecution');
    setMessages([]);
    setEvidence([]);
    setVerdict(null);
    setError(null);
    setExpandedAgents({});

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const url = `${SUPABASE_URL}/functions/v1/career-genome`;
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ report, scanId }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        if (resp.status === 402) setError('Credits exhausted. Please add credits in Settings → Workspace → Usage.');
        else if (resp.status === 429) setError('Rate limited. Please wait a moment and try again.');
        else setError(errData.error || `Analysis failed (${resp.status})`);
        setPhase('error');
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nlIdx: number;
        while ((nlIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, nlIdx);
          buffer = buffer.slice(nlIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const event = JSON.parse(jsonStr);
            switch (event.type) {
              case 'phase':
                setPhase(event.phase);
                setPhaseLabel(event.label);
                break;
              case 'agent_start':
                setMessages(prev => [...prev, { agent: event.agent, content: '', complete: false }]);
                break;
              case 'agent_token':
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.agent === event.agent && !last.complete) {
                    return [...prev.slice(0, -1), { ...last, content: last.content + event.token }];
                  }
                  return prev;
                });
                break;
              case 'agent_complete':
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.agent === event.agent) return [...prev.slice(0, -1), { ...last, complete: true }];
                  return prev;
                });
                break;
              case 'evidence':
                setEvidence(prev => [...prev, { title: event.title, url: event.url, snippet: event.snippet, score: event.score, side: event.side }]);
                break;
              case 'verdict':
                setVerdict(event);
                break;
              case 'done':
                setPhase('complete');
                break;
              case 'error':
                setError(event.message);
                setPhase('error');
                break;
              case 'agent_error':
                setMessages(prev => [...prev, { agent: event.agent, content: `⚠️ ${event.agent} encountered an error: ${event.error}`, complete: true }]);
                break;
            }
          } catch { /* partial JSON */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Connection failed');
        setPhase('error');
      }
    }
  }, [report, scanId]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Count completed agents for summary
  const completedMessages = useMemo(() => messages.filter(m => m.complete), [messages]);
  const activeMessage = useMemo(() => messages.find(m => !m.complete), [messages]);

  // ── Idle State — Courtroom Entrance ───────────────────────
  if (phase === 'idle') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border bg-card"
      >
        {/* Subtle courtroom pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `repeating-linear-gradient(90deg, hsl(var(--foreground)) 0px, transparent 1px, transparent 60px),
                           repeating-linear-gradient(0deg, hsl(var(--foreground)) 0px, transparent 1px, transparent 60px)`,
        }} />
        
        <div className="relative p-8 md:p-10 text-center space-y-8">
          {/* Agent Avatars */}
          <div className="flex justify-center items-end gap-3">
            {(['Prosecutor', 'Defender', 'Judge'] as const).map((agent, i) => {
              const cfg = AGENT_CONFIG[agent];
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={agent}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="flex flex-col items-center gap-2"
                >
                  <motion.div
                    whileHover={{ scale: 1.08, y: -4 }}
                    className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl ${cfg.bgClass} border ${cfg.borderClass} flex items-center justify-center shadow-sm`}
                  >
                    <Icon className={`w-7 h-7 md:w-8 md:h-8 ${cfg.accentClass}`} />
                  </motion.div>
                  <span className={`text-[10px] font-semibold ${cfg.accentClass} uppercase tracking-wider`}>
                    {agent}
                  </span>
                </motion.div>
              );
            })}
          </div>

          <div className="space-y-3 max-w-lg mx-auto">
            <h3 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
              Career Genome Sequencer
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Three AI agents will conduct an adversarial debate about <span className="font-semibold text-foreground">{roleName}</span>. 
              A Prosecutor attacks vulnerabilities, a Defender builds your moats, and a Judge delivers the verdict. 
              {' '}<span className="text-primary font-medium">When they disagree, live evidence is pulled from the web.</span>
            </p>
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={startDebate}
              size="lg"
              className="bg-foreground text-background hover:bg-foreground/90 font-bold px-10 py-6 text-base rounded-xl shadow-lg"
            >
              <Play className="w-5 h-5 mr-2" />
              Begin Adversarial Analysis
            </Button>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // ── Active/Complete State ─────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Phase Progress */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <PhaseProgress phase={phase} />
        
        <AnimatePresence mode="wait">
          {phase !== 'complete' && phase !== 'error' && (
            <motion.div
              key={phaseLabel}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex items-center justify-center gap-2 text-xs text-muted-foreground"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              {phaseLabel}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Debate Stream */}
      <div ref={scrollRef} className="space-y-4 max-h-[65vh] overflow-y-auto pr-1 scroll-smooth">
        <AnimatePresence initial={false}>
          {/* Completed agent cards — collapsible */}
          {completedMessages.map((msg, i) => {
            const cfg = AGENT_CONFIG[msg.agent];
            const Icon = cfg.icon;
            const isExpanded = expandedAgents[`${msg.agent}-${i}`] !== false; // default open
            const isLatestComplete = i === completedMessages.length - 1 && !activeMessage;

            return (
              <motion.div
                key={`${msg.agent}-${i}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={`rounded-xl border ${cfg.borderClass} ${cfg.bgClass} overflow-hidden`}
              >
                {/* Agent Header — always visible */}
                <button
                  onClick={() => toggleAgent(`${msg.agent}-${i}`)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-xl ${cfg.badgeBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${cfg.accentClass}`} />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className={`text-sm font-bold ${cfg.accentClass}`}>{cfg.label}</div>
                    <div className="text-[11px] text-muted-foreground">{cfg.subtitle}</div>
                  </div>
                  <span className={`text-[10px] font-semibold ${cfg.accentClass} ${cfg.badgeBg} px-2 py-0.5 rounded-full`}>
                    COMPLETE
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                
                {/* Collapsible content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0">
                        <div className="border-t border-border/30 pt-3">
                          <FormatContent content={msg.content} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {/* Active streaming agent */}
          {activeMessage && (
            <motion.div
              key={`active-${activeMessage.agent}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl border ${AGENT_CONFIG[activeMessage.agent].borderClass} ${AGENT_CONFIG[activeMessage.agent].bgClass} overflow-hidden`}
            >
              <div className="flex items-center gap-3 p-4 border-b border-border/20">
                <div className={`w-10 h-10 rounded-xl ${AGENT_CONFIG[activeMessage.agent].badgeBg} flex items-center justify-center`}>
                  {(() => { const Icon = AGENT_CONFIG[activeMessage.agent].icon; return <Icon className={`w-5 h-5 ${AGENT_CONFIG[activeMessage.agent].accentClass}`} />; })()}
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-bold ${AGENT_CONFIG[activeMessage.agent].accentClass}`}>
                    {AGENT_CONFIG[activeMessage.agent].label}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{AGENT_CONFIG[activeMessage.agent].subtitle}</div>
                </div>
                <div className="flex gap-0.5">
                  {[0, 1, 2].map(j => (
                    <motion.div
                      key={j}
                      className={`w-1.5 h-1.5 rounded-full ${AGENT_CONFIG[activeMessage.agent].dotClass}`}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: j * 0.2 }}
                    />
                  ))}
                </div>
              </div>
              <div className="p-4">
                <FormatContent content={activeMessage.content} />
                <span className="inline-block w-2 h-4 bg-foreground/60 animate-pulse ml-0.5 rounded-sm" />
              </div>
            </motion.div>
          )}

          {/* Typing indicator when transitioning */}
          {!activeMessage && phase !== 'complete' && phase !== 'error' && phase !== 'evidence' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <TypingIndicator agent={phase === 'prosecution' ? 'Prosecutor' : phase === 'defense' ? 'Defender' : 'Judge'} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Evidence Cards */}
        {evidence.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent p-5 space-y-3"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">Live Evidence Collected</span>
                <p className="text-[10px] text-muted-foreground">Real-time web intelligence to resolve agent disagreement</p>
              </div>
            </div>
            <div className="grid gap-2">
              {evidence.map((ev, i) => (
                <motion.a
                  key={i}
                  href={ev.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="block rounded-lg bg-card border border-border/50 p-3 hover:border-blue-500/30 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
                      ev.side === 'prosecution' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
                    }`}>
                      {ev.side === 'prosecution' ? 'P' : 'D'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground group-hover:text-blue-600 transition-colors line-clamp-1">{ev.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{ev.snippet}</p>
                    </div>
                    <ExternalLink className="w-3 h-3 text-muted-foreground/50 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-0.5" />
                  </div>
                </motion.a>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* ═══ VERDICT DASHBOARD ═══ */}
      {verdict && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-border bg-card overflow-hidden"
        >
          {/* Verdict Header */}
          <div className="p-6 pb-0 text-center space-y-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="text-3xl"
            >
              ⚖️
            </motion.div>
            <h4 className="text-lg font-black text-foreground tracking-tight">Final Verdict</h4>
            {verdict.role && (
              <p className="text-xs text-muted-foreground">Analysis for <span className="font-semibold text-foreground">{verdict.role}</span></p>
            )}
          </div>

          {/* Score Triad */}
          <div className="flex justify-center items-start gap-6 md:gap-10 p-6">
            <ScoreRing score={verdict.threat_score} label="Threat" color={AGENT_CONFIG.Prosecutor.ringColor} delay={0} />
            <div className="pt-0">
              <ScoreRing score={verdict.final_score} label="Verdict" color={AGENT_CONFIG.Judge.ringColor} size={120} delay={0.3} />
            </div>
            <ScoreRing score={verdict.resilience_score} label="Resilience" color={AGENT_CONFIG.Defender.ringColor} delay={0.15} />
          </div>

          {/* Plain-English Explainer */}
          <div className="mx-6 mb-2 rounded-xl bg-muted/50 border border-border/50 p-4 space-y-2">
            <p className="text-xs text-foreground/70 leading-relaxed">
              <span className="font-bold text-foreground">Threat ({verdict.threat_score}/100)</span> — how much of your role AI can already do. Higher = more exposed.
            </p>
            <p className="text-xs text-foreground/70 leading-relaxed">
              <span className="font-bold text-foreground">Resilience ({verdict.resilience_score}/100)</span> — how strong your defenses are. Higher = harder to replace.
            </p>
            <p className="text-xs text-foreground/70 leading-relaxed">
              <span className="font-bold text-foreground">Verdict ({verdict.final_score}/100)</span> — the overall picture after weighing both sides. Higher = safer position.
            </p>
          </div>

          {/* Trajectory + Uncertainty Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 px-6 pb-4">
            {verdict.trajectory && <TrajectoryBadge trajectory={verdict.trajectory} />}
            
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
              verdict.uncertainty === 'HIGH' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
              verdict.uncertainty === 'MEDIUM' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
              'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
            }`}>
              {verdict.uncertainty === 'HIGH' && <AlertTriangle className="w-3 h-3" />}
              {verdict.uncertainty} CONFIDENCE
            </span>

            {verdict.evidence_triggered && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                <Zap className="w-3 h-3" />
                EVIDENCE DEPLOYED
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-3 px-6 pb-6 pt-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setPhase('idle'); }}
              className="gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Run Again
            </Button>
          </div>
        </motion.div>
      )}

      {/* Error State */}
      {phase === 'error' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3"
        >
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-sm text-destructive font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={() => setPhase('idle')}>
            Try Again
          </Button>
        </motion.div>
      )}
    </div>
  );
}

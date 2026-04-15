import { motion } from "framer-motion";
import { Brain, User, Calculator, TrendingUp, Zap, Check, Shield } from "lucide-react";
import { useEffect, useState, useRef, useMemo } from "react";

/* ── Single timeline drives everything ── */
const PHASES = [
  {
    id: 'profiler',
    name: 'Profile Extraction',
    desc: 'Mapping your skills, tasks & career signals',
    icon: User,
    durationSec: 15,
    lines: [
      "> Ingesting profile data...",
      "> Mapping role to Knowledge Graph (2,400+ occupations)...",
      "> Matching skills against 94 vulnerability vectors...",
      "> Cross-referencing 156,000 Indian professional profiles...",
      "> Profile extraction complete.",
    ],
  },
  {
    id: 'engine',
    name: 'Risk Computation',
    desc: '48 deterministic algorithms scoring your position',
    icon: Calculator,
    durationSec: 25,
    lines: [
      "> Running deterministic calculation engine (48 algorithms)...",
      "> Applying seniority & industry modifiers...",
      "> Computing Career Position Score...",
      "> Calculating obsolescence timeline...",
      "> Risk computation complete.",
    ],
  },
  {
    id: 'strategist',
    name: 'Strategy Builder',
    desc: 'Building defense strategies & action plan',
    icon: TrendingUp,
    durationSec: 30,
    lines: [
      "> Building defense strategy with AI agents...",
      "> Generating career strategy with AI...",
      "> Modelling skill-gap closure projections...",
      "> Strategy generation complete.",
    ],
  },
  {
    id: 'enrichment',
    name: 'Market Intelligence',
    desc: 'Fetching real-time market intel & signals',
    icon: Zap,
    durationSec: 20,
    lines: [
      "> Fetching live market intelligence...",
      "> Scanning job postings for your role cluster...",
      "> Checking GCC/captive center hiring trends...",
      "> SCAN COMPLETE. Rendering results...",
    ],
  },
];

const TOTAL_PHASE_DURATION = PHASES.reduce((s, p) => s + p.durationSec, 0); // 90s

const TRUST_MESSAGES = [
  { threshold: 0, text: "Analysing your unique career fingerprint", sub: "Every scan is personalised to your exact profile" },
  { threshold: 20, text: "Running 48 deterministic algorithms", sub: "Every score is reproducible & auditable" },
  { threshold: 40, text: "Cross-referencing live market data", sub: "Job postings, salary trends & AI adoption signals" },
  { threshold: 60, text: "Building your personalized defense plan", sub: "Actionable strategies, not generic advice" },
  { threshold: 80, text: "Final quality checks", sub: "Ensuring accuracy before your report lands" },
];

interface Props {
  role: string;
}

export default function RiskIQAnalyzing({ role }: Props) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Single clock
  useEffect(() => {
    const timer = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Derive active phase, progress, completed phases from elapsed time
  const { activePhaseIndex, phaseProgress, overallProgress } = useMemo(() => {
    let cumulative = 0;
    for (let i = 0; i < PHASES.length; i++) {
      const phaseEnd = cumulative + PHASES[i].durationSec;
      if (elapsedSec < phaseEnd) {
        const elapsed = elapsedSec - cumulative;
        const phaseProg = Math.min(95, (elapsed / PHASES[i].durationSec) * 100);
        const overall = Math.min(95, ((cumulative + elapsed) / TOTAL_PHASE_DURATION) * 95);
        return { activePhaseIndex: i, phaseProgress: phaseProg, overallProgress: Math.round(overall) };
      }
      cumulative = phaseEnd;
    }
    // Past all phases — hold at 95-99%, cycling
    const cyclePos = ((elapsedSec - TOTAL_PHASE_DURATION) % 20) / 20;
    return { activePhaseIndex: PHASES.length - 1, phaseProgress: 90 + cyclePos * 9, overallProgress: Math.min(99, 95 + Math.round(cyclePos * 4)) };
  }, [elapsedSec]);

  // Emit terminal lines in sync with phases
  useEffect(() => {
    let cumulative = 0;
    const allScheduled: { time: number; line: string }[] = [];
    
    for (const phase of PHASES) {
      const lineInterval = phase.durationSec / (phase.lines.length);
      phase.lines.forEach((line, li) => {
        allScheduled.push({ time: cumulative + li * lineInterval, line });
      });
      cumulative += phase.durationSec;
    }

    const linesToShow = allScheduled
      .filter(s => s.time <= elapsedSec)
      .map(s => s.line);

    // After all phases, cycle enrichment lines
    if (elapsedSec > TOTAL_PHASE_DURATION) {
      const extras = [
        "> Verifying data integrity...",
        "> Cross-validating market signals...",
        "> Finalizing report structure...",
        "> Almost there...",
      ];
      const cycleIdx = Math.floor((elapsedSec - TOTAL_PHASE_DURATION) / 5) % extras.length;
      const extra = extras[cycleIdx];
      if (!linesToShow.includes(extra)) linesToShow.push(extra);
    }

    setVisibleLines(linesToShow.slice(-8));
  }, [elapsedSec]);

  // Auto-scroll terminal
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [visibleLines]);

  // Current trust message
  const trustMsg = useMemo(() => {
    let msg = TRUST_MESSAGES[0];
    for (const t of TRUST_MESSAGES) {
      if (overallProgress >= t.threshold) msg = t;
    }
    return msg;
  }, [overallProgress]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 dot-pattern opacity-20" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-2xl z-10"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <Shield className="w-7 h-7 text-primary-foreground" />
          </motion.div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Deep Career Analysis</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Analysing <strong className="text-foreground">{role}</strong>
          </p>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/20 bg-primary/5"
          >
            <span className="text-sm">⏱️</span>
            <p className="text-sm text-foreground font-semibold">
              Takes 2–3 minutes.{' '}
              <span className="text-muted-foreground font-normal">You can leave — results will be here when you return.</span>
            </p>
          </motion.div>
        </div>

        {/* Agent Pipeline — synced to elapsed time */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
          {PHASES.map((phase, i) => {
            const Icon = phase.icon;
            const isDone = i < activePhaseIndex || (i === activePhaseIndex && phaseProgress >= 99);
            const isActive = i === activePhaseIndex && !isDone;
            const isPending = i > activePhaseIndex;

            return (
              <motion.div
                key={phase.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative p-3 md:p-4 rounded-xl border-2 text-center transition-all duration-500 ${
                  isActive
                    ? 'border-primary bg-primary/5 shadow-md'
                    : isDone
                    ? 'border-prophet-green/30 bg-prophet-green/[0.03]'
                    : 'border-border bg-card opacity-40'
                }`}
              >
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-xl"
                    animate={{ boxShadow: ['0 0 0 0 hsl(221 83% 53% / 0)', '0 0 0 4px hsl(221 83% 53% / 0.1)', '0 0 0 0 hsl(221 83% 53% / 0)'] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg mx-auto mb-2 flex items-center justify-center ${
                  isActive ? 'bg-primary/10' : isDone ? 'bg-prophet-green/10' : 'bg-muted'
                }`}>
                  {isDone ? (
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-prophet-green" />
                  ) : (
                    <Icon className={`w-4 h-4 md:w-5 md:h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  )}
                </div>
                <p className={`text-xs font-bold ${isActive ? 'text-primary' : isDone ? 'text-prophet-green' : 'text-muted-foreground'}`}>
                  {phase.name}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 hidden md:block leading-tight">{phase.desc}</p>
                {isActive && (
                  <div className="mt-2 h-1 rounded-full bg-primary/20 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'var(--gradient-primary)', width: `${phaseProgress}%` }}
                      transition={{ ease: 'linear', duration: 0.5 }}
                    />
                  </div>
                )}
                {isDone && (
                  <div className="mt-2 h-1 rounded-full bg-prophet-green/30 overflow-hidden">
                    <div className="h-full w-full rounded-full bg-prophet-green/60" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Connector dots */}
        <div className="hidden md:flex items-center justify-center gap-0 mb-4 px-6">
          {PHASES.slice(0, -1).map((_, i) => (
            <div key={i} className="flex-1 flex items-center">
              <div className={`flex-1 h-0.5 ${i < activePhaseIndex ? 'bg-prophet-green/40' : 'bg-border'} transition-colors duration-500`} />
              <div className={`w-1.5 h-1.5 rounded-full ${i < activePhaseIndex ? 'bg-prophet-green' : 'bg-border'} transition-colors duration-500`} />
              <div className={`flex-1 h-0.5 ${i < activePhaseIndex ? 'bg-prophet-green/40' : 'bg-border'} transition-colors duration-500`} />
            </div>
          ))}
        </div>

        {/* Terminal */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg mb-6">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/50">
            <div className="w-3 h-3 rounded-full bg-prophet-red/60" />
            <div className="w-3 h-3 rounded-full bg-prophet-gold/60" />
            <div className="w-3 h-3 rounded-full bg-prophet-green/60" />
            <span className="text-xs font-mono text-muted-foreground ml-2">riskiq-engine</span>
          </div>
          <div
            ref={containerRef}
            className="p-3 sm:p-4 h-36 sm:h-44 overflow-y-auto font-mono text-[10px] sm:text-xs space-y-1"
          >
            {visibleLines.map((line, i) => (
              <motion.div
                key={`${i}-${line}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={
                  line.includes('COMPLETE') ? 'text-prophet-green font-bold' :
                  line.includes('complete') ? 'text-prophet-green' :
                  'text-muted-foreground'
                }
              >
                {line}
              </motion.div>
            ))}
            <span className="inline-block w-2 h-4 bg-primary animate-pulse" />
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--gradient-primary)' }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ ease: 'linear', duration: 0.8 }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground font-mono">{elapsedSec}s elapsed</p>
          <p className="text-sm font-bold text-foreground">{overallProgress}%</p>
        </div>

        {/* Trust messaging — synced to progress */}
        <motion.div
          key={trustMsg.text}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 text-center space-y-1"
        >
          <p className="text-sm font-bold text-foreground">{trustMsg.text}</p>
          <p className="text-xs text-muted-foreground">{trustMsg.sub}</p>
        </motion.div>

        {elapsedSec > 90 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-xs text-muted-foreground/70 mt-3"
          >
            Complex profile — running extended analysis. Almost there...
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

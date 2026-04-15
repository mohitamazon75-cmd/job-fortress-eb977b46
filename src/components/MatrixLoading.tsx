import { motion } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { User, Calculator, TrendingUp, Zap, Check } from 'lucide-react';

const LOADING_MESSAGES = [
  "Matching your profile against 98 role archetypes...",
  "Running your skills through our obsolescence engine...",
  "Checking how your role ranks against 50,000+ Indian professionals...",
  "Calculating your salary bleed rate at current AI adoption pace...",
  "Mapping your cognitive moats — skills AI can't replicate...",
  "Almost done — building your personalized defense plan...",
];

const AGENTS = [
  { id: 'profiler', name: 'Profile Extraction', desc: 'Extracting skills, tasks & career signals', icon: User, lines: [0, 5] },
  { id: 'engine', name: 'Risk Computation', desc: 'Computing risk scores from KG data', icon: Calculator, lines: [6, 11] },
  { id: 'strategist', name: 'Strategy Builder', desc: 'Building defense strategies & action plan', icon: TrendingUp, lines: [12, 14] },
  { id: 'enrichment', name: 'Market Intelligence', desc: 'Fetching real-time market intel', icon: Zap, lines: [15, 16] },
];

const TERMINAL_LINES = [
  // Profile Extraction (lines 0-5) — ~15s
  "> Ingesting profile data...",
  "> Mapping role to Knowledge Graph (98 role archetypes)...",
  "> Matching skills against 30 skill categories & 98 role archetypes...",
  "> Cross-referencing O*NET & ISCO-08 taxonomy...",
  "> Querying live job market data for your role...",
  "> Profile extraction complete.",
  // Risk Computation (lines 6-11) — ~24s
  "> Running deterministic calculation engine (48 algorithms)...",
  "> Applying seniority & industry modifiers...",
  "> Computing Career Position Score across 5 factors...",
  "> Benchmarking against 2,400+ role-skill entries...",
  "> Calculating obsolescence timeline...",
  "> Risk computation complete.",
  // Strategy Builder (lines 12-14) — ~18s
  "> Building defense strategy with AI agents...",
  "> Generating judo moves & skill upgrade paths...",
  "> Mapping career pivot adjacencies...",
  // Market Intelligence (lines 15-16) — ~6s
  "> Fetching live market intelligence from 6 sources...",
  "> Integrating salary & demand signals...",
];

interface MatrixLoadingProps {
  onComplete: () => void;
  scanReady?: boolean;
  seniorityTier?: string | null;
  scanId?: string;
}

const MatrixLoading = ({ onComplete, scanReady, seniorityTier, scanId }: MatrixLoadingProps) => {
  const [lines, setLines] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeAgentIndex = AGENTS.findIndex(
    (a) => currentLineIndex >= a.lines[0] && currentLineIndex <= a.lines[1]
  );

  // Elapsed timer
  useEffect(() => {
    const timer = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Rotating loading messages every 12 seconds
  useEffect(() => {
    const messageRotation = setInterval(() => {
      setCurrentMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 12000);
    return () => clearInterval(messageRotation);
  }, []);

  // Terminal lines — paced to ~60s total instead of 8s
  // Lines appear faster at start, slower toward end
  useEffect(() => {
    let lineIndex = 0;
    const getDelay = (idx: number) => {
      if (idx < 6) return 2500;    // Profile extraction: ~15s
      if (idx < 12) return 4000;   // Risk computation: ~24s
      if (idx < 15) return 6000;   // Strategy builder: ~18s
      return 3000;                 // Market intelligence
    };

    const addLine = () => {
      if (lineIndex < TERMINAL_LINES.length) {
        setLines(prev => [...prev, TERMINAL_LINES[lineIndex]]);
        setCurrentLineIndex(lineIndex);
        lineIndex++;
        // Cap progress at 85% — only scanReady pushes to 100%
        const rawProgress = Math.round((lineIndex / TERMINAL_LINES.length) * 85);
        setProgress(rawProgress);
        setTimeout(addLine, getDelay(lineIndex));
      }
    };

    setTimeout(addLine, 1500); // Initial delay
    // No cleanup needed — lineIndex naturally stops
  }, []);

  // Smooth progress from 85% → 95% while waiting for scan
  useEffect(() => {
    if (progress >= 85 && !scanReady) {
      const crawl = setInterval(() => {
        setProgress(p => Math.min(p + 1, 95));
      }, 5000); // +1% every 5s
      return () => clearInterval(crawl);
    }
  }, [progress, scanReady]);

  // When scan is ready, add final line, jump to 100% and complete
  const completedRef = useRef(false);
  useEffect(() => {
    if (scanReady && !completedRef.current) {
      setLines(prev => [...prev, "> ✅ ANALYSIS COMPLETE — Rendering your results..."]);
      setProgress(100);
      completedRef.current = true;
      setTimeout(onComplete, 1200);
    }
  }, [scanReady, onComplete]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  // Extended wait phase messages
  const getWaitMessage = () => {
    if (elapsedSec >= 150) {
      return {
        title: "Still crunching — your analysis is complex",
        subtitle: "You can safely close this tab and come back in 2-3 minutes. Your results will be ready.",
        showLeaveHint: true,
      };
    }
    if (elapsedSec >= 90) {
      return {
        title: "Deep analysis in progress — hang tight",
        subtitle: "Our system is running thousands of calculations, integrating live market data, and simulating career scenarios. Complex profiles take longer — quality over speed.",
        showLeaveHint: true,
      };
    }
    if (elapsedSec >= 45) {
      return {
        title: "Analysis in progress…",
        subtitle: LOADING_MESSAGES[currentMessageIndex],
        showLeaveHint: false,
      };
    }
    return {
      title: "Analysis in progress…",
      subtitle: LOADING_MESSAGES[currentMessageIndex],
      showLeaveHint: false,
    };
  };

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
            <span className="text-primary-foreground font-black text-xl">AI</span>
          </motion.div>
          <h2 className="text-2xl font-black text-foreground">Deep Career Analysis</h2>
          <p className="text-sm text-muted-foreground mt-1">4 AI agents + deterministic engine + live market data</p>
        </div>

        {/* Agent Pipeline — mapped to actual stages */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 mb-4 sm:mb-6">
          {AGENTS.map((agent, i) => {
            const Icon = agent.icon;
            const isDone = currentLineIndex > agent.lines[1];
            const isActive = i === activeAgentIndex;

            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative p-3 md:p-4 rounded-xl border-2 text-center transition-all duration-500 ${
                  isActive
                    ? 'border-primary bg-primary/5 shadow-md'
                    : isDone
                    ? 'border-prophet-green/30 bg-prophet-green/[0.03]'
                    : 'border-border bg-card opacity-50'
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
                  {agent.name}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 hidden md:block leading-tight">{agent.desc}</p>
                {isActive && (
                  <motion.div
                    className="mt-2 h-1 rounded-full bg-primary/20 overflow-hidden"
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'var(--gradient-primary)' }}
                      animate={{ width: ['10%', '90%'] }}
                      transition={{ duration: (agent.lines[1] - agent.lines[0] + 1) * 0.6, ease: 'linear' }}
                    />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Connector lines between stages */}
        <div className="hidden md:flex items-center justify-center gap-0 -mt-4 mb-4 px-6">
          {AGENTS.slice(0, -1).map((agent, i) => (
            <div key={i} className="flex-1 flex items-center">
              <div className={`flex-1 h-0.5 ${currentLineIndex > agent.lines[1] ? 'bg-prophet-green/40' : 'bg-border'} transition-colors duration-500`} />
              <div className={`w-1.5 h-1.5 rounded-full ${currentLineIndex > agent.lines[1] ? 'bg-prophet-green' : 'bg-border'} transition-colors duration-500`} />
              <div className={`flex-1 h-0.5 ${currentLineIndex > agent.lines[1] ? 'bg-prophet-green/40' : 'bg-border'} transition-colors duration-500`} />
            </div>
          ))}
        </div>

        {/* Terminal */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg mb-6">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/50">
            <div className="w-3 h-3 rounded-full bg-prophet-red/60" />
            <div className="w-3 h-3 rounded-full bg-prophet-gold/60" />
            <div className="w-3 h-3 rounded-full bg-prophet-green/60" />
            <span className="text-xs font-mono text-muted-foreground ml-2">job-bachao-scanner</span>
          </div>
          <div
            ref={containerRef}
            className="p-3 sm:p-4 h-36 sm:h-48 overflow-y-auto font-mono text-[10px] sm:text-xs space-y-1"
          >
            {lines.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`${
                  !line ? 'text-muted-foreground' :
                  line.includes('COMPLETE') ? 'text-prophet-green font-bold' :
                  line.includes('complete') || line.includes('calculated') || line.includes('generated') ? 'text-prophet-green' :
                  'text-muted-foreground'
                }`}
              >
                {line}
              </motion.div>
            ))}
            {lines.length < TERMINAL_LINES.length && (
              <span className="inline-block w-2 h-4 bg-primary animate-pulse" />
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ width: `${progress}%`, background: 'var(--gradient-primary)' }}
            transition={{ ease: 'linear' }}
          />
        </div>
        <p className="text-center text-sm text-muted-foreground font-medium mt-2">
          {progress >= 100 ? 'Analysis complete!' : progress >= 85 ? `${progress}% — Finalizing deep analysis...` : `${progress}%`}
        </p>

        {/* Waiting indicator after terminal animation finishes */}
        {progress >= 85 && !scanReady && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 text-center space-y-3"
          >
            {(() => {
              const msg = getWaitMessage();
              return (
                <>
                  <div className="flex items-center justify-center gap-2">
                    <motion.span
                      className="w-2 h-2 rounded-full bg-primary"
                      animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <p className="text-sm font-bold text-foreground">
                      {msg.title}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                    {msg.subtitle}
                  </p>
                  {elapsedSec >= 20 && (
                    <p className="text-[11px] text-muted-foreground/40">
                      {Math.floor(elapsedSec / 60) > 0 ? `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s elapsed` : `${elapsedSec}s elapsed`}
                    </p>
                  )}
                  {msg.showLeaveHint && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 px-4 py-3 rounded-xl border border-primary/20 bg-primary/5 max-w-sm mx-auto"
                    >
                      <p className="text-xs font-semibold text-primary flex items-start gap-2 text-left">
                        <span className="flex-shrink-0 mt-0.5">💡</span>
                        You can safely close this tab and come back — your results will be waiting.
                      </p>
                    </motion.div>
                  )}
                </>
              );
            })()}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default MatrixLoading;

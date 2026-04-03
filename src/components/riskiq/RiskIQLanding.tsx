import { motion } from "framer-motion";
import {
  ArrowRight, Shield, Brain, Zap, Target, AlertTriangle, BarChart3,
  Radar, Sparkles, Users, TrendingDown, Clock, Activity
} from "lucide-react";

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } } };

function GridBG() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% -20%, hsl(var(--primary) / 0.08) 0%, transparent 60%)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 80% 90%, hsl(var(--prophet-red) / 0.04) 0%, transparent 50%)" }} />
      <motion.div
        className="absolute left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.2), transparent)" }}
        animate={{ top: ["-5%", "105%"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />
      <div className="absolute inset-0 dot-pattern opacity-[0.12]" />
    </div>
  );
}

function StatPill({ icon, value, label, delay }: { icon: React.ReactNode; value: string; label: string; delay?: number }) {
  return (
    <motion.div
      variants={fadeUp}
      className="flex items-center gap-3 rounded-xl border border-border bg-card/70 backdrop-blur-sm px-4 py-3.5"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-base font-black text-foreground leading-tight">{value}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">{label}</div>
      </div>
    </motion.div>
  );
}

// Scrolling ticker of disruption stats
function DisruptionTicker() {
  const items = [
    "Goldman Sachs: 300M jobs impacted by AI globally",
    "McKinsey: 30% of work hours automatable by 2030",
    "WEF: 83M jobs displaced by 2027",
    "OpenAI: 80% of workers will see 10%+ tasks affected",
    "IMF: 60% of jobs in advanced economies exposed to AI",
    "Anthropic: Coding productivity up 2x with AI assistants",
  ];
  return (
    <div className="relative overflow-hidden border-y border-border/50 bg-foreground/[0.02] py-3">
      <div className="animate-ticker flex whitespace-nowrap gap-12">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="text-[11px] text-muted-foreground/60 flex items-center gap-2">
            <Activity className="w-3 h-3 text-destructive/50" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

interface Props {
  onStart: () => void;
}

export default function RiskIQLanding({ onStart }: Props) {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-background">
      <GridBG />

      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex items-center justify-between px-5 sm:px-8 py-4 border-b border-border/40 backdrop-blur-sm bg-background/80"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-foreground flex items-center justify-center">
            <Radar className="w-4.5 h-4.5 text-prophet-gold" />
          </div>
          <div>
            <span className="font-black text-foreground tracking-tight text-sm">RiskIQ</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-prophet-gold/15 text-prophet-gold border border-prophet-gold/20 ml-2">
              ADVANCED BETA
            </span>
          </div>
        </div>
        <a href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
          ← Main app
        </a>
      </motion.nav>

      {/* Disruption ticker */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
        <DisruptionTicker />
      </motion.div>

      {/* Hero */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-5 py-12 sm:py-20">
        <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-2xl w-full">
          {/* Split layout */}
          <div className="text-center">
            {/* Eyebrow */}
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full border border-border bg-card/50 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-prophet-green opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-prophet-green" />
              </span>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                12-Dimensional Career Intelligence Engine
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1 variants={fadeUp} className="text-3xl sm:text-5xl md:text-[3.5rem] font-black text-foreground leading-[1.08] tracking-tight mb-6">
              Will AI Replace You?{" "}
              <span className="block sm:inline">
                <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-threatened)" }}>
                  Find Out Before
                </span>
              </span>
              <span className="block">Your Boss Does.</span>
            </motion.h1>

            {/* Sub */}
            <motion.p variants={fadeUp} className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto mb-4">
              Get your <strong className="text-foreground">precision risk score</strong>, doomsday date,
              12-dimensional breakdown, AI threat map, and survival roadmap — in <strong className="text-foreground">90 seconds</strong>.
            </motion.p>

            <motion.p variants={fadeUp} className="text-xs text-muted-foreground/70 mb-10 max-w-md mx-auto">
              Powered by a Knowledge Graph of 25 roles × 30 skills × 10 AI threats — enriched by multi-model reasoning ensemble + live market signals. Not a quiz. Not vibes. Math.
            </motion.p>

            {/* Proof grid */}
            <motion.div variants={stagger} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-10">
              <StatPill icon={<Brain className="w-4.5 h-4.5" />} value="25" label="KG Roles" />
              <StatPill icon={<BarChart3 className="w-4.5 h-4.5" />} value="12" label="Dimensions" />
              <StatPill icon={<AlertTriangle className="w-4.5 h-4.5" />} value="10" label="AI Threat Vectors" />
              <StatPill icon={<Zap className="w-4.5 h-4.5" />} value="< 90s" label="Deep Analysis" />
            </motion.div>

            {/* CTA */}
            <motion.div variants={fadeUp} className="space-y-3">
              <button
                onClick={onStart}
                className="group relative w-full sm:w-auto sm:px-16 py-4.5 rounded-xl bg-foreground text-background font-black text-base transition-all hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0"
                style={{ boxShadow: "0 8px 32px hsl(var(--foreground) / 0.3)" }}
              >
                Scan My Career Risk — Free
                <ArrowRight className="inline-block ml-2.5 w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
              <p className="text-xs text-muted-foreground/60">
                No account · No email · No data stored · 100% free
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Social proof strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="relative z-10 border-t border-border/40 bg-muted/20 backdrop-blur-sm py-5 px-6"
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-[11px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-prophet-green" /> Zero-hallucination engine</span>
            <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary" /> Multi-model AI fusion</span>
            <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-prophet-gold" /> Role-specific intelligence</span>
            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-muted-foreground" /> Oxford · McKinsey · O*NET data</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

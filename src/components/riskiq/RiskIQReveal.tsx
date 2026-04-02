import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { RiskIQResult } from "./RiskIQTypes";
import { getTierColor, getTierHsl } from "./RiskIQTypes";

interface Props {
  result: RiskIQResult;
  onContinue: () => void;
}

/**
 * Full-screen dramatic score reveal — Shock phase of Shock-to-Action UX.
 * Shows score counting up, headline, then CTA to dashboard.
 */
export default function RiskIQReveal({ result, onContinue }: Props) {
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<"counting" | "headline" | "ready">("counting");

  useEffect(() => {
    const target = result.risk_score;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(interval);
        setTimeout(() => setPhase("headline"), 400);
        setTimeout(() => setPhase("ready"), 1800);
      } else {
        setCount(Math.round(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [result.risk_score]);

  const tierColor = getTierColor(result.risk_tier);
  const hsl = getTierHsl(result.risk_tier);

  return (
    <div className="min-h-screen bg-foreground flex items-center justify-center px-5 relative overflow-hidden">
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse at 50% 40%, hsl(${hsl} / 0.15) 0%, transparent 60%)`,
      }} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative z-10 max-w-md w-full text-center"
      >
        {/* Score */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-background/50 mb-4">
            AI Displacement Risk Score
          </p>
          <div className="text-[120px] sm:text-[140px] font-black leading-none text-background" style={{ fontFeatureSettings: "'tnum'" }}>
            {count}
          </div>
          <div className="flex items-center justify-center gap-3 mt-2">
            <span className="text-sm text-background/40">/100</span>
            <span className={`text-sm font-black px-3 py-1 rounded-full border ${
              result.risk_tier === "Critical" || result.risk_tier === "High"
                ? "bg-red-500/20 border-red-500/30 text-red-400"
                : result.risk_tier === "Moderate"
                ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-400"
                : "bg-green-500/20 border-green-500/30 text-green-400"
            }`}>
              {result.risk_tier} Risk
            </span>
          </div>
        </motion.div>

        {/* Headline */}
        <AnimatePresence>
          {(phase === "headline" || phase === "ready") && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8"
            >
              <p className="text-lg sm:text-xl text-background/70 italic leading-relaxed max-w-sm mx-auto">
                "{result.headline || result.viral.share_headline}"
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Teaser stats */}
        <AnimatePresence>
          {phase === "ready" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="rounded-lg bg-background/5 border border-background/10 p-3">
                  <div className="text-2xl font-black text-background">{result.viral.doomsday_days}</div>
                   <div className="text-[10px] uppercase tracking-widest text-background/40 font-bold">Days left</div>
                 </div>
                 <div className="rounded-lg bg-background/5 border border-background/10 p-3">
                   <div className="text-2xl font-black text-background">{result.viral.survival_rating}</div>
                   <div className="text-[10px] uppercase tracking-widest text-background/40 font-bold">Rating</div>
                 </div>
                 <div className="rounded-lg bg-background/5 border border-background/10 p-3">
                   <div className="text-2xl font-black text-background">{result.peer_comparison.percentile}%</div>
                   <div className="text-[10px] uppercase tracking-widest text-background/40 font-bold">Safer than</div>
                </div>
              </div>

              <button
                onClick={onContinue}
                className="group w-full py-4 rounded-xl bg-background text-foreground font-black text-base transition-all hover:shadow-2xl hover:-translate-y-0.5"
              >
                See Your Full Report
                <ArrowRight className="inline-block ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

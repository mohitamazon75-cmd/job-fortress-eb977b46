import { motion } from "framer-motion";

const BENEFITS = [
  { emoji: "✅", text: "Takes just 10 seconds per day" },
  { emoji: "✅", text: "No images or video are ever stored" },
  { emoji: "✅", text: "See your child's weekly mood trends" },
];

export default function BetaWelcomeScreen({ onGetStarted }) {
  return (
    <div className="min-h-screen gradient-mesh flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col items-center text-center">

        {/* Big emoji */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="text-6xl mb-6 select-none"
          aria-hidden="true"
        >
          💚
        </motion.div>

        {/* Heading + BETA badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col items-center gap-2 mb-8"
        >
          <h1 className="font-display text-[28px] font-bold leading-tight text-foreground">
            Daily Wellness<br />Check-In
          </h1>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-amber-100 text-amber-700 border border-amber-300">
            BETA FEATURE
          </span>
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-strong rounded-2xl border border-border shadow-premium w-full px-6 py-5 mb-6 text-left"
        >
          <ul className="space-y-3">
            {BENEFITS.map(({ emoji, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm font-medium text-foreground">
                <span className="text-base leading-none select-none" aria-hidden="true">{emoji}</span>
                {text}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Privacy note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-[11px] text-muted-foreground leading-relaxed mb-8 px-2"
        >
          PulseCheck uses on-device face detection to read facial expressions.
          No photos are saved. Scores are wellness indicators, not medical diagnoses.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full flex flex-col items-center gap-2"
        >
          <button
            onClick={onGetStarted}
            className="w-full relative overflow-hidden rounded-2xl text-[17px] font-semibold py-5 gradient-hero text-primary-foreground shadow-glow-primary hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-300"
          >
            <span className="relative z-10">Set Up My Child →</span>
            <div className="absolute inset-0 shimmer" />
          </button>
          <p className="text-[11px] text-muted-foreground font-medium">It only takes 1 minute</p>
        </motion.div>

      </div>
    </div>
  );
}

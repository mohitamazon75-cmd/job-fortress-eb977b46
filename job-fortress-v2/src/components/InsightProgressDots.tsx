import { motion } from 'framer-motion';

interface InsightProgressDotsProps {
  total: number;
  current: number;
  onDotClick?: (index: number) => void;
}

const EMOJI_MAP: Record<string, string> = {
  defense: '🛡️', 'skill-upgrade': '🚀', resume: '📄', 'best-fit': '💼',
  'salary-negotiation': '💰', coach: '🧠', 'deep-gate': '🔬',
  timeline: '⏳', 'kg-peer': '🧬', pivot: '🔀', repositioning: '🎭',
  'notice-period': '📋', debate: '⚔️', obituary: '💀', 'linkedin-roast': '🔥',
};

export function InsightProgressDots({ total, current, onDotClick }: InsightProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-1.5 px-4 py-2">
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i === current;
        const isDone = i < current;
        return (
          <motion.button
            key={i}
            type="button"
            onClick={() => onDotClick?.(i)}
            className={`rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary ${
              isActive
                ? 'bg-primary w-6 h-2.5'
                : isDone
                  ? 'bg-primary/40 w-2.5 h-2.5'
                  : 'bg-muted w-2.5 h-2.5'
            }`}
            layout
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            whileHover={{ scale: 1.3 }}
            aria-label={`Card ${i + 1}`}
          />
        );
      })}
    </div>
  );
}

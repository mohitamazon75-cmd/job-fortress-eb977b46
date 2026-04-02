import { motion } from 'framer-motion';
import { Zap, Clock, ArrowRight } from 'lucide-react';

interface RateLimitUpsellProps {
  minutesRemaining: number;
  onDismiss: () => void;
}

export default function RateLimitUpsell({ minutesRemaining, onDismiss }: RateLimitUpsellProps) {
  const hours = Math.floor(minutesRemaining / 60);
  const mins = minutesRemaining % 60;
  const resetLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins} minutes`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="fixed inset-x-4 bottom-6 z-50 max-w-lg mx-auto"
    >
      <div className="rounded-2xl border-2 border-primary/30 bg-card shadow-2xl p-6 backdrop-blur-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black text-foreground mb-1">
              You've seen your score. Now see what's protecting it.
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Free analysis shows you the number. Pro shows you the 12-week plan to improve it.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <Clock className="w-3.5 h-3.5" />
              <span>Your existing results are still available — no data lost.</span>
            </div>
            <div className="flex flex-col gap-3">
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm text-primary-foreground transition-colors"
                style={{ background: 'var(--gradient-primary)' }}
                onClick={() => {
                  window.location.href = '/pricing';
                }}
              >
                <Zap className="w-4 h-4" />
                See My Full Defense Plan — ₹10/day
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <p className="text-xs text-foreground/40 mt-1">or wait {resetLabel} for your next free analysis</p>
              <button
                onClick={onDismiss}
                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

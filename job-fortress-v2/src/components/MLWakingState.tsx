import { motion } from 'framer-motion';
import { Brain, Loader2 } from 'lucide-react';

interface MLWakingStateProps {
  message?: string;
}

export default function MLWakingState({ message }: MLWakingStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 flex items-center gap-3"
    >
      <div className="relative">
        <Brain className="w-5 h-5 text-primary" />
        <Loader2 className="w-3 h-3 text-primary absolute -bottom-0.5 -right-0.5 animate-spin" />
      </div>
      <div>
        <p className="text-sm font-bold text-foreground">
          {message || 'Waking up the AI engines...'}
        </p>
        <p className="text-[11px] text-muted-foreground">
          This takes about 60–90 seconds. Your deterministic analysis is ready below.
        </p>
      </div>
    </motion.div>
  );
}

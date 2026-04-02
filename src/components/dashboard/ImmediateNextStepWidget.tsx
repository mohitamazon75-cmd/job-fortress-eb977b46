import { motion } from 'framer-motion';
import { Zap, ArrowRight } from 'lucide-react';
import { type ImmediateNextStep } from '@/lib/scan-engine';

interface ImmediateNextStepWidgetProps {
  step: ImmediateNextStep;
}

export default function ImmediateNextStepWidget({ step }: ImmediateNextStepWidgetProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9 }}
      className="mb-6"
    >
      <div className="rounded-2xl border-2 border-primary/30 p-5 relative overflow-hidden" style={{ background: 'var(--gradient-oracle)' }}>
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-[0.08] blur-[40px] pointer-events-none" style={{ background: 'hsl(var(--primary))' }} />

        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-black text-primary uppercase tracking-wider">Do This Right Now</h2>
              <p className="text-[10px] text-muted-foreground">{step.time_required}</p>
            </div>
          </div>

          <p className="text-sm font-semibold text-foreground mb-2">{step.action}</p>
          <p className="text-xs text-muted-foreground mb-3">{step.rationale}</p>

          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-background px-3 py-2">
            <ArrowRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="text-xs text-foreground">
              <span className="font-bold">Deliverable:</span> {step.deliverable}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

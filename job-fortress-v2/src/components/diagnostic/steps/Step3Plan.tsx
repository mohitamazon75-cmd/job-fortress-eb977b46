import { motion } from "framer-motion";
import PhaseAccordion from "../shared/PhaseAccordion";
import LoadingDots from "../shared/LoadingDots";
import type { useDiagnostic } from "@/hooks/useDiagnostic";
import { Progress } from "@/components/ui/progress";

type HookReturn = ReturnType<typeof useDiagnostic>;

// Skeleton loader for while Claude generates
function PlanSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.15 }}
          className="rounded-xl border border-border overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3.5 bg-card">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-muted animate-pulse" />
              <div className="space-y-1.5">
                <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                <div className="h-2 w-16 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default function Step3Plan({ hook }: { hook: HookReturn }) {
  const { state, toggleTask, retryPlan } = hook;

  const totalTasks = state.survivalPlan
    ? state.survivalPlan.phases.reduce((sum, p) => sum + p.tasks.length, 0)
    : 18;
  const completedCount = state.completedTasks.size;
  const progressPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  if (state.isLoadingPlan) {
    return (
      <motion.div
        key="step3-loading"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4"
      >
        <LoadingDots label="Building your 90-day plan" />
        <PlanSkeleton />
      </motion.div>
    );
  }

  if (state.error && !state.survivalPlan) {
    return (
      <motion.div
        key="step3-error"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4 text-center py-8"
      >
        <p className="text-sm text-muted-foreground">{state.error}</p>
        <button
          onClick={retryPlan}
          className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
        >
          Retry →
        </button>
      </motion.div>
    );
  }

  if (!state.survivalPlan) return null;

  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      {/* Headline */}
      <div className="rounded-xl bg-primary/[0.06] border border-primary/15 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
          Your 90-day plan
        </p>
        <p className="text-sm font-bold text-foreground">{state.survivalPlan.headline}</p>
      </div>

      {/* Progress */}
      {completedCount > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {completedCount} / {totalTasks} tasks done
            </p>
            <p className="text-xs font-bold text-primary">{progressPct}%</p>
          </div>
          <Progress value={progressPct} className="h-1.5" />
        </div>
      )}

      {/* Phase accordions */}
      <div className="space-y-2">
        {state.survivalPlan.phases.map((phase, i) => (
          <PhaseAccordion
            key={phase.phase_number}
            phase={phase}
            defaultOpen={i === 0}
            completedTasks={state.completedTasks}
            onToggleTask={toggleTask}
          />
        ))}
      </div>
    </motion.div>
  );
}

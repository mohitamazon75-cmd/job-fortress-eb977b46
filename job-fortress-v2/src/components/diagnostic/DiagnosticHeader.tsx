import { motion } from "framer-motion";
import type { DiagnosticStep } from "@/hooks/useDiagnostic";

interface DiagnosticHeaderProps {
  step: DiagnosticStep;
  title: string;
  totalSteps: number;
}

export default function DiagnosticHeader({ step, title, totalSteps }: DiagnosticHeaderProps) {
  return (
    <div className="px-5 pt-5 pb-4 border-b border-border space-y-3">
      {/* Step counter + dots */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
          Step {step} of {totalSteps}
        </p>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <motion.span
              key={i}
              animate={{
                width: i + 1 === step ? 16 : 6,
                backgroundColor:
                  i + 1 < step
                    ? "hsl(var(--primary))"
                    : i + 1 === step
                    ? "hsl(var(--primary))"
                    : "hsl(var(--muted))",
                opacity: i + 1 <= step ? 1 : 0.4,
              }}
              transition={{ duration: 0.25 }}
              className="h-1.5 rounded-full"
              style={{ width: 6 }}
            />
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          animate={{ width: `${(step / totalSteps) * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* Title */}
      <motion.h2
        key={`title-${step}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-base font-black text-foreground leading-snug"
      >
        {title}
      </motion.h2>
    </div>
  );
}

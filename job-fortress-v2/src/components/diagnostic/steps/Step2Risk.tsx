import { motion } from "framer-motion";
import RiskMeter from "../shared/RiskMeter";
import { formatINR, getRiskBadgeCopy, getRiskLevel } from "@/utils/diagnosticCalculations";
import type { useDiagnostic } from "@/hooks/useDiagnostic";
import { cn } from "@/lib/utils";

type HookReturn = ReturnType<typeof useDiagnostic>;

const RISK_BADGE_STYLES = {
  high: "bg-destructive/10 border-destructive/20 text-destructive",
  medium: "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",
  low: "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400",
};

export default function Step2Risk({ hook }: { hook: HookReturn }) {
  const { state } = hook;
  const level = getRiskLevel(state.riskScore);

  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-5"
    >
      {/* Risk score */}
      <RiskMeter score={state.riskScore} />

      {/* Risk badge */}
      <div
        className={cn(
          "rounded-lg border px-3.5 py-2.5 text-xs font-semibold",
          RISK_BADGE_STYLES[level]
        )}
      >
        {getRiskBadgeCopy(state.riskScore)}
      </div>

      {/* The boss invoice */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            The invoice your boss is looking at
          </p>
        </div>
        <div className="divide-y divide-border/50">
          <MetricRow
            label="Your monthly cost to company"
            value={`${formatINR(state.monthlyCTC as number)}/mo`}
          />
          <MetricRow
            label="AI stack (Claude + ChatGPT + Perplexity + Canva)"
            value="₹6,000/mo"
            subtext="full stack"
          />
          <MetricRow
            label="Boss saves by replacing you"
            value={`${formatINR(state.bossSavesMonthly)}/mo`}
            highlight
          />
          <MetricRow
            label="You must outperform AI by"
            value={`${state.multiplierNeeded}×`}
            highlight
          />
        </div>
      </div>

      {/* Verdict */}
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
          The verdict
        </p>
        <p className="text-sm text-foreground leading-relaxed">{state.verdict}</p>
      </div>

      {/* Skills breakdown */}
      {(state.aiSkills.size > 0 || state.humanSkills.size > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {state.aiSkills.size > 0 && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/[0.03] p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-1.5">
                At risk ({state.aiSkills.size})
              </p>
              <div className="flex flex-wrap gap-1">
                {Array.from(state.aiSkills).map((s) => (
                  <span
                    key={s}
                    className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {state.humanSkills.size > 0 && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/[0.03] p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400 mb-1.5">
                Your moat ({state.humanSkills.size})
              </p>
              <div className="flex flex-wrap gap-1">
                {Array.from(state.humanSkills).map((s) => (
                  <span
                    key={s}
                    className="text-[10px] bg-green-500/10 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function MetricRow({
  label,
  value,
  subtext,
  highlight,
}: {
  label: string;
  value: string;
  subtext?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <p className="text-xs text-muted-foreground flex-1 pr-4">{label}</p>
      <div className="text-right flex-shrink-0">
        <p className={cn("text-sm font-bold", highlight ? "text-destructive" : "text-foreground")}>
          {value}
        </p>
        {subtext && <p className="text-[10px] text-muted-foreground">{subtext}</p>}
      </div>
    </div>
  );
}

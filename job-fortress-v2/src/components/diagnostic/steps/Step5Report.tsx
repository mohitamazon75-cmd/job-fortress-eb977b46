import { useState } from "react";
import { motion } from "framer-motion";
import { Share2, Mail, Check, RotateCcw } from "lucide-react";
import RiskMeter from "../shared/RiskMeter";
import { formatINR, getRiskLevel, getRiskBadgeCopy } from "@/utils/diagnosticCalculations";
import type { useDiagnostic } from "@/hooks/useDiagnostic";
import { cn } from "@/lib/utils";

type HookReturn = ReturnType<typeof useDiagnostic>;

export default function Step5Report({ hook }: { hook: HookReturn }) {
  const { state, shareReport, restart } = hook;
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const level = getRiskLevel(state.riskScore);

  const totalTasks = state.survivalPlan
    ? state.survivalPlan.phases.reduce((sum, p) => sum + p.tasks.length, 0)
    : 0;

  const handleShare = async () => {
    setShareLoading(true);
    let token = state.shareToken;
    if (!token) {
      token = await shareReport();
    }
    if (token) {
      const url = `${window.location.origin}/diagnostic/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        if (navigator.vibrate) navigator.vibrate(50);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch {
        // fallback
        prompt("Copy your share link:", url);
      }
    }
    setShareLoading(false);
  };

  const handleEmail = () => {
    const emailLines = [
      `My AI Replacement Diagnostic — ${state.jobTitle}`,
      "",
      `Risk Score: ${state.riskScore}%`,
      `Monthly cost gap: ${formatINR(state.bossSavesMonthly)}/mo`,
      `Must outperform AI by: ${state.multiplierNeeded}×`,
      "",
      state.verdict,
      "",
      "Get your free diagnostic at JobBachao.ai",
    ];
    const body = encodeURIComponent(emailLines.join("\n"));
    window.location.href = `mailto:?subject=My AI Replacement Diagnostic (${state.riskScore}%)&body=${body}`;
  };

  return (
    <motion.div
      key="step5"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-5"
    >
      {/* Risk score */}
      <RiskMeter score={state.riskScore} />

      {/* Badge */}
      <div
        className={cn(
          "rounded-lg border px-3.5 py-2 text-xs font-semibold",
          level === "high"
            ? "bg-destructive/10 border-destructive/20 text-destructive"
            : level === "medium"
            ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
            : "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400"
        )}
      >
        {getRiskBadgeCopy(state.riskScore)}
      </div>

      {/* 4 metric cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="Risk score" value={`${state.riskScore}%`} accent />
        <MetricCard
          label="Boss saves/mo"
          value={formatINR(state.bossSavesMonthly)}
          subtext="by replacing you"
          accent
        />
        <MetricCard label="Multiplier needed" value={`${state.multiplierNeeded}×`} />
        <MetricCard
          label="Tasks completed"
          value={`${state.completedTasks.size}/${totalTasks}`}
          subtext="of 90-day plan"
        />
      </div>

      {/* Profile summary */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Your profile
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            <span className="text-muted-foreground text-xs">Role</span>{" "}
            <span className="font-semibold">{state.jobTitle}</span>
          </span>
          <span>
            <span className="text-muted-foreground text-xs">CTC</span>{" "}
            <span className="font-semibold">{formatINR(state.monthlyCTC as number)}/mo</span>
          </span>
          <span>
            <span className="text-muted-foreground text-xs">Exp</span>{" "}
            <span className="font-semibold">{state.experienceBand}</span>
          </span>
        </div>

        {/* Skills */}
        {state.aiSkills.size > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-1">
              AI-exposed tasks
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
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400 mb-1">
              Human moat
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

      {/* 90-day plan summary */}
      {state.survivalPlan && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              90-day plan · {state.survivalPlan.headline}
            </p>
          </div>
          <div className="divide-y divide-border/50">
            {state.survivalPlan.phases.map((phase) => (
              <div key={phase.phase_number} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center flex-shrink-0">
                  {phase.phase_number}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">{phase.name}</p>
                  <p className="text-[10px] text-muted-foreground">{phase.days}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={handleShare}
          disabled={shareLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-60"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" /> Link copied!
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              {shareLoading ? "Generating…" : "Share link"}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleEmail}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border bg-background text-sm font-bold hover:bg-muted transition-all"
        >
          <Mail className="w-4 h-4" />
          Email
        </button>
      </div>

      {/* Restart */}
      <button
        type="button"
        onClick={restart}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Start over
      </button>
    </motion.div>
  );
}

function MetricCard({
  label,
  value,
  subtext,
  accent,
}: {
  label: string;
  value: string;
  subtext?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5",
        accent ? "border-destructive/20 bg-destructive/[0.03]" : "border-border bg-muted/20"
      )}
    >
      <p className={cn("text-lg font-black leading-tight", accent ? "text-destructive" : "text-foreground")}>
        {value}
      </p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
        {label}
      </p>
      {subtext && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{subtext}</p>}
    </div>
  );
}

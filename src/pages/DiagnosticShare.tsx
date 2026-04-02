import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import RiskMeter from "@/components/diagnostic/shared/RiskMeter";
import { formatINR, getRiskBadgeCopy, getRiskLevel } from "@/utils/diagnosticCalculations";
import { loadSharedReport, type DiagnosticRow } from "@/utils/diagnosticApi";
import { cn } from "@/lib/utils";

export default function DiagnosticShare() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<DiagnosticRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    loadSharedReport(token).then((r) => {
      if (r) setReport(r);
      else setNotFound(true);
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Loading report…</div>
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-4xl">🔒</p>
          <h1 className="text-xl font-black text-foreground">Report not found</h1>
          <p className="text-sm text-muted-foreground">
            This report is private, doesn't exist, or the link has expired.
          </p>
          <button
            onClick={() => navigate("/diagnostic")}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
          >
            Run your own diagnostic →
          </button>
        </div>
      </div>
    );
  }

  const level = getRiskLevel(report.risk_score);
  const survivalPlan = report.survival_plan as { headline?: string; phases?: Array<{ phase_number: number; name: string; days: string }> } | null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[520px] rounded-xl border border-border bg-card overflow-hidden shadow-sm"
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
            AI Replacement Diagnostic · Shared Report
          </p>
          <h1 className="text-lg font-black text-foreground">{report.job_title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {report.experience_band} · {formatINR(report.monthly_ctc)}/mo
          </p>
        </div>

        <div className="p-5 space-y-5">
          {/* Risk score */}
          <RiskMeter score={report.risk_score} />

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
            {getRiskBadgeCopy(report.risk_score)}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-destructive/20 bg-destructive/[0.03] p-3.5">
              <p className="text-lg font-black text-destructive">
                {formatINR(report.boss_saves_monthly ?? 0)}/mo
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
                Boss saves
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-3.5">
              <p className="text-lg font-black text-foreground">{report.multiplier_needed}×</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
                Multiplier needed
              </p>
            </div>
          </div>

          {/* Plan phases if available */}
          {survivalPlan?.phases && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Their 90-day plan · {survivalPlan.headline}
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {survivalPlan.phases.map((phase) => (
                  <div key={phase.phase_number} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center flex-shrink-0">
                      {phase.phase_number}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{phase.name}</p>
                      <p className="text-[10px] text-muted-foreground">{phase.days}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={() => navigate("/diagnostic")}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all"
          >
            Run your own diagnostic <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-center text-[10px] text-muted-foreground">
            Free · No sign-up required · Results in 30 seconds
          </p>
        </div>
      </motion.div>
    </div>
  );
}

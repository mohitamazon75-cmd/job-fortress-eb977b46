import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ShieldAlert, Brain, TrendingUp } from "lucide-react";
import type { ScanReport } from "@/lib/scan-engine";

interface Props {
  report: ScanReport;
}

const FEATURES = [
  { icon: ShieldAlert, label: "Your AI replacement risk score" },
  { icon: Brain, label: "Personalised 90-day survival plan" },
  { icon: TrendingUp, label: "6 role-specific Claude prompts" },
];

export default function DiagnosticLaunchCard({ report }: Props) {
  const navigate = useNavigate();

  // Pre-fill the diagnostic URL with role from the scan if available
  const role = report.role || report.role_detected || "";

  const handleLaunch = () => {
    // Store the role hint so the diagnostic can pre-fill
    try {
      sessionStorage.setItem("jb_diagnostic_prefill_role", role);
    } catch {
      // ignore
    }
    navigate("/diagnostic");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Headline */}
      <div className="rounded-xl border-2 border-destructive/25 bg-destructive/[0.04] p-4">
        <p className="text-sm font-black text-foreground leading-snug">
          Your scan identified the threats. Now find out{" "}
          <span className="text-destructive">exactly how replaceable you are</span> — and get a
          personalised plan to stay irreplaceable.
        </p>
      </div>

      {/* What you get */}
      <div className="space-y-2.5">
        {FEATURES.map(({ icon: Icon, label }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Social proof */}
      <div className="rounded-xl bg-muted/30 border border-border px-4 py-3">
        <p className="text-xs text-muted-foreground text-center">
          <span className="font-bold text-foreground">Free · No sign-up required</span> · Takes 3
          minutes · Indian market context throughout
        </p>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={handleLaunch}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-primary text-primary-foreground font-black text-base hover:bg-primary/90 transition-all"
      >
        Will my boss replace me? <ArrowRight className="w-5 h-5" />
      </button>

      {role && (
        <p className="text-center text-[10px] text-muted-foreground">
          Pre-filled for <span className="font-semibold text-foreground">{role}</span> — edit as
          needed
        </p>
      )}
    </motion.div>
  );
}

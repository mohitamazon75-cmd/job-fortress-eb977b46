import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getRiskLevel } from "@/utils/diagnosticCalculations";
import { cn } from "@/lib/utils";

interface RiskMeterProps {
  score: number;
  size?: "sm" | "lg";
}

const RISK_COLORS = {
  high: {
    bar: "bg-destructive",
    text: "text-destructive",
    badge: "bg-destructive/10 text-destructive border-destructive/20",
  },
  medium: {
    bar: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  low: {
    bar: "bg-green-500",
    text: "text-green-600 dark:text-green-400",
    badge: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  },
};

export default function RiskMeter({ score, size = "lg" }: RiskMeterProps) {
  const [animated, setAnimated] = useState(false);
  const level = getRiskLevel(score);
  const colors = RISK_COLORS[level];

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <span
          className={cn(
            "font-black leading-none",
            colors.text,
            size === "lg" ? "text-5xl" : "text-3xl"
          )}
        >
          {score}
          <span className={cn("font-bold", size === "lg" ? "text-2xl" : "text-base")}>%</span>
        </span>
        <span
          className={cn(
            "text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-full border",
            colors.badge
          )}
        >
          {level === "high" ? "High Risk" : level === "medium" ? "Medium Risk" : "Lower Risk"}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", colors.bar)}
          initial={{ width: 0 }}
          animate={{ width: animated ? `${score}%` : 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

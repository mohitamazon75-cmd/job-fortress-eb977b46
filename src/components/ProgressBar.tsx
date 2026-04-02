// Canonical percentile thresholds (BUG-19): ≥70 = success, 40–69 = warning, <40 = destructive
function pctColor(v: number): "success" | "warning" | "destructive" {
  return v >= 70 ? "success" : v >= 40 ? "warning" : "destructive";
}

interface ProgressBarProps {
  value: number;
  height?: number;
  colorOverride?: "success" | "warning" | "destructive" | "primary" | "info";
}

export function ProgressBar({ value, height = 6, colorOverride }: ProgressBarProps) {
  const color = colorOverride || pctColor(value);
  const colorClasses: Record<string, string> = {
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    primary: "bg-primary",
    info: "bg-info",
  };

  return (
    <div className="bg-surface-alt rounded-full w-full" style={{ height }}>
      <div
        className={`${colorClasses[color]} rounded-full score-bar`}
        style={{ width: `${Math.min(value, 100)}%`, height: "100%" }}
      />
    </div>
  );
}

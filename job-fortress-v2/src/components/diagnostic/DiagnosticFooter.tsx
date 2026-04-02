import { Loader2, ChevronLeft } from "lucide-react";
import type { DiagnosticStep } from "@/hooks/useDiagnostic";

interface DiagnosticFooterProps {
  step: DiagnosticStep;
  ctaLabel: string;
  isLoading: boolean;
  error: string | null;
  onCTA: () => void;
  onBack?: () => void;
  onRestart: () => void;
  disabled?: boolean;
}

export default function DiagnosticFooter({
  step,
  ctaLabel,
  isLoading,
  error,
  onCTA,
  onBack,
  onRestart,
  disabled,
}: DiagnosticFooterProps) {
  return (
    <div className="px-5 pb-5 pt-4 border-t border-border space-y-3">
      {/* Error inline */}
      {error && (
        <p className="text-xs text-destructive font-medium text-center">{error}</p>
      )}

      {/* CTA button */}
      <button
        type="button"
        onClick={onCTA}
        disabled={isLoading || disabled}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Working on it…
          </>
        ) : (
          ctaLabel
        )}
      </button>

      {/* Back + restart row */}
      <div className="flex items-center justify-between">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>
        ) : (
          <span />
        )}
        {step > 1 && (
          <button
            type="button"
            onClick={onRestart}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Start over
          </button>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Zap, Eye } from 'lucide-react';
import { useSubscription, requiresPro } from '@/hooks/use-subscription';

interface PremiumGateProps {
  featureId: string;
  children: React.ReactNode;
  /** Optional compact mode for inline gates */
  compact?: boolean;
  /** Optional blurred preview text lines to show free users a taste */
  previewLines?: string[];
}

/**
 * Wraps premium content. Shows upgrade prompt with blurred preview for free users,
 * renders children for Pro subscribers.
 */
export default function PremiumGate({ featureId, children, compact = false, previewLines }: PremiumGateProps) {
  const { isActive, loading } = useSubscription();

  // If the feature doesn't require pro, always render children
  if (!requiresPro(featureId)) return <>{children}</>;

  // While loading, show a skeleton placeholder to prevent flash of premium content
  if (loading) return (
    <div className="rounded-2xl border border-border bg-muted/30 p-6 animate-pulse space-y-3">
      <div className="h-4 w-1/3 rounded bg-muted" />
      <div className="h-3 w-2/3 rounded bg-muted" />
      <div className="h-3 w-1/2 rounded bg-muted" />
    </div>
  );

  // Pro users get full access
  if (isActive) return <>{children}</>;

  // Free users see the gate with optional blurred preview
  return compact ? <CompactGate /> : <FullGate previewLines={previewLines} />;
}

function CompactGate() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/pricing')}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-primary/30 bg-primary/5 text-sm font-bold text-primary hover:bg-primary/10 transition-all w-full justify-center"
    >
      <Lock className="w-4 h-4" /> Unlock with Pro
    </button>
  );
}

function FullGate({ previewLines }: { previewLines?: string[] }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-primary/[0.03] overflow-hidden">
      {/* Blurred preview content — shows real content to intrigue */}
      {previewLines && previewLines.length > 0 && (
        <div className="relative px-6 pt-6 pb-0">
          <div className="space-y-2" style={{ filter: 'blur(4px)', userSelect: 'none' }} aria-hidden="true">
            {previewLines.map((line, i) => (
              <p key={i} className="text-sm text-foreground leading-relaxed">{line}</p>
            ))}
          </div>
          {/* Gradient fade overlay */}
          <div
            className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, transparent, hsl(var(--background)))',
            }}
          />
          {/* Eye icon floating above the fade */}
          <div className="absolute inset-x-0 bottom-2 flex justify-center pointer-events-none">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Eye className="w-3 h-3" />
              Preview
            </div>
          </div>
        </div>
      )}

      {/* Gate CTA */}
      <div className="p-6 sm:p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Zap className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-black text-foreground">Pro Feature</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Upgrade to Pro to unlock this feature and get the full intelligence advantage.
          </p>
        </div>
        <button
          onClick={() => navigate('/pricing')}
          className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all"
        >
          Unlock Full Analysis →
        </button>
      </div>
    </div>
  );
}

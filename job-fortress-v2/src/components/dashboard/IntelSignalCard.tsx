import { motion } from 'framer-motion';
import { ExternalLink, Plus, X } from 'lucide-react';

interface RoleIntelSignal {
  id: string;
  headline: string;
  summary: string;
  relevance_score: number;
  relevance_reason: string;
  signal_type: 'company' | 'market' | 'skill_threat' | 'opportunity' | 'salary';
  action_prompt?: string;
  source_url?: string;
  published_at: string;
  stale?: boolean;
  fallback?: boolean;
}

interface IntelSignalCardProps {
  signal: RoleIntelSignal;
  onAddToWatchlist: (signal: RoleIntelSignal) => void;
  isWatchlisted: boolean;
  onRemoveFromWatchlist?: (signalId: string) => void;
  compact?: boolean;
}

function getRelevanceBadge(score: number): { color: string; label: string; bgColor: string } {
  if (score >= 80) return { color: 'text-prophet-red', label: 'HIGH RELEVANCE', bgColor: 'bg-prophet-red/10' };
  if (score >= 50) return { color: 'text-prophet-gold', label: 'MEDIUM', bgColor: 'bg-prophet-gold/10' };
  return { color: 'text-prophet-green', label: 'OPPORTUNITY', bgColor: 'bg-prophet-green/10' };
}

function getSignalTypeIcon(type: RoleIntelSignal['signal_type']): string {
  const icons: Record<RoleIntelSignal['signal_type'], string> = {
    'company': '🏢',
    'market': '📊',
    'skill_threat': '⚡',
    'opportunity': '🚀',
    'salary': '💰',
  };
  return icons[type];
}

export default function IntelSignalCard({
  signal,
  onAddToWatchlist,
  isWatchlisted,
  onRemoveFromWatchlist,
  compact = false,
}: IntelSignalCardProps) {
  const { color, label, bgColor } = getRelevanceBadge(signal.relevance_score);
  const icon = getSignalTypeIcon(signal.signal_type);

  const cardClass = compact
    ? 'rounded-lg border border-border bg-background p-3'
    : 'rounded-xl border border-border bg-card p-4';

  const containerClass = compact
    ? 'space-y-2'
    : 'space-y-3';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cardClass}
    >
      {/* Header with badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${color} ${bgColor} border border-current/20`}>
              {label}
            </span>
            {signal.stale && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                Cached
              </span>
            )}
            {signal.fallback && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                Offline
              </span>
            )}
          </div>
        </div>
        <span className="text-lg flex-shrink-0">{icon}</span>
      </div>

      {/* Headline */}
      <div>
        <h3 className="font-semibold text-sm text-foreground leading-snug">
          {signal.headline}
        </h3>
      </div>

      {/* Summary */}
      <p className="text-sm text-muted-foreground line-clamp-2">
        {signal.summary}
      </p>

      {/* Relevance reason */}
      <p className="text-xs italic text-muted-foreground">
        {signal.relevance_reason}
      </p>

      {/* Footer with actions */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
        <div>
          {signal.source_url && (
            <a
              href={signal.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              Read more <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Save/Remove buttons */}
        <div>
          {isWatchlisted ? (
            onRemoveFromWatchlist ? (
              <button
                onClick={() => onRemoveFromWatchlist(signal.id)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Remove
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">✓ Saved</span>
            )
          ) : (
            <button
              onClick={() => onAddToWatchlist(signal)}
              className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Save
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

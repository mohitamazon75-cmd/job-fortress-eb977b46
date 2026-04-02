import { Shield, AlertTriangle, Info } from 'lucide-react';
import type { DataQuality } from '@/lib/scan-engine';

interface DataQualityBadgeProps {
  quality: DataQuality;
  source?: string;
}

export default function DataQualityBadge({ quality, source }: DataQualityBadgeProps) {
  const isManualPath = source && (source.includes('deterministic_only') || source === 'industry_deterministic_only');

  const config = {
    HIGH: {
      icon: Shield,
      label: `High-confidence analysis · ${quality.kg_coverage ? (quality.kg_coverage > 1 ? Math.min(100, Math.round(quality.kg_coverage)) : Math.round(quality.kg_coverage * 100)) + '% KG coverage' : 'full profile data'}`,
      className: 'bg-prophet-green/10 text-prophet-green border-prophet-green/20',
    },
    MEDIUM: {
      icon: Info,
      label: isManualPath
        ? 'Limited analysis — add LinkedIn or resume for 10x deeper results'
        : 'Some signals estimated — add LinkedIn for better accuracy',
      className: isManualPath
        ? 'bg-prophet-gold/10 text-prophet-gold border-prophet-gold/20'
        : 'bg-prophet-gold/10 text-prophet-gold border-prophet-gold/20',
    },
    LOW: {
      icon: AlertTriangle,
      label: isManualPath
        ? 'Industry-level estimates only — upload your profile for personalized analysis'
        : 'Limited data — results are directional only',
      className: 'bg-destructive/10 text-destructive border-destructive/20',
    },
  };

  const c = config[quality.overall] || config.MEDIUM;
  const Icon = c.icon;

  // Determine source detail lines to show
  const sourceLines: string[] = [];
  if (quality.salary_source === 'not_available') {
    sourceLines.push('Salary data: not yet available');
  }
  if (quality.market_signals_source === 'tavily_search') {
    sourceLines.push('Market signals: based on web search');
  }
  if (quality.posting_count_source === 'search_result_count') {
    sourceLines.push('Job demand: based on search result count');
  }
  if (quality.data_age_hours != null && quality.data_age_hours > 48) {
    const days = Math.round(quality.data_age_hours / 24);
    sourceLines.push(`Market data: ${days} day${days !== 1 ? 's' : ''} old`);
  }

  return (
    <div>
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold ${c.className}`}>
        <Icon className="w-3.5 h-3.5" />
        <span>{c.label}</span>
      </div>
      {sourceLines.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {sourceLines.map((line, i) => (
            <p key={i} className="text-[10px] text-muted-foreground">{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}

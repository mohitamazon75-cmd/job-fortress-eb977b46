import { Database, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface DataProvenanceProps {
  skillsMatched: number;
  toolsTracked: number;
  kgCoverage?: number | null;
  source?: string;
  compact?: boolean;
  /** data_quality.overall from ScanReport — drives honest labelling */
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
}

export default function DataProvenance({
  skillsMatched, toolsTracked, kgCoverage, source, compact = false, confidence,
}: DataProvenanceProps) {
  // FIX 5: Honest source labelling based on actual confidence, not just source string.
  // 'linkedin' source with LOW confidence = scraping failed → show industry estimate.
  const isLowConf = confidence === 'LOW';
  const isMedConf = confidence === 'MEDIUM';

  const sourceLabel = isLowConf
    ? 'Industry estimate (add resume to personalise)'
    : source === 'resume'
    ? 'Personalised from your resume'
    : source === 'linkedin' && !isLowConf
    ? 'LinkedIn profile analysis'
    : 'Industry benchmark';

  const coveragePct = kgCoverage != null
    ? (kgCoverage > 1 ? Math.min(100, Math.round(kgCoverage)) : Math.round(kgCoverage * 100))
    : null;

  const skillLabel = skillsMatched > 0 ? `${skillsMatched} KG skills` : 'Industry baseline';

  // Icon reflects real confidence
  const ConfIcon = isLowConf
    ? AlertTriangle
    : isMedConf
    ? Database
    : CheckCircle2;
  const confColor = isLowConf ? 'text-amber-500' : isMedConf ? 'text-blue-400' : 'text-prophet-green';

  if (compact) {
    return (
      <p className="text-[11px] text-muted-foreground text-center">
        📊 <span className="font-bold">Deterministic</span> · {skillLabel} · {toolsTracked} AI tools · {sourceLabel}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
      <span className={`inline-flex items-center gap-1 font-semibold ${confColor}`}>
        <ConfIcon className="w-3 h-3" />
        {sourceLabel}
      </span>
      <span className="text-border">·</span>
      <span className="inline-flex items-center gap-1">
        <Database className="w-3 h-3" />
        <span className="font-bold">{skillLabel}</span>{skillsMatched > 0 ? ' matched' : ''}
      </span>
      <span className="text-border">·</span>
      <span><span className="font-bold">{toolsTracked}</span> AI tools tracked</span>
      {coveragePct != null && coveragePct > 0 && coveragePct <= 100 && (
        <>
          <span className="text-border">·</span>
          <span>{coveragePct}% coverage</span>
        </>
      )}
      <span className="text-border">·</span>
      <span>Skill risk: O*NET + proprietary tracking</span>
    </div>
  );
}


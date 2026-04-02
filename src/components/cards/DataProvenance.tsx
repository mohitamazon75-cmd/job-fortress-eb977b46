import { Database, Clock } from 'lucide-react';

interface DataProvenanceProps {
  skillsMatched: number;
  toolsTracked: number;
  kgCoverage?: number | null;
  source?: string;
  compact?: boolean;
}

export default function DataProvenance({ skillsMatched, toolsTracked, kgCoverage, source, compact = false }: DataProvenanceProps) {
  const sourceLabel = source === 'linkedin' ? 'LinkedIn-enhanced' : source === 'resume' ? 'Resume-enhanced' : 'Industry benchmark';
  
  // Normalize kg_coverage: if > 1, it's already a percentage; if 0-1 it's a ratio
  const coveragePct = kgCoverage != null
    ? (kgCoverage > 1 ? Math.min(100, Math.round(kgCoverage)) : Math.round(kgCoverage * 100))
    : null;

  const skillLabel = skillsMatched > 0 ? `${skillsMatched} KG skills` : 'Industry baseline';
  
  if (compact) {
    return (
      <p className="text-[11px] text-muted-foreground text-center">
        📊 <span className="font-bold">Deterministic</span> · {skillLabel} · {toolsTracked} AI tools · {sourceLabel}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
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
      <span className="font-semibold">{sourceLabel}</span>
      <span className="text-border">·</span>
      <span>Skill risk: O*NET + proprietary tracking</span>
    </div>
  );
}

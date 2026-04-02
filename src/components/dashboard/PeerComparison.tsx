import { motion } from 'framer-motion';
import { Users, Info } from 'lucide-react';

interface PeerComparisonProps {
  careerRisk: number;
  role: string;
  industry: string;
  survivabilityScore: number;
  /** Real peer percentile from backend — if absent, shows qualitative positioning only */
  peerPercentile?: number | null;
  /** Preview mode: only show first 3 rows with blur on rest */
  preview?: boolean;
}

export default function PeerComparison({ careerRisk, role, industry, survivabilityScore, peerPercentile, preview }: PeerComparisonProps) {
  const hasRealData = typeof peerPercentile === 'number' && peerPercentile > 0;

  const zone = careerRisk > 60 ? 'higher-risk' : careerRisk > 40 ? 'moderate' : 'lower-risk';
  const zoneLabel = zone === 'higher-risk'
    ? 'Your role faces above-average AI exposure in this industry'
    : zone === 'moderate'
    ? 'Your AI exposure is around the industry average'
    : 'Your role has below-average AI exposure in this industry';

  const zoneColor = zone === 'higher-risk' ? 'text-destructive' : zone === 'moderate' ? 'text-prophet-gold' : 'text-prophet-green';

  const position = hasRealData
    ? Math.min(95, Math.max(5, peerPercentile))
    : zone === 'higher-risk' ? 75 : zone === 'moderate' ? 50 : 25;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="rounded-xl border border-primary/20 bg-primary/[0.02] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-primary" />
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary">
          Where You Stand
        </p>
      </div>

      <div className="relative h-20 mb-3">
        <svg viewBox="0 0 100 55" className="w-full h-full" preserveAspectRatio="none">
          <rect x="0" y="10" width="33" height="45" fill="hsl(var(--prophet-green) / 0.08)" rx="2" />
          <rect x="33" y="10" width="34" height="45" fill="hsl(var(--prophet-gold) / 0.08)" rx="2" />
          <rect x="67" y="10" width="33" height="45" fill="hsl(var(--destructive) / 0.08)" rx="2" />
          <line
            x1={position} y1="5" x2={position} y2="55"
            stroke={zone === 'higher-risk' ? 'hsl(var(--destructive))' : zone === 'moderate' ? 'hsl(var(--prophet-gold))' : 'hsl(var(--prophet-green))'}
            strokeWidth="1.5"
            strokeDasharray="2 1"
          />
          <circle
            cx={position}
            cy="32"
            r="3"
            fill={zone === 'higher-risk' ? 'hsl(var(--destructive))' : zone === 'moderate' ? 'hsl(var(--prophet-gold))' : 'hsl(var(--prophet-green))'}
          />
        </svg>
        <div className="flex justify-between mt-1 px-0.5">
          <span className="text-[11px] font-bold text-muted-foreground tracking-wide">LOWER RISK</span>
          <span className="text-[11px] font-bold text-muted-foreground tracking-wide">HIGHER RISK</span>
        </div>

        <div 
          className="absolute top-0 -translate-x-1/2 text-[11px] font-black px-1.5 py-0.5 rounded"
          style={{ 
            left: `${position}%`,
            color: zone === 'higher-risk' ? 'hsl(var(--destructive))' : zone === 'moderate' ? 'hsl(var(--prophet-gold))' : 'hsl(var(--prophet-green))',
            background: zone === 'higher-risk' ? 'hsl(var(--destructive) / 0.1)' : zone === 'moderate' ? 'hsl(var(--prophet-gold) / 0.1)' : 'hsl(var(--prophet-green) / 0.1)',
          }}
        >
          YOU
        </div>
      </div>

      <p className={`text-sm text-center font-bold ${zoneColor}`}>
        {hasRealData
          ? (peerPercentile! > 50
            ? `You're more at risk than ${100 - peerPercentile!}% of ${industry} professionals`
            : `You're better protected than ${100 - peerPercentile!}% of ${industry} professionals`)
          : zoneLabel
        }
      </p>
      <p className="text-[10px] text-muted-foreground text-center mt-1 flex items-center justify-center gap-1">
        <Info className="w-3 h-3" />
        {hasRealData
          ? `Based on ${role} roles with similar experience levels`
          : 'Qualitative positioning based on your automation risk score'
        }
      </p>
    </motion.div>
  );
}
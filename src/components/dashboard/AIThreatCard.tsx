import { motion } from 'framer-motion';
import { AlertTriangle, Cpu, Crown } from 'lucide-react';

interface AIThreatCardProps {
  threatVector: string | null | undefined;
  automatableRatio: string | null | undefined;
  moatIndicators?: string[];
  isExec?: boolean;
  userName?: string;
}

export default function AIThreatCard({ threatVector, automatableRatio, moatIndicators, isExec, userName }: AIThreatCardProps) {
  if (!threatVector) return null;

  const ratioColor = automatableRatio === 'HIGH' ? 'text-prophet-red bg-prophet-red/10 border-prophet-red/20'
    : automatableRatio === 'MEDIUM' ? 'text-prophet-gold bg-prophet-gold/10 border-prophet-gold/20'
    : 'text-prophet-green bg-prophet-green/10 border-prophet-green/20';

  const ratioLabel = isExec 
    ? (automatableRatio === 'HIGH' ? 'SIGNIFICANT' : automatableRatio === 'MEDIUM' ? 'MODERATE' : 'LIMITED')
    : automatableRatio;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={`rounded-2xl border-2 p-5 mb-6 ${isExec ? 'border-primary/15 bg-primary/[0.02]' : 'border-prophet-red/15 bg-prophet-red/[0.02]'}`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isExec ? 'bg-primary/10' : 'bg-prophet-red/10'}`}>
          {isExec ? <Crown className="w-4.5 h-4.5 text-primary" /> : <Cpu className="w-4.5 h-4.5 text-prophet-red" />}
        </div>
        <div>
          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isExec ? 'text-primary' : 'text-prophet-red'}`}>
            {isExec ? 'Strategic Disruption Vector' : 'Primary AI Threat'}
          </p>
          <p className="text-sm font-bold text-foreground leading-snug">
            {userName && userName !== 'Professional' ? `${userName}, ` : ''}{threatVector}
          </p>
        </div>
      </div>

      {automatableRatio && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-semibold text-muted-foreground">
            {isExec ? 'Organizational Impact Exposure:' : 'Task Automation Exposure:'}
          </span>
          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${ratioColor}`}>
            {ratioLabel}
          </span>
        </div>
      )}

      {moatIndicators && moatIndicators.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] font-black uppercase tracking-widest text-prophet-green mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 rotate-180" />
            {isExec ? 'Your Competitive Edge' : 'What Protects You'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {moatIndicators.slice(0, 5).map((indicator, i) => (
              <span key={i} className="text-[10px] font-semibold px-2 py-1 rounded-full bg-prophet-green/10 text-prophet-green border border-prophet-green/20">
                {indicator}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

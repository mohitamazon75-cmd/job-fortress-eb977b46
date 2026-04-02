import { motion } from 'framer-motion';
import { Shield, Zap } from 'lucide-react';

interface MoatUrgencyGaugesProps {
  moatScore: number | null | undefined;
  urgencyScore: number | null | undefined;
  seniorityTier?: string | null;
}

function GaugeRing({ value, label, icon, color, colorClass, description }: {
  value: number;
  label: string;
  icon: React.ReactNode;
  color: string;
  colorClass: string;
  description: string;
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
          <motion.circle
            cx="50" cy="50" r={radius} fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-black ${colorClass}`}>{value}</span>
          <span className="text-[10px] text-muted-foreground font-medium">/100</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-bold text-foreground">{label}</span>
      </div>
      <p className="text-[11px] text-muted-foreground text-center leading-snug max-w-[140px]">{description}</p>
    </div>
  );
}

export default function MoatUrgencyGauges({ moatScore, urgencyScore, seniorityTier }: MoatUrgencyGaugesProps) {
  const moat = moatScore ?? 0;
  const urgency = urgencyScore ?? 0;

  if (moat === 0 && urgency === 0) return null;

  const moatColor = moat >= 60 ? 'hsl(var(--prophet-green))' : moat >= 35 ? 'hsl(var(--primary))' : 'hsl(var(--prophet-gold))';
  const moatColorClass = moat >= 60 ? 'text-prophet-green' : moat >= 35 ? 'text-primary' : 'text-prophet-gold';
  const urgencyColor = urgency >= 60 ? 'hsl(var(--prophet-red))' : urgency >= 35 ? 'hsl(var(--prophet-gold))' : 'hsl(var(--prophet-green))';
  const urgencyColorClass = urgency >= 60 ? 'text-prophet-red' : urgency >= 35 ? 'text-prophet-gold' : 'text-prophet-green';

  const moatDesc = moat >= 60
    ? 'You have rare skills — your company would struggle to find someone like you'
    : moat >= 35
    ? 'You have some unique strengths, but replacing you wouldn\'t be impossible'
    : 'Right now, many people can do what you do — time to specialize';

  const urgencyDesc = urgency >= 60
    ? 'AI is disrupting your role fast — take action this month'
    : urgency >= 35
    ? 'Changes are coming — start preparing now'
    : 'Low disruption pressure right now — use this time to build ahead';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-border bg-card p-5 mb-6"
    >
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-4">How safe are you from AI?</h3>
      <div className="flex items-center justify-around">
        <GaugeRing
          value={moat}
          label="Your Unique Edge"
          icon={<Shield className="w-3.5 h-3.5 text-muted-foreground" />}
          color={moatColor}
          colorClass={moatColorClass}
          description={moatDesc}
        />
        <div className="w-px h-20 bg-border" />
        <GaugeRing
          value={urgency}
          label="How Fast Is AI Coming?"
          icon={<Zap className="w-3.5 h-3.5 text-muted-foreground" />}
          color={urgencyColor}
          colorClass={urgencyColorClass}
          description={urgencyDesc}
        />
      </div>
    </motion.div>
  );
}

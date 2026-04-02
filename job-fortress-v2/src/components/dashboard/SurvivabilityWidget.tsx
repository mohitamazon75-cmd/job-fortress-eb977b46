import { motion } from 'framer-motion';
import { Shield, TrendingUp } from 'lucide-react';
import { type Survivability } from '@/lib/scan-engine';

interface SurvivabilityWidgetProps {
  survivability: Survivability;
}

export default function SurvivabilityWidget({ survivability }: SurvivabilityWidgetProps) {
  const { score, breakdown, primary_vulnerability, peer_percentile_estimate } = survivability;

  const scoreColor = score >= 70 ? 'text-prophet-green' : score >= 50 ? 'text-prophet-gold' : 'text-prophet-red';
  const scoreBg = score >= 70 ? 'bg-prophet-green/10' : score >= 50 ? 'bg-prophet-gold/10' : 'bg-prophet-red/10';
  const scoreBorder = score >= 70 ? 'border-prophet-green/20' : score >= 50 ? 'border-prophet-gold/20' : 'border-prophet-red/20';

  const bonuses = [
    { label: 'Experience', value: breakdown.experience_bonus, max: 20, icon: '📊' },
    { label: 'Strategic Skills', value: breakdown.strategic_bonus, max: 16, icon: '🧠' },
    { label: 'Location Advantage', value: breakdown.geo_bonus, max: 15, icon: '🌍' },
    { label: 'Adaptability', value: breakdown.adaptability_bonus, max: 15, icon: '🔄' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="mb-6"
    >
      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-2">
        <Shield className="w-4 h-4" />
        Your Protection Score
      </h2>
      <p className="text-xs text-muted-foreground mb-4 ml-6">
        How well-protected you are against AI replacing your job. Higher = safer. Based on your experience, skills, location & adaptability.
      </p>

      <div className={`rounded-2xl border-2 ${scoreBorder} ${scoreBg} p-6`}>
        <div className="flex items-center gap-6 mb-5">
          <div className="flex-shrink-0">
            <div className={`text-5xl font-black ${scoreColor}`}>
              {score}<span className="text-xl">/100</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{peer_percentile_estimate}</p>
          </div>

          <div className="flex-1 space-y-2">
            {bonuses.map((b) => (
              <div key={b.label} className="flex items-center gap-2">
                <span className="text-sm w-6 text-center">{b.icon}</span>
                <span className="text-xs font-medium text-muted-foreground w-28 flex-shrink-0">{b.label}</span>
                <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(b.value / b.max) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    className={`h-full rounded-full ${score >= 70 ? 'bg-prophet-green' : score >= 50 ? 'bg-prophet-gold' : 'bg-prophet-red'}`}
                  />
                </div>
                <span className="text-xs font-bold text-foreground w-8 text-right">+{b.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background p-3 mb-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">What this means:</span>{' '}
            {score >= 70
              ? 'You have strong protection against AI disruption. Your skills and experience give you a solid moat — but keep upskilling.'
              : score >= 50
              ? 'You have moderate protection. Some of your skills are safe, but others are at risk. Focus on building your moat skills.'
              : 'You are highly vulnerable to AI disruption. Urgent action needed — your current skillset has significant overlap with what AI can do.'}
          </p>
        </div>

        <div className="rounded-xl border border-prophet-gold/20 bg-prophet-gold/5 p-3 mb-3">
          <p className="text-xs font-bold text-prophet-gold uppercase tracking-wider mb-1">📊 What This Score Means For You</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {score >= 70
              ? 'Your combination of experience and human-judgment skills makes you harder to replace. Companies still need people who can make nuanced decisions AI can\'t.'
              : score >= 50
              ? 'You have some protection, but AI tools are actively automating parts of your workflow. Companies in your sector are already restructuring roles like yours.'
              : 'Roles similar to yours are being actively consolidated across the industry. Companies are replacing teams with AI tools and smaller headcounts.'}
          </p>
        </div>

        {primary_vulnerability && (
          <div className="rounded-xl border border-border bg-background p-3 flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-prophet-gold mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-prophet-gold uppercase tracking-wider mb-0.5">Your Biggest Risk</p>
              <p className="text-sm text-muted-foreground">{primary_vulnerability}</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

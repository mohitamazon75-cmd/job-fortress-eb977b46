import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface WhyThisScoreProps {
  score: number;
  automationRisk: number;
  demandTrend: string;
  moatSkillCount: number;
  talentDensity: string;
  seniorityTier: string;
  defaultOpen?: boolean;
}

interface FactorBar {
  barWidth: number;
  color: 'green' | 'amber' | 'red';
  label: string;
}

export default function WhyThisScore({
  score,
  automationRisk,
  demandTrend,
  moatSkillCount,
  talentDensity,
  seniorityTier,
  defaultOpen = false,
}: WhyThisScoreProps) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);

  // Compute automation overlap factor
  const automationFactor: FactorBar = {
    barWidth: automationRisk,
    color: automationRisk < 30 ? 'green' : automationRisk < 60 ? 'amber' : 'red',
    label: `${automationRisk}% overlap`,
  };

  // Compute India hiring demand factor
  const demandLower = demandTrend.toLowerCase();
  let demandFactor: FactorBar;
  if (demandLower.includes('rising') || demandLower.includes('growing') || demandLower.includes('high')) {
    demandFactor = { barWidth: 80, color: 'green', label: 'Growing' };
  } else if (demandLower.includes('stable') || demandLower.includes('steady')) {
    demandFactor = { barWidth: 55, color: 'amber', label: 'Stable' };
  } else if (demandLower.includes('declining') || demandLower.includes('falling') || demandLower.includes('weak')) {
    demandFactor = { barWidth: 25, color: 'red', label: 'Softening' };
  } else {
    demandFactor = { barWidth: 50, color: 'amber', label: 'Steady' };
  }

  // Compute skill moat depth factor
  let moatFactor: FactorBar;
  if (moatSkillCount === 0) {
    moatFactor = { barWidth: 15, color: 'red', label: 'Very thin' };
  } else if (moatSkillCount <= 2) {
    moatFactor = { barWidth: 40, color: 'amber', label: 'Thin' };
  } else if (moatSkillCount <= 4) {
    moatFactor = { barWidth: 65, color: 'amber', label: 'Moderate' };
  } else {
    moatFactor = { barWidth: 85, color: 'green', label: 'Strong' };
  }

  // Compute talent competition factor
  let talentFactor: FactorBar;
  if (talentDensity.toLowerCase() === 'scarce') {
    talentFactor = { barWidth: 80, color: 'green', label: 'Low competition' };
  } else if (talentDensity.toLowerCase() === 'high') {
    talentFactor = { barWidth: 25, color: 'red', label: 'High competition' };
  } else {
    talentFactor = { barWidth: 50, color: 'amber', label: 'Moderate' };
  }

  // Compute seniority buffer factor
  const seniorityUpper = seniorityTier.toUpperCase();
  let seniorityFactor: FactorBar;
  if (seniorityUpper === 'JUNIOR' || seniorityUpper === 'INTERN') {
    seniorityFactor = { barWidth: 20, color: 'red', label: 'Junior' };
  } else if (seniorityUpper === 'PROFESSIONAL' || seniorityUpper === 'MID') {
    seniorityFactor = { barWidth: 50, color: 'amber', label: 'Mid-level' };
  } else if (seniorityUpper === 'SENIOR') {
    seniorityFactor = { barWidth: 68, color: 'green', label: 'Senior' };
  } else if (seniorityUpper === 'DIRECTOR' || seniorityUpper === 'VP') {
    seniorityFactor = { barWidth: 80, color: 'green', label: 'Director' };
  } else if (seniorityUpper === 'C_SUITE' || seniorityUpper === 'EXECUTIVE' || seniorityUpper === 'FOUNDER') {
    seniorityFactor = { barWidth: 90, color: 'green', label: 'Executive' };
  } else {
    seniorityFactor = { barWidth: 45, color: 'amber', label: 'Mid-level' };
  }

  const factors = [
    { name: 'Automation overlap', factor: automationFactor },
    { name: 'India hiring demand', factor: demandFactor },
    { name: 'Skill moat depth', factor: moatFactor },
    { name: 'Talent competition', factor: talentFactor },
    { name: 'Seniority buffer', factor: seniorityFactor },
  ];

  // Find the factor with lowest bar width for summary
  const lowestFactor = factors.reduce((prev, current) => {
    return current.factor.barWidth < prev.factor.barWidth ? current : prev;
  });

  // Generate summary sentence based on lowest factor
  const getSummaryText = (): string => {
    const lowest = lowestFactor.name;

    if (lowest === 'Automation overlap') {
      if (automationFactor.barWidth < 40) {
        return 'Your main strength: your work has lower AI overlap than most roles.';
      } else {
        return 'Your automation overlap is pulling the score down — but that is fixable.';
      }
    } else if (lowest === 'Skill moat depth') {
      return 'Building 1-2 harder-to-automate skills would have the biggest impact on your score.';
    } else if (lowest === 'Talent competition') {
      return 'High competition in your role means a thin moat matters more.';
    } else if (lowest === 'Seniority buffer') {
      return 'Your seniority adds less buffer at this stage — but it grows fast with experience.';
    } else if (lowest === 'India hiring demand') {
      return 'Softening demand in your field is the main drag — pivoting your specialty would help.';
    }

    return 'Your score reflects a balance of factors — no single blocker, but a few worth improving.';
  };

  const colorMap = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-400',
    red: 'bg-red-400',
  };

  const valueColorMap = {
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  };

  return (
    <div className="space-y-0">
      {/* Collapsed Trigger */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 rounded-2xl hover:bg-muted/70 transition-colors"
      >
        <span className="text-sm font-semibold text-foreground">Why is your score {score}?</span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="pt-4 pb-4 space-y-5">
              {/* Factor Bars */}
              {factors.map((item, index) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + index * 0.05, duration: 0.3 }}
                  className="flex items-center gap-4"
                >
                  {/* Label (fixed width) */}
                  <div className="w-36 flex-shrink-0">
                    <p className="text-xs font-semibold text-foreground">{item.name}</p>
                  </div>

                  {/* Bar Track & Fill */}
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.factor.barWidth}%` }}
                        transition={{ delay: 0.15 + index * 0.05, duration: 0.6, ease: 'easeOut' }}
                        className={`h-full ${colorMap[item.factor.color]}`}
                      />
                    </div>
                    <span className={`text-xs font-semibold ${valueColorMap[item.factor.color]} whitespace-nowrap`}>
                      {item.factor.label}
                    </span>
                  </div>
                </motion.div>
              ))}

              {/* Summary Sentence */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="mt-5 pl-4 border-l-2 border-muted-foreground/30"
              >
                <p className="text-xs italic text-muted-foreground leading-relaxed">
                  {getSummaryText()}
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

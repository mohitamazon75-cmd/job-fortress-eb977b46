import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, TrendingUp, Compass, AlertCircle, ChevronRight } from 'lucide-react';

export interface ScanGoals {
  intent: 'actively_looking' | 'monitoring' | 'future_planning';
  biggest_concern: 'ai_replacement' | 'skill_gaps' | 'salary_stagnation' | 'job_market';
}

interface GoalCaptureModalProps {
  isOpen: boolean;
  onComplete: (goals: ScanGoals) => void;
  onSkip: () => void;
}

const INTENT_OPTIONS = [
  {
    value: 'future_planning' as const,
    icon: Compass,
    label: 'Understand my risk',
    desc: 'I want to know exactly where I stand',
  },
  {
    value: 'monitoring' as const,
    icon: TrendingUp,
    label: 'Build a plan to stay ahead',
    desc: 'I want a roadmap before things change',
  },
  {
    value: 'actively_looking' as const,
    icon: Target,
    label: 'I need help urgently',
    desc: "I'm at risk or recently lost my job",
  },
];

const CONCERN_OPTIONS = [
  { value: 'ai_replacement' as const, label: 'My job being automated by AI' },
  { value: 'skill_gaps' as const, label: 'Falling behind on skills' },
  { value: 'salary_stagnation' as const, label: 'Not growing fast enough' },
  { value: 'job_market' as const, label: 'Uncertain job market conditions' },
];

export default function GoalCaptureModal({ isOpen, onComplete, onSkip }: GoalCaptureModalProps) {
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<Partial<ScanGoals>>({});

  const handleIntent = (intent: ScanGoals['intent']) => {
    setGoals(prev => ({ ...prev, intent }));
    setStep(1);
  };

  const handleConcern = (concern: ScanGoals['biggest_concern']) => {
    const intent = goals.intent;
    if (intent) {
      onComplete({ intent, biggest_concern: concern });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={onSkip}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h2 className="text-sm font-black text-foreground">One quick question</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Step {step + 1} of 2 — personalises your results
              </p>
            </div>
            <button
              onClick={onSkip}
              className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-0.5 bg-border">
            <motion.div
              className="h-full bg-primary"
              animate={{ width: `${((step + 1) / 2) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Steps */}
          <div className="p-5">
            {step === 0 && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-3"
              >
                <p className="text-sm font-semibold text-foreground mb-4">
                  What matters most to you right now?
                </p>
                {INTENT_OPTIONS.map(option => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleIntent(option.value)}
                      className="w-full flex items-center gap-3 rounded-xl border border-border hover:border-primary/40 bg-background hover:bg-primary/5 p-4 text-left transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center flex-shrink-0 transition-colors">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{option.label}</p>
                        <p className="text-[11px] text-muted-foreground">{option.desc}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-2"
              >
                <p className="text-sm font-semibold text-foreground mb-4">
                  What concerns you most?
                </p>
                {CONCERN_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleConcern(option.value)}
                    className="w-full flex items-center gap-3 rounded-xl border border-border hover:border-primary/40 bg-background hover:bg-primary/5 px-4 py-3 text-left transition-all group"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0 transition-colors" />
                    <span className="text-sm text-foreground">{option.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
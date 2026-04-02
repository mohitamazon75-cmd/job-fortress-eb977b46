import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Lock, ExternalLink, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Milestone {
  id: string;
  phase: number;
  milestone_key: string;
  milestone_label: string;
  resource_url: string | null;
  completed_at: string | null;
}

interface MilestoneChecklistProps {
  userId: string;
  scanId: string;
}

export default function MilestoneChecklist({ userId, scanId }: MilestoneChecklistProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchMilestones();
  }, [userId, scanId]);

  async function fetchMilestones() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('defense_milestones' as any)
        .select('id, phase, milestone_key, milestone_label, resource_url, completed_at')
        .eq('user_id', userId)
        .eq('scan_id', scanId)
        .order('phase', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching milestones:', error);
        return;
      }

      setMilestones((data as any) || []);
    } catch (err) {
      console.error('Error fetching milestones:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleMilestoneCompletion(milestone: Milestone) {
    const isCompleting = !milestone.completed_at;
    const optimisticId = milestone.id;

    // Optimistic update
    setOptimisticUpdates(prev => ({
      ...prev,
      [optimisticId]: isCompleting,
    }));

    try {
      const { error } = await supabase
        .from('defense_milestones' as any)
        .update({
          completed_at: isCompleting ? new Date().toISOString() : null,
        })
        .eq('id', milestone.id);

      if (error) {
        toast.error('Failed to update milestone');
        setOptimisticUpdates(prev => {
          const next = { ...prev };
          delete next[optimisticId];
          return next;
        });
        return;
      }

      // Update local state
      setMilestones(prev =>
        prev.map(m =>
          m.id === milestone.id
            ? { ...m, completed_at: isCompleting ? new Date().toISOString() : null }
            : m
        )
      );

      setOptimisticUpdates(prev => {
        const next = { ...prev };
        delete next[optimisticId];
        return next;
      });

      toast.success(isCompleting ? 'Milestone marked complete!' : 'Milestone unmarked');
    } catch (err) {
      console.error('Error updating milestone:', err);
      toast.error('Error updating milestone');
      setOptimisticUpdates(prev => {
        const next = { ...prev };
        delete next[optimisticId];
        return next;
      });
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 mb-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!milestones || milestones.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-black text-foreground mb-1">90-Day Defense Plan incoming</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your personalized milestone checklist is being generated. This usually takes 30–60 seconds after your scan completes.
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] text-primary font-semibold">Generating milestones...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate progress
  const completed = milestones.filter(m => m.completed_at).length;
  const total = milestones.length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Group milestones by phase
  const milestonesByPhase = milestones.reduce((acc, m) => {
    if (!acc[m.phase]) acc[m.phase] = [];
    acc[m.phase].push(m);
    return acc;
  }, {} as Record<number, Milestone[]>);

  // Calculate phase completion percentages
  const phaseCompletion: Record<number, number> = {};
  for (const phase of [1, 2, 3, 4]) {
    const phaseMilestones = milestonesByPhase[phase] || [];
    if (phaseMilestones.length === 0) {
      phaseCompletion[phase] = 0;
    } else {
      const phaseCompleted = phaseMilestones.filter(m => m.completed_at).length;
      phaseCompletion[phase] = Math.round((phaseCompleted / phaseMilestones.length) * 100);
    }
  }

  // Determine which phases are unlocked
  const isPhaseUnlocked = (phase: number): boolean => {
    if (phase === 1) return true;
    if (phase === 2) return phaseCompletion[1] >= 50;
    if (phase === 3) return phaseCompletion[2] >= 50;
    if (phase === 4) return phaseCompletion[3] >= 50;
    return false;
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 mb-6">
      {/* Header with toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between mb-4"
      >
        <div className="flex-1 text-left">
          <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Your 90-Day Plan Progress</h3>
          <p className="text-xs text-muted-foreground mt-1">Track your milestones to build career resilience</p>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* Progress bar */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground">Progress</span>
                <span className="text-xs font-bold text-prophet-green">{progressPercent}% complete</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-prophet-green to-prophet-blue transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Phases */}
            <div className="space-y-6">
              {[1, 2, 3, 4].map(phase => {
                const isUnlocked = isPhaseUnlocked(phase);
                const phaseMilestones = milestonesByPhase[phase] || [];

                return (
                  <div key={phase} className={isUnlocked ? '' : 'opacity-50'}>
                    {/* Phase header */}
                    <div className="flex items-center gap-2 mb-3">
                      {isUnlocked ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-prophet-green/20 flex items-center justify-center">
                            <span className="text-xs font-bold text-prophet-green">
                              {phase === 4 && phaseCompletion[phase] === 100 ? '✓' : phase}
                            </span>
                          </div>
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-foreground">Phase {phase}</h4>
                            <p className="text-[10px] text-muted-foreground">
                              {phaseCompletion[phase]}% complete
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Phase {phase} (Locked)</h4>
                            <p className="text-[10px] text-muted-foreground">
                              Complete Phase {phase - 1} to unlock
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Phase milestones */}
                    {isUnlocked && phaseMilestones.length > 0 && (
                      <div className="space-y-2 ml-2 border-l border-border/50 pl-4">
                        {phaseMilestones.map(milestone => {
                          const isCompleted = milestone.completed_at || optimisticUpdates[milestone.id];
                          return (
                            <div key={milestone.id} className="flex items-start gap-3 group">
                              {/* Checkbox */}
                              <button
                                onClick={() => toggleMilestoneCompletion(milestone)}
                                className="mt-1 flex-shrink-0 transition-colors"
                              >
                                {isCompleted ? (
                                  <CheckCircle2 className="w-5 h-5 text-prophet-green" />
                                ) : (
                                  <Circle className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                                )}
                              </button>

                              {/* Label and resource link */}
                              <div className="flex-1 flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className={`text-sm ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    {milestone.milestone_label}
                                  </p>
                                  {milestone.resource_url && (
                                    <a
                                      href={milestone.resource_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[11px] text-prophet-blue hover:underline flex items-center gap-1 mt-1 group"
                                    >
                                      Resource →
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>

                                {/* Mark done button for incomplete milestones */}
                                {!isCompleted && (
                                  <button
                                    onClick={() => toggleMilestoneCompletion(milestone)}
                                    className="text-[11px] font-semibold text-prophet-blue hover:text-prophet-blue/80 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 whitespace-nowrap"
                                  >
                                    Mark done
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Locked phase placeholder */}
                    {!isUnlocked && (
                      <div className="text-xs text-muted-foreground italic ml-2">
                        {phaseMilestones.length} milestones (unlocked after Phase {phase - 1} completion)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface Task {
  week: string;
  tag: "ai" | "human" | "strategic";
  title: string;
  detail: string;
  boss_visibility: string;
}

interface Phase {
  phase_number: number;
  name: string;
  days: string;
  goal: string;
  tasks: Task[];
}

interface PhaseAccordionProps {
  phase: Phase;
  defaultOpen?: boolean;
  completedTasks: Set<string>;
  onToggleTask: (taskId: string) => void;
}

const TAG_STYLES = {
  ai: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  human: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  strategic: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
};

const TAG_LABELS = { ai: "AI", human: "Human", strategic: "Strategy" };

export default function PhaseAccordion({
  phase,
  defaultOpen = false,
  completedTasks,
  onToggleTask,
}: PhaseAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const completed = phase.tasks.filter((_, i) =>
    completedTasks.has(`${phase.phase_number}-${i}`)
  ).length;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-card hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-black flex items-center justify-center">
            {phase.phase_number}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{phase.name}</p>
            <p className="text-xs text-muted-foreground">{phase.days}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0 ml-3">
          <span className="text-xs text-muted-foreground font-medium">
            {completed}/{phase.tasks.length}
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-1 pt-1 bg-muted/10">
              <p className="text-xs text-muted-foreground italic py-2 border-b border-border mb-1">
                {phase.goal}
              </p>
            </div>
            <div className="divide-y divide-border/50">
              {phase.tasks.map((task, i) => {
                const taskId = `${phase.phase_number}-${i}`;
                const done = completedTasks.has(taskId);
                return (
                  <div key={taskId} className={cn("px-4 py-3.5", done && "opacity-60")}>
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => onToggleTask(taskId)}
                        className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                        aria-label={done ? "Mark incomplete" : "Mark complete"}
                      >
                        {done ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] text-muted-foreground font-mono uppercase">
                            {task.week}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border",
                              TAG_STYLES[task.tag]
                            )}
                          >
                            {TAG_LABELS[task.tag]}
                          </span>
                        </div>
                        <p className={cn("text-sm font-semibold text-foreground mb-1", done && "line-through")}>
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                          {task.detail}
                        </p>
                        <div className="rounded-lg bg-primary/[0.06] border border-primary/10 px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">
                            Boss visibility
                          </p>
                          <p className="text-xs text-foreground/80">{task.boss_visibility}</p>
                        </div>
                      </div>
                    </div>
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

import { useState } from "react";
import { motion } from "framer-motion";
import PromptCard from "../shared/PromptCard";
import LoadingDots from "../shared/LoadingDots";
import type { useDiagnostic } from "@/hooks/useDiagnostic";
import { cn } from "@/lib/utils";

type HookReturn = ReturnType<typeof useDiagnostic>;

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  research: "Research",
  writing: "Writing",
  analysis: "Analysis",
  strategy: "Strategy",
  reporting: "Reporting",
  communication: "Communication",
};

export default function Step4Prompts({ hook }: { hook: HookReturn }) {
  const { state, retryPrompts } = hook;
  const [activeCategory, setActiveCategory] = useState("all");

  if (state.isLoadingPrompts) {
    return (
      <motion.div
        key="step4-loading"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4"
      >
        <LoadingDots label="Generating your prompts" />
        <div className="space-y-2">
          {[0, 1, 2, 4, 5, 6].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-xl border border-border bg-card"
            >
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="space-y-1.5">
                  <div className="h-3 w-36 bg-muted rounded animate-pulse" />
                  <div className="h-2 w-24 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (state.error && !state.rolePrompts) {
    return (
      <motion.div
        key="step4-error"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4 text-center py-8"
      >
        <p className="text-sm text-muted-foreground">{state.error}</p>
        <button
          onClick={retryPrompts}
          className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
        >
          Retry →
        </button>
      </motion.div>
    );
  }

  if (!state.rolePrompts) return null;

  // Build category filter tabs from available prompts
  const categories = ["all", ...Array.from(new Set(state.rolePrompts.map((p) => p.category)))];

  const filtered =
    activeCategory === "all"
      ? state.rolePrompts
      : state.rolePrompts.filter((p) => p.category === activeCategory);

  return (
    <motion.div
      key="step4"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      {/* Header context */}
      <div className="rounded-xl bg-primary/[0.06] border border-primary/15 px-4 py-3">
        <p className="text-sm font-semibold text-foreground">
          {state.rolePrompts.length} prompts built for{" "}
          <span className="text-primary">{state.jobTitle}</span> — copy and go
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Each prompt is role-specific. Someone in a different job could not use these unchanged.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all",
              activeCategory === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Prompt cards */}
      <div className="space-y-2">
        {filtered.map((prompt, i) => (
          <PromptCard key={prompt.name} prompt={prompt} index={i} />
        ))}
      </div>
    </motion.div>
  );
}

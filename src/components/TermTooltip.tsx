import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

const TERM_DEFINITIONS: Record<string, { short: string; example?: string }> = {
  percentile: {
    short: "Your child's rank among 100 same-age Indian children of the same gender.",
    example: "50th = average. 75th = better than 75 out of 100 peers. 10th = lower than 90 peers.",
  },
  "bayesian risk": {
    short: "A probability updated using your child's actual data, starting from an India population base rate.",
    example: "If the base rate is 20% but your child has 3 risk factors, the posterior might rise to 45%.",
  },
  "monte carlo robustness": {
    short: "How stable the score is when small measurement errors are simulated 200 times.",
    example: "80% robustness means the conclusion holds even if your inputs vary slightly.",
  },
  preventability: {
    short: "How much of this risk can be reduced through lifestyle changes — diet, activity, sleep.",
    example: "70% preventability means proactive steps can cut the risk nearly in half.",
  },
  convergence: {
    short: "Where multiple biological pathways intersect. Fixing a convergence point improves many things at once.",
    example: "Iron is a convergence node — boosting it improves energy, focus, and immune function simultaneously.",
  },
  "biological pathway": {
    short: "A proven cause-and-effect chain in the body linking one health factor to another.",
    example: "Low iron → less oxygen to brain → slower thinking speed.",
  },
  "dev age": {
    short: "The age at which your child's abilities are typical — regardless of their actual birthday.",
    example: "A 7-year-old with a cognitive dev age of 8.5 thinks like an average 8.5-year-old.",
  },
  "dev velocity": {
    short: "How fast your child is developing compared to expected pace. 1.0x = on track.",
    example: "1.2x = accelerating (ahead of schedule). 0.8x = slower than expected pace.",
  },
  "integrated score": {
    short: "A weighted blend of Physical, Cognitive, and Nutritional percentiles into one overall rank.",
    example: "Score of 62 means your child is developing better than 62% of same-age Indian peers.",
  },
  "contribution %": {
    short: "How much this specific factor is currently raising the overall risk score.",
    example: "0% means the factor is healthy and not adding to the risk right now.",
  },
  synergistic: {
    short: "Two nutrients that help each other work better — taking them together boosts absorption.",
    example: "Vitamin C + Iron: Vitamin C increases iron absorption by up to 6×.",
  },
  antagonistic: {
    short: "Two nutrients that compete and reduce each other's absorption when taken together.",
    example: "Calcium + Iron: high calcium intake can reduce iron absorption by 30–50%.",
  },
  "influence score": {
    short: "How many biological pathways this metric controls. Higher = fixing it helps more things at once.",
    example: "Iron with influence 80 means improving iron intake ripples across 5+ connected health areas.",
  },
};

interface TermTooltipProps {
  term: string;
  children?: React.ReactNode;
}

export function TermTooltip({ term, children }: TermTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const key = term.toLowerCase();
  const def = TERM_DEFINITIONS[key];

  // Close on outside click/touch
  useEffect(() => {
    if (!open || !def) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open, def]);

  // No definition found — render children as-is
  if (!def) return <>{children}</>;

  const handleToggle = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  };

  return (
    <span ref={ref} className="relative inline-flex items-center gap-0.5">
      {children && <span>{children}</span>}
      <button
        type="button"
        onClick={handleToggle}
        onTouchEnd={handleToggle}
        aria-label={`What is ${term}?`}
        className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-full bg-muted border border-border text-[11px] font-bold text-muted-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors cursor-pointer select-none leading-none ml-0.5 flex-shrink-0"
        style={{ verticalAlign: "middle", marginBottom: "1px" }}
      >
        i
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 z-50 bg-card border border-border rounded-xl shadow-premium p-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Arrow pointing down */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-border" />
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-card" style={{ marginTop: "-1px" }} />

            <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1.5">{term}</p>
            <p className="text-[12px] text-foreground leading-relaxed mb-2">{def.short}</p>
            {def.example && (
              <p className="text-[11px] text-muted-foreground leading-relaxed italic border-t border-border pt-2">
                e.g. {def.example}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ExternalLink, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Prompt {
  name: string;
  use_case: string;
  category: string;
  time_saved: string;
  prompt: string;
}

interface PromptCardProps {
  prompt: Prompt;
  index: number;
}

export default function PromptCard({ prompt, index }: PromptCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(prompt.prompt);
      if (navigator.vibrate) navigator.vibrate(50);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  const handleTryInClaude = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `https://claude.ai/new?q=${encodeURIComponent(prompt.prompt.slice(0, 500))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border border-border overflow-hidden"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-card hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">{prompt.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{prompt.use_case}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
            {prompt.time_saved}
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 bg-muted/10 border-t border-border/50 space-y-3">
              {/* Prompt text */}
              <pre className="text-xs text-foreground/80 font-mono whitespace-pre-wrap break-words bg-card rounded-lg p-3 border border-border leading-relaxed max-h-48 overflow-y-auto">
                {prompt.prompt}
              </pre>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all border",
                    copied
                      ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400"
                      : "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy prompt
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleTryInClaude}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold bg-muted border border-border text-foreground hover:bg-muted/80 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Try in Claude
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

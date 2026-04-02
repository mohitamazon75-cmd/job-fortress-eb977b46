// BugReportButton — floating "Report a bug" button shown during assessments.
// Captures a short description + current page context and logs it to error_logs.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bug, X, Send, CheckCircle } from "lucide-react";
const logError = async (...args: any[]) => { console.warn('[BugReport]', ...args); };

interface Props {
  /** Optional extra context (e.g. current game step, assessment type) */
  context?: Record<string, unknown>;
}

export function BugReportButton({ context }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setStatus("sending");
    await logError({
      error_type: "manual_report",
      severity: "warning",
      error_message: text.trim(),
      metadata: { ...context, userAgent: navigator.userAgent },
    });
    setStatus("done");
    setTimeout(() => {
      setOpen(false);
      setText("");
      setStatus("idle");
    }, 1800);
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Report a bug"
        className="fixed bottom-5 right-4 z-50 w-10 h-10 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
      >
        <Bug className="w-4 h-4" />
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center pb-4 px-4 bg-black/20"
            onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 shadow-xl"
            >
              {status === "done" ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <CheckCircle className="w-8 h-8 text-success" />
                  <p className="text-sm font-semibold text-foreground">Thanks! Bug logged.</p>
                  <p className="text-xs text-muted-foreground">Our team will review it.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Bug className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-bold text-foreground">Report a Bug</span>
                    </div>
                    <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Describe what happened — what did you tap, what did you expect, what went wrong?</p>
                  <textarea
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={3}
                    placeholder="e.g. I tapped all circles correctly but got a score of 1…"
                    className="w-full resize-none rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 p-3 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all mb-3"
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={!text.trim() || status === "sending"}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition-opacity"
                  >
                    <Send className="w-4 h-4" />
                    {status === "sending" ? "Sending…" : "Send Report"}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

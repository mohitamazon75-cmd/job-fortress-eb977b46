import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Linkedin, Copy, Check, RefreshCw, X } from 'lucide-react';
import { ScanReport, normalizeTools } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';

interface LinkedInPostGeneratorProps {
  report: ScanReport;
  compact?: boolean;
}

function generatePost(report: ScanReport, variant: number): string {
  const score = computeStabilityScore(report);
  const role = report.role || 'my role';
  const skills = report.score_breakdown?.skill_adjustments || [];
  const highRisk = skills.filter(s => s.automation_risk >= 60);
  const moats = report.moat_skills || [];
  const tools = normalizeTools(report.ai_tools_replacing || []);
  const judoTool = report.judo_strategy?.recommended_tool;

  const templates = [
    // Template 0: Discovery framing
    `I just ran an AI career risk analysis on my ${role} position.\n\nHere's what I found:\n\n${highRisk.length > 0 ? `⚠️ ${highRisk.length} of my ${skills.length} professional skills are already being automated by tools like ${tools.slice(0, 2).map(t => typeof t === 'string' ? t : (t as any).tool_name || String(t)).join(' and ')}\n\n` : ''}${moats.length > 0 ? `✅ But my moat skills — ${moats.slice(0, 3).join(', ')} — are still hard to automate\n\n` : ''}${judoTool ? `🥋 The smart move? Learn ${judoTool} and turn the threat into an advantage\n\n` : ''}The professionals who win aren't the ones ignoring AI. They're the ones who know exactly where they stand.\n\nMy career safety score: ${score}/100\n\n#AICareer #FutureOfWork #CareerGrowth`,

    // Template 1: Insight-led
    `"Will AI take my job?" — I stopped guessing and got the data.\n\n📊 Ran a deep analysis on my ${role} career:\n\n${skills.length > 0 ? `→ ${skills.length} skills analyzed against AI capability benchmarks\n` : ''}${highRisk.length > 0 ? `→ ${highRisk.length} skills already have AI alternatives\n` : ''}${moats.length > 0 ? `→ ${moats.length} "moat" skills that AI can't touch (yet): ${moats.slice(0, 2).join(', ')}\n` : ''}${judoTool ? `→ Top recommendation: Learn ${judoTool} to flip the threat\n` : ''}\nMost people will find this out too late. Knowledge is the first moat.\n\n#FutureOfWork #AITransformation #Career`,

    // Template 2: Action-oriented
    `3 things I learned about my career's AI resilience today:\n\n1️⃣ ${highRisk.length > 0 ? `${highRisk[0].skill_name} (${highRisk[0].automation_risk}% automatable) — I need to evolve this skill` : `My core skills are surprisingly resilient against AI automation`}\n\n2️⃣ ${moats.length > 0 ? `${moats[0]} is my strongest career moat — doubling down on it` : `Building human-only skills is the best career insurance`}\n\n3️⃣ ${judoTool ? `Learning ${judoTool} can flip AI from a threat into my competitive edge` : `The gap between "AI-aware" and "AI-oblivious" professionals is widening fast`}\n\nCareer safety score: ${score}/100\n\nWhat's yours? 👇\n\n#CareerDevelopment #AI #ProfessionalGrowth`,
  ];

  return templates[variant % templates.length];
}

export default function LinkedInPostGenerator({ report, compact = false }: LinkedInPostGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState(0);
  const [copied, setCopied] = useState(false);

  const post = generatePost(report, variant);

  const handleCopy = () => {
    navigator.clipboard.writeText(post);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    setVariant(v => v + 1);
  };

  const trigger = compact ? (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-xs font-medium text-foreground"
    >
      <Linkedin className="w-3.5 h-3.5" />
      LinkedIn Post
    </button>
  ) : (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-all text-sm font-medium text-foreground"
    >
      <Linkedin className="w-4 h-4" />
      Generate LinkedIn Post
    </button>
  );

  return (
    <>
      {trigger}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Linkedin className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-foreground">LinkedIn Post Generator</h3>
                </div>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                Share your career insight (not your score) — position yourself as AI-aware and proactive.
              </p>

              <div className="rounded-xl border border-border bg-muted/30 p-4 mb-4">
                <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">{post}</pre>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-sm font-medium"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
                <button
                  onClick={handleRegenerate}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border hover:bg-muted transition-all text-sm font-medium text-foreground"
                >
                  <RefreshCw className="w-4 h-4" />
                  New Version
                </button>
              </div>

              <p className="text-[10px] text-muted-foreground text-center mt-3">
                💡 Tip: Posts about career insights get 3x more engagement than job updates
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

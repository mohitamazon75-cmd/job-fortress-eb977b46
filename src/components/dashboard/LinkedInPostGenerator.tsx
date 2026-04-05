import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Linkedin, Copy, Check, RefreshCw, X, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ScanReport, normalizeTools } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';

interface LinkedInPostGeneratorProps {
  report: ScanReport;
  compact?: boolean;
}

const STREAM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-action-content`;

function buildPrompt(report: ScanReport): string {
  const score = computeStabilityScore(report);
  const role = report.role || 'my role';
  const skills = report.score_breakdown?.skill_adjustments || [];
  const highRisk = skills.filter(s => s.automation_risk >= 60);
  const moats = report.moat_skills || [];
  const tools = normalizeTools(report.ai_tools_replacing || []);
  const judoTool = report.judo_strategy?.recommended_tool;

  return `Write a LinkedIn post for a ${role} professional sharing their AI career risk analysis insight.

Key data points:
- Career stability score: ${score}/100
- ${highRisk.length} of ${skills.length} skills have AI automation risk above 60%
- ${moats.length > 0 ? `Moat skills (hard to automate): ${moats.slice(0, 4).join(', ')}` : 'No strong moat skills identified yet'}
- ${tools.length > 0 ? `AI tools replacing tasks: ${tools.slice(0, 3).map(t => typeof t === 'string' ? t : (t as any).tool_name || String(t)).join(', ')}` : ''}
- ${judoTool ? `Recommended judo move: Learn ${judoTool} to flip AI from threat to advantage` : ''}

Requirements:
- Maximum 200 words
- Open with a provocative insight or data point — NOT "I just ran..." or "I am excited..."
- Frame it as a professional insight, not a product testimonial
- Include 1-2 specific numbers from the data above
- End with a question to spark engagement
- Add 3-4 relevant hashtags at the end
- Confident, thought-leadership tone — position the author as AI-aware and proactive
- Do NOT mention any specific tool or product name
- Indian professional context`;
}

export default function LinkedInPostGenerator({ report, compact = false }: LinkedInPostGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const generatePost = useCallback(async () => {
    setLoading(true);
    setError('');
    setContent('');
    setGenerated(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch(STREAM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt: buildPrompt(report), title: 'LinkedIn Post' }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: 'Something went wrong' }));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              accumulated += delta;
              setContent(accumulated);
              if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) { accumulated += delta; setContent(accumulated); }
          } catch {}
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(e.message || 'Failed to generate post');
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [report]);

  // Auto-generate on open
  useEffect(() => {
    if (open && !generated && !loading) {
      generatePost();
    }
    if (!open) {
      setContent('');
      setError('');
      setGenerated(false);
    }
  }, [open]);

  const handleClose = () => {
    if (abortRef.current) abortRef.current.abort();
    setOpen(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = content;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            onClick={handleClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card border border-border rounded-2xl max-w-lg w-full shadow-xl max-h-[85vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 pb-3 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Linkedin className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-bold text-foreground text-sm">LinkedIn Post Generator</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {loading ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          AI is writing your post...
                        </span>
                      ) : content ? '✓ AI-generated from your analysis' : 'Powered by your career data'}
                    </p>
                  </div>
                </div>
                <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div ref={bodyRef} className="flex-1 overflow-y-auto p-5">
                {error && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 mb-4">
                    <p className="text-sm font-semibold text-destructive">{error}</p>
                    <button
                      onClick={generatePost}
                      className="mt-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold"
                    >Try again</button>
                  </div>
                )}

                {!content && loading && (
                  <div className="flex flex-col items-center py-10 gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm font-semibold text-muted-foreground">Crafting your LinkedIn post...</p>
                    <p className="text-xs text-muted-foreground">Takes 5–10 seconds</p>
                  </div>
                )}

                {content && (
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">{content}</pre>
                    {loading && (
                      <span className="inline-block w-1.5 h-4 bg-primary rounded-sm animate-pulse ml-0.5 align-text-bottom" />
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-2 p-4 pt-3 border-t border-border flex-shrink-0">
                {content && !loading && (
                  <button
                    onClick={() => { setGenerated(false); generatePost(); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border hover:bg-muted transition-all text-sm font-medium text-foreground"
                  >
                    <RefreshCw className="w-4 h-4" />
                    New Version
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  disabled={!content || loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
              </div>

              <p className="text-[10px] text-muted-foreground text-center pb-3">
                💡 Posts about career insights get 3x more engagement than job updates
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

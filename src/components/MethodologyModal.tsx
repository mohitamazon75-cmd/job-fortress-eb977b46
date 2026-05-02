import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, ShieldCheck, Cpu, Database, Network, FileText } from 'lucide-react';
import { useEffect } from 'react';

/**
 * MethodologyModal
 * ----------------
 * Credibility surface for the landing page. Each external source is paired
 * with the EXACT proprietary component of the JobBachao engine that consumes
 * it — so visitors see we are not "wrapping ChatGPT" or quoting headlines,
 * but actually ingesting these datasets into a deterministic Knowledge Graph
 * + scoring engine.
 *
 * Pure presentation. No engine, no LLM, no DB calls. Source URLs match
 * what /methodology already cites, so we are not introducing new claims.
 */

interface MethodologyModalProps {
  open: boolean;
  onClose: () => void;
}

interface SourceEntry {
  label: string;
  fullName: string;
  year: string;
  url: string;
  /** What we actually USE this source for in the engine. */
  usedFor: string;
  /** One-line "why this matters to your score". */
  ourEdge: string;
}

const SOURCES: SourceEntry[] = [
  {
    label: 'WEF',
    fullName: 'World Economic Forum — Future of Jobs Report',
    year: '2025',
    url: 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/',
    usedFor:
      'Sectoral displacement timelines (2025 → 2030) and the phased displacement model — partial (20–30% of tasks) → significant (50%+) → critical restructuring.',
    ourEdge:
      'Calibrates the doom-clock window for your specific job family, not a generic industry headline.',
  },
  {
    label: 'NASSCOM',
    fullName: 'NASSCOM India Technology Sector Snapshot',
    year: '2024',
    url: 'https://nasscom.in/knowledge-center/publications/technology-sector-in-india-2024',
    usedFor:
      'India-specific IT, BPO and KPO workforce baselines, hiring deltas by tier-1/tier-2 city, and GCC vs. services split.',
    ourEdge:
      'Why your score reflects Indian hiring reality (Bengaluru ≠ Bay Area), not a translated US benchmark.',
  },
  {
    label: 'McKinsey',
    fullName: 'McKinsey — The Economic Potential of Generative AI',
    year: '2023–2024',
    url: 'https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/the-economic-potential-of-generative-ai',
    usedFor:
      'Generative-AI exposure coefficients per work activity. Updates the older Frey & Osborne risks with LLM-era realities (writing, coding, analysis).',
    ourEdge:
      'Lets the engine separate "AI assists you" tasks from "AI replaces you" tasks at the activity level.',
  },
  {
    label: 'O*NET',
    fullName: 'O*NET Task Database (US Dept. of Labor)',
    year: 'Continuous',
    url: 'https://www.onetonline.org/',
    usedFor:
      'Atomic task decomposition for ~1,000 occupations — the spine our Knowledge Graph maps every Indian role onto.',
    ourEdge:
      'Your role is broken into the actual tasks you do, not just a job title. That is what makes the score deterministic.',
  },
  {
    label: 'Oxford',
    fullName: 'Frey & Osborne — The Future of Employment, Oxford Martin School',
    year: '2013',
    url: 'https://www.ox.ac.uk/news/2013-09-17-oxford-martin-school-study-shows-nearly-half-us-jobs-could-be-risk-computerisation',
    usedFor:
      'The original task-automatability scoring framework. We use it as a structural prior, then overlay GenAI-era re-weightings from McKinsey + WEF 2025.',
    ourEdge:
      'Methodological backbone — the same framework cited by every serious labour-market study.',
  },
];

/** Plain-English mapping from "external dataset" → "JobBachao engine surface". */
const PIPELINE = [
  {
    icon: Database,
    title: 'Step 1 — Ingestion',
    body:
      'We extract role + skills + seniority from your resume / LinkedIn (Affinda parser, Gemini Vision OCR fallback).',
  },
  {
    icon: Network,
    title: 'Step 2 — Knowledge Graph match',
    body:
      'Your role is mapped to an O*NET-derived task spine, re-weighted with WEF 2025 sector timelines and McKinsey GenAI exposure scores.',
  },
  {
    icon: Cpu,
    title: 'Step 3 — Deterministic scoring',
    body:
      'Same inputs → same score, every time. No LLM is asked "how risky is this job?". The score is computed, not generated.',
  },
  {
    icon: ShieldCheck,
    title: 'Step 4 — India overlay',
    body:
      'NASSCOM workforce baselines and live India hiring signals adjust the verdict for your city + sector. No US-only outputs.',
  },
];

export default function MethodologyModal({ open, onClose }: MethodologyModalProps) {
  // Lock background scroll while the modal is open + ESC to close.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="methodology-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky header */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-5 sm:px-7 py-4 sm:py-5 border-b border-border bg-card/95 backdrop-blur">
              <div>
                <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.25em] text-primary mb-1">
                  Why our score is not a guess
                </p>
                <h2
                  id="methodology-modal-title"
                  className="text-lg sm:text-2xl font-black text-foreground leading-tight"
                >
                  Methodology &amp; Sources
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close methodology modal"
                className="flex-shrink-0 w-9 h-9 rounded-lg border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="px-5 sm:px-7 py-5 sm:py-6 space-y-7">
              {/* Plain intro */}
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                JobBachao is <span className="text-foreground font-bold">not a ChatGPT wrapper</span>.
                Your risk score is computed by a deterministic engine that ingests the
                datasets below into a <span className="text-foreground font-bold">structured Knowledge Graph</span>.
                Same inputs always produce the same score. LLMs are used only for narration,
                grounded in your actual data — never for scoring.
              </p>

              {/* Pipeline */}
              <section>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">
                  How a source becomes your score
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PIPELINE.map((step) => {
                    const Icon = step.icon;
                    return (
                      <div
                        key={step.title}
                        className="rounded-xl border border-border bg-background/50 p-3.5 flex gap-3"
                      >
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground mb-0.5">{step.title}</p>
                          <p className="text-[12px] text-muted-foreground leading-relaxed">{step.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Sources */}
              <section>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">
                  The 5 datasets we actually use
                </h3>
                <div className="space-y-2.5">
                  {SOURCES.map((s) => (
                    <a
                      key={s.label}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl border border-border bg-background/50 p-4 hover:border-primary/30 hover:bg-primary/[0.03] transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-[11px] font-black px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary">
                            {s.label}
                          </span>
                          <span className="text-sm font-bold text-foreground">{s.fullName}</span>
                          <span className="text-[11px] font-mono text-muted-foreground">({s.year})</span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-primary flex-shrink-0 mt-1 transition-colors" />
                      </div>
                      <p className="text-[12.5px] text-muted-foreground leading-relaxed mb-1.5">
                        <span className="text-foreground font-bold">What we use it for: </span>
                        {s.usedFor}
                      </p>
                      <p className="text-[12.5px] text-foreground/90 leading-relaxed">
                        <span className="text-primary font-bold">Why it matters to your score: </span>
                        {s.ourEdge}
                      </p>
                    </a>
                  ))}
                </div>
              </section>

              {/* Our IP — the moat statement */}
              <section className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-primary mb-1.5">
                      Our proprietary layer
                    </p>
                    <p className="text-sm text-foreground leading-relaxed mb-2">
                      The 5 datasets above are public. Our IP is what we do with them:
                    </p>
                    <ul className="space-y-1.5 text-[13px] text-muted-foreground leading-relaxed list-disc pl-5">
                      <li>
                        A <span className="text-foreground font-bold">structured Knowledge Graph</span> mapping
                        Indian roles → O*NET tasks → WEF/McKinsey AI-exposure weights.
                      </li>
                      <li>
                        A <span className="text-foreground font-bold">deterministic scoring engine</span> (HIGH /
                        MEDIUM / LOW enums, not made-up percentages) — auditable, reproducible.
                      </li>
                      <li>
                        <span className="text-foreground font-bold">India-overlay heuristics</span>: NASSCOM
                        baselines, GCC vs services split, tier-1/2 city hiring deltas.
                      </li>
                      <li>
                        <span className="text-foreground font-bold">Provenance stamping</span> on every card —
                        engine version, prompt version, KG match confidence are visible in your report.
                      </li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Footer link to full methodology page */}
              <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-border pt-4">
                <p className="text-[12px] text-muted-foreground">
                  Want the full formulas, weights, and edge-case handling?
                </p>
                <a
                  href="/methodology"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Read full methodology page →
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

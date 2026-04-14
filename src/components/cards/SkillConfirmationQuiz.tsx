/**
 * SkillConfirmationQuiz
 *
 * Shown when data_quality.overall === 'LOW' (synthetic fallback — no real
 * profile data). Two-path UX:
 *   Primary:   Upload resume → fires jb:rescan-with-resume → Index.tsx reruns full scan
 *   Secondary: Confirm skill chips → contextual adjustment only (no re-scan)
 *
 * VibeSec: file input validates extension + size client-side before dispatching.
 * Chip selection is UI-only state — never posted to any endpoint directly.
 * Free-text injection not possible — chips are predefined allowlist only.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Upload, X } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const INDUSTRY_SKILLS: Record<string, string[]> = {
  'IT & Software': [
    'React / Frontend Development', 'Python scripting', 'SQL & data queries',
    'REST API design', 'CI/CD pipelines', 'Cloud infrastructure (AWS/GCP/Azure)',
    'System design', 'Code review & mentoring', 'Product requirements translation',
    'DevOps / Docker / Kubernetes',
  ],
  'Finance & Banking': [
    'Financial modelling', 'Excel & data analysis', 'Risk assessment',
    'Regulatory reporting', 'Credit analysis', 'Portfolio management',
    'Client relationship management', 'Audit & compliance', 'Treasury operations',
    'Investment research',
  ],
  'Marketing & Advertising': [
    'Campaign management', 'SEO / SEM', 'Content strategy',
    'Social media management', 'Brand positioning', 'Performance analytics',
    'Email marketing', 'Media buying', 'Market research', 'Copywriting',
  ],
  'Healthcare': [
    'Patient assessment', 'Clinical documentation', 'Treatment planning',
    'Lab interpretation', 'Care coordination', 'Regulatory compliance (HIPAA)',
    'Medical coding', 'Telemedicine', 'Pharmacovigilance', 'Public health analysis',
  ],
  'Manufacturing': [
    'Production planning', 'Quality control', 'Lean / Six Sigma',
    'Supply chain management', 'CAD / engineering drawings', 'Safety compliance',
    'Equipment maintenance', 'Inventory management', 'Process optimisation',
    'ERP systems (SAP / Oracle)',
  ],
  'Creative & Design': [
    'Graphic design (Figma / Adobe)', 'UI/UX design', 'Brand identity',
    'Illustration / motion graphics', 'Video editing', 'Photography',
    'Creative direction', 'Art direction', 'Copy & storytelling', 'Design systems',
  ],
  'Education': [
    'Curriculum design', 'Classroom instruction', 'Student assessment',
    'Learning management systems', 'EdTech tools', 'Parent communication',
    'Special education support', 'Training facilitation', 'E-learning content',
    'Research & publication',
  ],
};

const FALLBACK_SKILLS = [
  'Data analysis', 'Project management', 'Stakeholder communication',
  'Reporting & documentation', 'Process improvement', 'Team coordination',
  'Problem solving', 'Client management', 'Presentations', 'Research',
];

interface Props {
  report: ScanReport;
  onDismiss: () => void;
}

export default function SkillConfirmationQuiz({ report, onDismiss }: Props) {
  const industry = report.industry ?? '';
  const industryPool = INDUSTRY_SKILLS[industry] ?? FALLBACK_SKILLS;

  // ISSUE 2 FIX: merge detected skills into the visible chip pool so every
  // pre-selected chip is always rendered. Without this, detected skills that
  // aren't in industryPool would show as "selected" but invisible.
  const detectedSkills = Array.from(
    new Set([...(report.execution_skills ?? []), ...(report.moat_skills ?? [])])
  ).slice(0, 5);

  // Pool = detected (pre-selected) + industry suggestions, deduped, max 14 chips
  const allChips = Array.from(new Set([...detectedSkills, ...industryPool])).slice(0, 14);

  const [selected, setSelected]   = useState<Set<string>>(new Set(detectedSkills));
  const [confirmed, setConfirmed] = useState(false);
  const [fileError, setFileError] = useState('');
  const [gone, setGone]           = useState(false);

  if (gone) return null;

  const dismiss = () => { setGone(true); onDismiss(); };

  const toggle = (skill: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(skill)) { next.delete(skill); }
      else if (next.size < 8) { next.add(skill); }
      return next;
    });
  };

  // ISSUE 1 FIX: dispatch jb:rescan-with-resume which Index.tsx now listens to.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setFileError('PDF only'); return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError('Max 5 MB'); return;
    }
    window.dispatchEvent(new CustomEvent('jb:rescan-with-resume', { detail: { file } }));
    dismiss();
  };

  const handleConfirm = () => {
    window.dispatchEvent(new CustomEvent('jb:skills-confirmed', {
      detail: { skills: Array.from(selected) },
    }));
    setConfirmed(true);
    setTimeout(dismiss, 1800);
  };

  return (
    <AnimatePresence>
      {!gone && (
        <motion.div
          id="improve-accuracy"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.2 } }}
          className="rounded-2xl border-2 border-amber-500/25 bg-amber-500/[0.05] p-5 space-y-4"
        >
          {/* ── Header ── */}
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">
                Industry estimate · personalise your score
              </p>
              <p className="text-sm font-bold text-foreground leading-snug">
                This score reflects your industry average, not your actual skills.
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Resume scan gives a personalised score — typically ±15–20 pts from the estimate.
              </p>
            </div>
            <button
              onClick={dismiss}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!confirmed ? (
            <>
              {/* ── PRIMARY: resume upload ── */}
              <label className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/[0.18] transition-colors cursor-pointer">
                <input
                  type="file"
                  accept=".pdf"
                  className="sr-only"
                  onChange={handleFileChange}
                />
                <Upload className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-amber-300">Upload resume → get your real score</p>
                  <p className="text-[10px] text-muted-foreground">PDF · max 5 MB · most accurate</p>
                </div>
                <span className="flex-shrink-0 text-[10px] font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Best
                </span>
              </label>
              {fileError && (
                <p className="text-xs text-destructive -mt-2 px-1">{fileError}</p>
              )}

              {/* ── SECONDARY: chip picker ── */}
              <div>
                <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
                  Or confirm which skills you actually use — we'll update the analysis:
                </p>
                <div className="flex flex-wrap gap-2">
                  {allChips.map((skill) => {
                    const on = selected.has(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggle(skill)}
                        disabled={!on && selected.size >= 8}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                          on
                            ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                            : 'border-border bg-card text-muted-foreground hover:border-amber-500/30 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed'
                        }`}
                      >
                        {on && <Check className="w-3 h-3 flex-shrink-0" />}
                        {skill}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-muted-foreground">{selected.size}/8 selected</span>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={selected.size === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black border border-border bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Confirm skills
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 py-1"
            >
              <div className="w-8 h-8 rounded-full bg-prophet-green/20 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-prophet-green" />
              </div>
              <div>
                <p className="text-sm font-bold text-prophet-green">Skills saved</p>
                <p className="text-xs text-muted-foreground">
                  Upload your resume anytime for a fully personalised rescan
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

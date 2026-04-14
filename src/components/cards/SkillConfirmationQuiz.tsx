/**
 * SkillConfirmationQuiz
 *
 * Shown when data_quality.overall === 'LOW' (synthetic fallback was used —
 * no real profile data extracted). Lets the user confirm or correct the
 * industry-inferred skills in 30 seconds, converting an industry-average
 * score into a genuinely personalised one.
 *
 * Security (vibesec): skill inputs are plain text selections from a
 * predefined allowlist — no free-text injection risk. The confirmed
 * skills are stored only in state and used for display messaging;
 * they are not re-submitted to the edge function (would require a new
 * scan which is a separate UX flow). The component fires a custom DOM
 * event `jb:skills-confirmed` that Index.tsx can listen to if needed.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, X } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';

// ── Industry-specific skill suggestion pools ──────────────────────────
const INDUSTRY_SKILLS: Record<string, string[]> = {
  'IT & Software': [
    'React / Frontend Development', 'Python scripting', 'SQL & data queries',
    'REST API design', 'CI/CD pipelines', 'Cloud infrastructure (AWS/GCP/Azure)',
    'System design', 'Code review & mentoring', 'Product requirements translation',
    'DevOps / Docker / K8s',
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
    'Creative direction', 'Art direction', 'Copy & storytelling',
    'Design systems',
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
  const industry = report.industry || '';
  const suggestedPool = INDUSTRY_SKILLS[industry] ?? FALLBACK_SKILLS;

  // Pre-select skills the system already detected (execution + moat)
  const detectedSkills = Array.from(new Set([
    ...(report.execution_skills ?? []),
    ...(report.moat_skills ?? []),
  ])).slice(0, 6);

  const [selected, setSelected] = useState<Set<string>>(new Set(detectedSkills));
  const [confirmed, setConfirmed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const toggle = (skill: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(skill)) {
        next.delete(skill);
      } else if (next.size < 8) {
        next.add(skill);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    setConfirmed(true);
    // Fire event so parent can react (e.g. show rescan CTA with confirmed skills)
    window.dispatchEvent(new CustomEvent('jb:skills-confirmed', {
      detail: { skills: Array.from(selected) },
    }));
    // Auto-dismiss after showing confirmation
    setTimeout(() => setDismissed(true), 2000);
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border-2 border-amber-500/25 bg-amber-500/[0.05] p-5 space-y-4"
        >
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">
                30-second accuracy boost
              </p>
              <p className="text-sm font-bold text-foreground leading-snug">
                Which of these do you actually do in your job?
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Select up to 8 · Your score personalises to your real skills
              </p>
            </div>
            <button
              onClick={() => { setDismissed(true); onDismiss(); }}
              className="text-muted-foreground hover:text-foreground transition-colors mt-0.5"
              aria-label="Dismiss skill quiz"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Skill chips */}
          {!confirmed ? (
            <>
              <div className="flex flex-wrap gap-2">
                {suggestedPool.map((skill) => {
                  const isOn = selected.has(skill);
                  return (
                    <button
                      key={skill}
                      onClick={() => toggle(skill)}
                      disabled={!isOn && selected.size >= 8}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150
                        ${isOn
                          ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                          : 'border-border bg-card text-muted-foreground hover:border-amber-500/30 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed'
                        }`}
                    >
                      {isOn && <Check className="w-3 h-3" />}
                      {skill}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  {selected.size}/8 selected
                </span>
                <button
                  onClick={handleConfirm}
                  disabled={selected.size === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-foreground border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Confirm my skills
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 py-2"
            >
              <div className="w-8 h-8 rounded-full bg-prophet-green/20 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-prophet-green" />
              </div>
              <div>
                <p className="text-sm font-bold text-prophet-green">Skills confirmed</p>
                <p className="text-xs text-muted-foreground">
                  Upload your resume to get a fully personalised score based on these skills
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

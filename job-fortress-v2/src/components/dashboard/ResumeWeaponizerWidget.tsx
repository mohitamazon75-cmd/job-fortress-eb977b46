import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Copy, Check, Loader2, ChevronDown, ChevronUp, Zap, Shield, AlertTriangle, Target, Sparkles, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { type ScanReport } from '@/lib/scan-engine';
import { toast } from 'sonner';

interface ResumeWeaponizerWidgetProps {
  report: ScanReport;
  scanId?: string;
}

interface WeaponizedResume {
  professional_summary: string;
  key_skills_section: {
    headline_skills: string[];
    strategic_keywords: string[];
    skills_to_remove: string[];
  };
  experience_bullets: Array<{
    context: string;
    original_framing: string;
    weaponized_bullet: string;
    annotation?: string;
    why_better: string;
  }>;
  new_sections_to_add: Array<{
    section_title: string;
    why: string;
    sample_entries: string[];
  }>;
  ats_optimization: {
    score_estimate_before: number;
    score_estimate_after: number;
    critical_keywords_added: string[];
    format_tips: string[];
  };
  positioning_strategy: string;
  cover_letter_hook: string;
}

export default function ResumeWeaponizerWidget({ report, scanId }: ResumeWeaponizerWidgetProps) {
  const [data, setData] = useState<WeaponizedResume | null>(null);
  const [loading, setLoading] = useState(false);
  const [targetRole, setTargetRole] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string>('summary');
  const [showAnnotations, setShowAnnotations] = useState(() => {
    try {
      return localStorage.getItem('jb_show_annotations') !== 'false';
    } catch {
      return true;
    }
  });

  const role = report.role || 'Professional';
  const pivotRoles = ((report as any).pivot_roles || []).slice(0, 3);

  const fetchWeaponized = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('resume-weaponizer', {
        body: { report, scanId, targetRole: targetRole || undefined },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (err: any) {
      console.error('[ResumeWeaponizer] Error:', err);
      if (err?.message?.includes('429') || err?.status === 429) {
        toast.error('Rate limited — please try again in a minute');
      } else if (err?.message?.includes('402') || err?.status === 402) {
        toast.error('AI credits exhausted — contact support');
      } else {
        toast.error('Failed to weaponize resume');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleAnnotations = () => {
    const newValue = !showAnnotations;
    setShowAnnotations(newValue);
    try {
      localStorage.setItem('jb_show_annotations', String(newValue));
    } catch {}
  };

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <button
      onClick={() => copyToClipboard(text, id)}
      className="flex-shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
      title="Copy"
    >
      {copiedId === id ? <Check className="w-3.5 h-3.5 text-prophet-green" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  );

  if (!data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border-2 border-dashed border-destructive/30 bg-destructive/[0.02] p-6"
      >
        <div className="text-center mb-4">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="text-base font-black text-foreground mb-1">Resume Weaponizer</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            AI rewrites your resume to exploit the exact gaps your scan found. Optimized for ATS systems and hiring managers.
          </p>
        </div>

        {/* Optional target role */}
        <div className="max-w-sm mx-auto mb-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">
            Target role (optional)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder={`e.g. Senior ${role}`}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {pivotRoles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {pivotRoles.map((p: any, i: number) => {
                const name = typeof p === 'string' ? p : (p.role || p.label || '');
                return name ? (
                  <button
                    key={i}
                    onClick={() => setTargetRole(name)}
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                  >
                    {name}
                  </button>
                ) : null;
              })}
            </div>
          )}
        </div>

        <div className="text-center">
          <button
            onClick={fetchWeaponized}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-foreground text-background font-bold text-sm hover:bg-foreground/90 transition-all disabled:opacity-50 min-h-[44px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Rewriting your resume...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Weaponize My Resume
              </>
            )}
          </button>
        </div>
      </motion.div>
    );
  }

  const { professional_summary, key_skills_section, experience_bullets, new_sections_to_add, ats_optimization, positioning_strategy, cover_letter_hook } = data;

  const sections = [
    { id: 'summary', label: 'Professional Summary', icon: Target },
    { id: 'skills', label: 'Skills Strategy', icon: Zap },
    { id: 'bullets', label: 'Experience Bullets', icon: FileText },
    { id: 'sections', label: 'New Sections', icon: Shield },
    { id: 'ats', label: 'ATS Score', icon: Sparkles },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-destructive/10">
          <FileText className="w-4 h-4 text-destructive" />
        </div>
        <div>
          <h3 className="text-sm font-black text-foreground uppercase tracking-tight">Resume Weaponizer</h3>
          <p className="text-[10px] text-muted-foreground">
            Targeting: {targetRole || role} · ATS-optimized
          </p>
        </div>
      </div>

      {/* ATS Score Comparison — Hero */}
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="rounded-2xl border-2 border-prophet-green/30 bg-gradient-to-r from-destructive/[0.04] via-transparent to-prophet-green/[0.06] p-5"
      >
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3 text-center">ATS Score Transformation</p>
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-3xl font-black text-destructive">{ats_optimization.score_estimate_before}</p>
            <p className="text-[11px] font-bold text-muted-foreground">Before</p>
          </div>
          <ArrowRight className="w-6 h-6 text-primary" />
          <div className="text-center">
            <p className="text-3xl font-black text-prophet-green">{ats_optimization.score_estimate_after}</p>
            <p className="text-[11px] font-bold text-muted-foreground">After</p>
          </div>
          <div className="text-center ml-2">
            <p className="text-2xl font-black text-primary">+{ats_optimization.score_estimate_after - ats_optimization.score_estimate_before}</p>
            <p className="text-[11px] font-bold text-muted-foreground">Points</p>
          </div>
        </div>
      </motion.div>

      {/* Strategy */}
      {positioning_strategy && (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.03] px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-primary mb-1">Positioning Strategy</p>
          <p className="text-sm text-foreground/80 leading-relaxed">{positioning_strategy}</p>
        </div>
      )}

      {/* Accordion sections */}
      <div className="rounded-2xl border-2 border-border bg-card overflow-hidden">
        {sections.map(({ id, label, icon: Icon }) => {
          const isOpen = expandedSection === id;
          return (
            <div key={id} className="border-b border-border last:border-b-0">
              <button
                onClick={() => setExpandedSection(isOpen ? '' : id)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">{label}</span>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 space-y-3">
                      {/* Summary */}
                      {id === 'summary' && (
                        <div className="rounded-xl border border-border bg-muted/20 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-foreground leading-relaxed flex-1">{professional_summary}</p>
                            <CopyBtn text={professional_summary} id="summary" />
                          </div>
                        </div>
                      )}

                      {/* Skills */}
                      {id === 'skills' && (
                        <>
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-prophet-green mb-1.5">Headline Skills (Feature These)</p>
                            <div className="flex flex-wrap gap-1.5">
                              {key_skills_section.headline_skills.map((s, i) => (
                                <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-lg border border-prophet-green/20 bg-prophet-green/10 text-prophet-green">{s}</span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-primary mb-1.5">Strategic Keywords (Weave Throughout)</p>
                            <div className="flex flex-wrap gap-1.5">
                              {key_skills_section.strategic_keywords.map((s, i) => (
                                <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-lg border border-primary/20 bg-primary/10 text-primary">{s}</span>
                              ))}
                            </div>
                          </div>
                          {key_skills_section.skills_to_remove.length > 0 && (
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-widest text-destructive mb-1.5">Remove These Skills</p>
                              {key_skills_section.skills_to_remove.map((s, i) => (
                                <p key={i} className="text-xs text-destructive/70 flex items-start gap-1.5 mb-1">
                                  <span className="mt-0.5">✗</span> {s}
                                </p>
                              ))}
                            </div>
                          )}
                          <CopyBtn
                            text={`HEADLINE: ${key_skills_section.headline_skills.join(', ')}\nKEYWORDS: ${key_skills_section.strategic_keywords.join(', ')}`}
                            id="skills"
                          />
                        </>
                      )}

                      {/* Bullets */}
                      {id === 'bullets' && (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <button
                              onClick={toggleAnnotations}
                              className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
                            >
                              {showAnnotations ? 'Hide Reasoning' : 'Show Reasoning'}
                            </button>
                          </div>
                          <div className="space-y-3">
                            {experience_bullets.map((bullet, i) => (
                              <div key={i} className="rounded-xl border border-border bg-background p-3 space-y-2">
                                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{bullet.context}</p>
                                <div className="flex items-start gap-2">
                                  <span className="text-destructive text-xs mt-0.5">✗</span>
                                  <p className="text-xs text-muted-foreground line-through flex-1">{bullet.original_framing}</p>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-prophet-green text-xs mt-0.5">✓</span>
                                  <p className="text-xs text-foreground font-medium flex-1">{bullet.weaponized_bullet}</p>
                                  <CopyBtn text={bullet.weaponized_bullet} id={`bullet-${i}`} />
                                </div>
                                {showAnnotations && bullet.annotation && (
                                  <p className="text-xs text-muted-foreground italic pl-5">Why: {bullet.annotation}</p>
                                )}
                                <p className="text-[11px] text-primary/70 pl-5">↳ {bullet.why_better}</p>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* New Sections */}
                      {id === 'sections' && (
                        <div className="space-y-3">
                          {new_sections_to_add.map((sec, i) => (
                            <div key={i} className="rounded-xl border border-primary/15 bg-primary/[0.03] p-3">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-black text-foreground">{sec.section_title}</p>
                                <CopyBtn text={`${sec.section_title}\n${sec.sample_entries.join('\n')}`} id={`section-${i}`} />
                              </div>
                              <p className="text-[10px] text-primary mb-2">{sec.why}</p>
                              <ul className="space-y-1">
                                {sec.sample_entries.map((entry, j) => (
                                  <li key={j} className="text-xs text-foreground/80 flex items-start gap-1.5">
                                    <span className="text-primary mt-0.5">▸</span> {entry}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ATS */}
                      {id === 'ats' && (
                        <>
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-prophet-green mb-1.5">Critical Keywords Added</p>
                            <div className="flex flex-wrap gap-1.5">
                              {ats_optimization.critical_keywords_added.map((k, i) => (
                                <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-prophet-green/20 bg-prophet-green/10 text-prophet-green">{k}</span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Format Rules</p>
                            <ul className="space-y-1">
                              {ats_optimization.format_tips.map((tip, i) => (
                                <li key={i} className="text-xs text-foreground/70 flex items-start gap-1.5">
                                  <span className="text-primary mt-0.5">•</span> {tip}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Cover Letter Hook */}
      {cover_letter_hook && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-1">Cover Letter Opening Line</p>
              <p className="text-sm text-foreground italic leading-relaxed">"{cover_letter_hook}"</p>
            </div>
            <CopyBtn text={cover_letter_hook} id="hook" />
          </div>
        </div>
      )}

      {/* Copy All */}
      <button
        onClick={() => {
          const fullText = [
            `PROFESSIONAL SUMMARY:\n${professional_summary}`,
            `\nHEADLINE SKILLS: ${key_skills_section.headline_skills.join(', ')}`,
            `\nSTRATEGIC KEYWORDS: ${key_skills_section.strategic_keywords.join(', ')}`,
            `\nEXPERIENCE BULLETS:`,
            ...experience_bullets.map(b => `• ${b.weaponized_bullet}`),
            `\nNEW SECTIONS:`,
            ...new_sections_to_add.map(s => `[${s.section_title}]\n${s.sample_entries.join('\n')}`),
            `\nCOVER LETTER HOOK: ${cover_letter_hook}`,
          ].join('\n');
          copyToClipboard(fullText, 'all');
        }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-border bg-card text-foreground font-bold text-sm hover:bg-muted transition-all min-h-[44px]"
      >
        {copiedId === 'all' ? <><Check className="w-4 h-4 text-prophet-green" /> Copied Everything</> : <><Copy className="w-4 h-4" /> Copy All Resume Content</>}
      </button>
    </motion.div>
  );
}

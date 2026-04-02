import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, AlertTriangle, Zap, Loader2, Copy, Check, ChevronDown, FileText, Lock, Target, Cpu } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { supabase } from '@/integrations/supabase/client';
import ProUpgradeModal from '@/components/ProUpgradeModal';

interface ResumeData {
  professional_summary?: string;
  key_skills_section?: {
    headline_skills?: string[];
    skills_to_remove?: string[];
  };
  experience_bullets?: Array<{
    weaponized_bullet: string;
    why_better: string;
  }>;
  ats_optimization?: {
    score_estimate_before?: number;
    score_estimate_after?: number;
    critical_keywords_added?: string[];
    format_tips?: string[];
  };
  cover_letter_hook?: string;
}

export default function ResumeWeaponizerCard({ report, scanId }: { report: ScanReport; scanId?: string }) {
  const [data, setData] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState('');
  const [expandedSection, setExpandedSection] = useState<string>('summary');

  const role = report.role || 'Professional';

  const REFINEMENT_ANGLES = [
    { label: 'Make it more senior', angle: 'senior' },
    { label: 'Focus on leadership', angle: 'leadership' },
    { label: 'Switching industries', angle: 'career-change' },
  ];

  const fetchWeaponized = async (angle?: string) => {
    setLoading(true);
    setError(null);
    setShowUpgrade(false);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('resume-weaponizer', {
        body: { report, scanId, targetRole: targetRole || undefined, angle: angle || undefined },
      });

      if (err) {
        // Detect Pro gate: check HTTP status (402) or error message markers
        const msg = (err as Error)?.message || '';
        const status = (err as any)?.context?.status;
        const isProGate =
          status === 402 ||
          msg.includes('SUBSCRIPTION_REQUIRED') ||
          msg.includes('subscription required') ||
          msg.toLowerCase().includes('non-2xx'); // catch-all: this fn is Pro-only, any error → upgrade
        if (isProGate) {
          setShowUpgrade(true);
          return;
        }
        throw err;
      }
      // Edge function returned 200 but with a pro-required marker
      if ((result as any)?.code === 'SUBSCRIPTION_REQUIRED') {
        setShowUpgrade(true);
        return;
      }
      if (result?.error) throw new Error(result.error);
      setData(result as ResumeData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <button onClick={() => copyToClipboard(text, id)} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors" title="Copy">
      {copiedId === id ? <Check className="w-3.5 h-3.5 text-prophet-green" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  );

  // ── Pro gate: show upgrade teaser ────────────────────────────
  if (showUpgrade) {
    return (
      <>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border-2 border-primary/30 bg-primary/[0.04] p-5 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">Pro Feature</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              ATS Resume Rewrite is a Pro feature. Unlock it to get your resume rewritten specifically against the automation threats found in your scan.
            </p>
          </div>
          <div className="space-y-1.5 text-left max-w-xs mx-auto">
            {[
              'Counters your exact automation threats',
              'Injects ATS-critical keywords from your scan',
              'STAR format experience bullets',
              'Cover letter opening hook',
            ].map(f => (
              <div key={f} className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-prophet-green flex-shrink-0" />
                <span className="text-xs text-foreground/80">{f}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowProModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm hover:bg-primary/90 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Unlock Pro — from ₹300/mo
          </button>
          <p className="text-[11px] text-muted-foreground">
            One upgrade · unlocks all 4 Pro cards in this report
          </p>
        </motion.div>
        <ProUpgradeModal
          isOpen={showProModal}
          onClose={() => setShowProModal(false)}
          onSuccess={() => { setShowProModal(false); setShowUpgrade(false); fetchWeaponized(); }}
        />
      </>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border-2 border-destructive/20 bg-destructive/[0.03] p-5 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">Strengthen Your Resume</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Our scan identified skills in your profile that AI is beginning to replicate. Let AI rewrite your resume to highlight your <span className="text-prophet-green font-bold">human moats</span> and pass ATS filters.
            </p>
          </div>
          <div className="max-w-xs mx-auto">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block text-left">
              Target role (optional)
            </label>
            <input type="text" value={targetRole} onChange={(e) => setTargetRole(e.target.value)}
              placeholder={`e.g. Senior ${role}`}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3" />
          </div>
          <button onClick={() => fetchWeaponized()} disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-destructive text-destructive-foreground font-black text-sm hover:bg-destructive/90 transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? 'Rewriting...' : 'Weaponize My Resume'}
          </button>
        </motion.div>
        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-center">
            <p className="text-xs text-destructive">{error}</p>
            <button onClick={() => fetchWeaponized()} className="text-xs font-bold text-primary hover:underline mt-1">Try Again</button>
          </div>
        )}
      </div>
    );
  }

  const ats = data.ats_optimization;
  const sections = [
    { id: 'summary', label: 'Professional Summary', icon: FileText, content: data.professional_summary },
    { id: 'skills', label: 'Optimized Skills Section', icon: Target },
    { id: 'bullets', label: 'STAR Experience Bullets', icon: Zap },
    { id: 'ats', label: 'ATS Score Transformation', icon: Cpu },
  ];

  return (
    <div className="space-y-3">
      {ats && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border-2 border-prophet-green/30 bg-prophet-green/[0.05] p-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-prophet-green/70 mb-2">Estimated keyword match range</p>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-lg font-bold text-destructive">~{ats.score_estimate_before}%</p>
              <p className="text-[11px] text-muted-foreground">Before</p>
            </div>
            <ArrowRight className="w-5 h-5 text-prophet-green" />
            <div className="text-center">
              <p className="text-lg font-bold text-prophet-green">~{Math.max(ats.score_estimate_after - 5, 0)}–{Math.min(ats.score_estimate_after + 5, 100)}%</p>
              <p className="text-[11px] text-muted-foreground">After</p>
            </div>
          </div>
          {/* Credibility: ATS "score" is a keyword match estimate — individual ATS systems vary */}
          <p className="text-[11px] text-muted-foreground italic text-center mt-2">
            Varies by ATS system and job description
          </p>
          {(ats.critical_keywords_added?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {ats.critical_keywords_added!.slice(0, 6).map((kw: string, i: number) => (
                <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-prophet-green/10 text-prophet-green border border-prophet-green/20">+{kw}</span>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {sections.map((section, i) => {
        const Icon = section.icon;
        return (
        <motion.div key={section.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.12, duration: 0.4 }}
          className="rounded-xl border-2 border-border bg-card overflow-hidden">
          <button onClick={() => setExpandedSection(expandedSection === section.id ? '' : section.id)}
            className="w-full flex items-center justify-between p-3 text-left">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-foreground">{section.label}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedSection === section.id ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {expandedSection === section.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4 }} className="overflow-hidden">
                <div className="px-3 pb-3 space-y-2">
                  {section.id === 'summary' && data.professional_summary && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <p className="text-sm leading-relaxed flex-1 bg-muted/30 rounded-lg p-3 border-l-2 border-primary/30 pl-3 text-foreground/80">{data.professional_summary}</p>
                        <CopyBtn text={data.professional_summary} id="summary" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <p className="text-[11px] text-muted-foreground w-full">Didn't land right?</p>
                        {REFINEMENT_ANGLES.map(({ label, angle }) => (
                          <button
                            key={angle}
                            onClick={() => fetchWeaponized(angle)}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-border bg-card hover:border-primary/30 hover:text-primary transition-colors"
                            disabled={loading}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {section.id === 'skills' && data.key_skills_section && (
                    <div className="space-y-2">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-prophet-green/80 mb-1">✓ Add These</p>
                        <div className="flex flex-wrap gap-1">
                          {(data.key_skills_section.headline_skills || []).map((s: string, i: number) => (
                            <span key={i} className="text-xs font-bold px-2 py-0.5 rounded-full border border-prophet-green/20 bg-prophet-green/5 text-prophet-green">{s}</span>
                          ))}
                        </div>
                      </div>
                      {(data.key_skills_section.skills_to_remove?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-widest text-destructive/80 mb-1">✗ Remove These</p>
                          <div className="flex flex-wrap gap-1">
                            {data.key_skills_section.skills_to_remove!.map((s: string, i: number) => (
                              <span key={i} className="text-xs font-bold px-2 py-0.5 rounded-full border border-destructive/20 bg-destructive/5 text-destructive line-through">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {section.id === 'bullets' && (data.experience_bullets?.length ?? 0) > 0 && (
                    <div className="space-y-2">
                      {data.experience_bullets?.slice(0, 4).map((b, i: number) => (
                        <div key={i} className="rounded-lg bg-muted/40 p-2.5 space-y-1">
                          <div className="flex justify-between items-start gap-2">
                            <p className="text-[11px] text-foreground font-bold leading-relaxed flex-1">{b.weaponized_bullet}</p>
                            <CopyBtn text={b.weaponized_bullet} id={`bullet-${i}`} />
                          </div>
                          <p className="text-[11px] text-muted-foreground italic">💡 {b.why_better}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {section.id === 'ats' && ats && (
                    <div className="space-y-2">
                      {ats.format_tips?.map((tip: string, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-prophet-green text-xs mt-0.5">✓</span>
                          <p className="text-[11px] text-foreground/80">{tip}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        );
      })}

      {data.cover_letter_hook && (
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-1">Cover Letter Opening Hook</p>
              <p className="text-[11px] text-foreground/80 italic leading-relaxed">{data.cover_letter_hook}</p>
            </div>
            <CopyBtn text={data.cover_letter_hook} id="hook" />
          </div>
        </div>
      )}
    </div>
  );
}

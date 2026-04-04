/**
 * DoomClockCard — high-impact viral hook card (v2)
 *
 * Redesigned: single view with AI Proximity gauge, rich per-skill insights,
 * and action tags. No more triple-repetition of the same data.
 * Share card is generated on-demand only.
 */
import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Download, Zap, MessageCircle, Shield, Target, Clock, ArrowRight, Bot, Brain, Building2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { classifySkills, type ClassifiedSkill } from '@/lib/unified-skill-classifier';
import CohortInsightBadge from '@/components/cards/CohortInsightBadge';
import { useTrack } from '@/hooks/use-track';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  report: ScanReport;
  scanId?: string;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function monthsLabel(m: number): { text: string; urgency: 'critical' | 'high' | 'medium' | 'low' } {
  if (m <= 6)  return { text: '< 6 months',  urgency: 'critical' };
  if (m <= 12) return { text: '~1 year',     urgency: 'high' };
  if (m <= 24) return { text: '~2 years',    urgency: 'medium' };
  if (m <= 36) return { text: '~3 years',    urgency: 'medium' };
  return       { text: '3+ years',           urgency: 'low' };
}

function urgencyConfig(u: 'critical' | 'high' | 'medium' | 'low') {
  switch (u) {
    case 'critical': return { bg: 'bg-destructive/10', border: 'border-destructive/25', text: 'text-destructive', dot: 'bg-destructive', glow: 'shadow-destructive/20' };
    case 'high':     return { bg: 'bg-prophet-red/8', border: 'border-prophet-red/20', text: 'text-prophet-red', dot: 'bg-prophet-red', glow: 'shadow-prophet-red/15' };
    case 'medium':   return { bg: 'bg-prophet-gold/8', border: 'border-prophet-gold/20', text: 'text-prophet-gold', dot: 'bg-prophet-gold', glow: 'shadow-prophet-gold/15' };
    case 'low':      return { bg: 'bg-muted/50', border: 'border-border', text: 'text-muted-foreground', dot: 'bg-muted-foreground', glow: '' };
  }
}

/** Strip control characters and limit length for safe rendering */
function sanitize(str: string, maxLen = 60): string {
  return str
    .replace(/[\x00-\x1f\x7f\r\n\t]/g, ' ')
    .replace(/[<>"']/g, '')
    .trim()
    .substring(0, maxLen);
}

function safeFileName(str: string): string {
  return str.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase().substring(0, 50) || 'career';
}

/** Compute overall AI proximity percentage from at-risk skills */
function computeAIProximity(skills: ClassifiedSkill[]): number {
  if (skills.length === 0) return 0;
  const atRisk = skills.filter(s => s.status !== 'safe');
  if (atRisk.length === 0) return 5;
  const avgRisk = atRisk.reduce((sum, s) => sum + s.risk, 0) / atRisk.length;
  const coverageWeight = Math.min(1, atRisk.length / skills.length);
  return Math.round(avgRisk * coverageWeight);
}

// ── AI Proximity Gauge ──────────────────────────────────────────────────────
function ProximityGauge({ value }: { value: number }) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const isHigh = clampedValue >= 60;
  const isMedium = clampedValue >= 35;

  return (
    <div className="relative">
      {/* Background track */}
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clampedValue}%` }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          className={`h-full rounded-full ${
            isHigh ? 'bg-gradient-to-r from-prophet-gold to-destructive' :
            isMedium ? 'bg-gradient-to-r from-prophet-green to-prophet-gold' :
            'bg-prophet-green'
          }`}
        />
      </div>
      {/* Labels */}
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-prophet-green font-semibold">Low AI overlap</span>
        <span className="text-[10px] text-destructive font-semibold">High AI overlap</span>
      </div>
    </div>
  );
}

// ── Tool Learning Resource type ──────────────────────────────────────────────
interface ToolResource {
  title: string;
  url: string;
  time_estimate: string;
  type: 'course' | 'video' | 'docs';
}

interface ToolLearningData {
  tool_description?: string;
  resources?: ToolResource[];
  top_credential?: { name: string; url: string; value: string };
  weekend_project?: { title: string; description: string };
  citations?: string[];
}

// ── Skill Threat Row — enriched with threat intel + smart tool learning ──────
function SkillThreatRow({ skill, index }: { skill: ClassifiedSkill; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [toolExpanded, setToolExpanded] = useState(false);
  const [learningData, setLearningData] = useState<ToolLearningData | null>(null);
  const [learningLoading, setLearningLoading] = useState(false);
  const [learningError, setLearningError] = useState(false);
  const ml = monthsLabel(skill.estimatedMonths);
  const uc = urgencyConfig(ml.urgency);
  const intel = skill.threatIntel;
  const hasIntel = !!intel;
  const toolName = intel?.threat_tool || skill.replacedBy || null;

  const fetchLearningResources = useCallback(async () => {
    if (!toolName || learningData) return;
    setLearningLoading(true);
    setLearningError(false);
    try {
      const { data, error } = await supabase.functions.invoke('tool-learning-resources', {
        body: { tool_name: toolName, skill_name: skill.name },
      });
      if (error) throw error;
      setLearningData(data);
    } catch {
      setLearningError(true);
    } finally {
      setLearningLoading(false);
    }
  }, [toolName, skill.name, learningData]);

  const handleToolExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !toolExpanded;
    setToolExpanded(nextState);
    if (nextState && !learningData && !learningLoading) {
      fetchLearningResources();
    }
  }, [toolExpanded, learningData, learningLoading, fetchLearningResources]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.1 }}
      className={`rounded-xl border ${uc.border} ${uc.bg} overflow-hidden`}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => hasIntel && setExpanded(!expanded)}
        className={`w-full p-4 text-left ${hasIntel ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${uc.dot} flex-shrink-0`} />
              <p className="text-sm font-bold text-foreground leading-tight break-words">{skill.name}</p>
            </div>
            {skill.replacedBy && (
              <p className="text-[11px] text-muted-foreground mt-1 ml-4">
                <span className="font-semibold text-foreground/70">Threatened by:</span> {sanitize(skill.replacedBy, 50)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              <p className={`text-sm font-black ${uc.text}`}>{ml.text}</p>
              <p className="text-[10px] text-muted-foreground">est. window</p>
            </div>
            {hasIntel && (
              expanded
                ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Risk bar */}
        <div className="space-y-1 mt-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">AI automation risk</span>
            <span className={`text-xs font-black ${uc.text}`}>{skill.risk}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${skill.risk}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 + index * 0.1 }}
              className={`h-full rounded-full ${
                skill.risk >= 75 ? 'bg-destructive' :
                skill.risk >= 50 ? 'bg-prophet-gold' :
                'bg-prophet-green'
              }`}
            />
          </div>
        </div>
      </button>

      {/* Expanded threat intel panel */}
      <AnimatePresence>
        {expanded && intel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
              {/* What AI does */}
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-destructive/80 mb-0.5">What AI does today</p>
                  <p className="text-xs text-foreground/90 leading-relaxed">{intel.what_ai_does}</p>
                </div>
              </div>

              {/* What human still owns */}
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-prophet-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Brain className="w-3.5 h-3.5 text-prophet-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-prophet-green/80 mb-0.5">Your human edge</p>
                  <p className="text-xs text-foreground/90 leading-relaxed">{intel.what_human_still_owns}</p>
                </div>
              </div>

              {/* Industry proof */}
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-prophet-gold/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-prophet-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-prophet-gold/80 mb-0.5">Industry evidence</p>
                  <p className="text-xs text-foreground/90 leading-relaxed italic">{intel.industry_proof}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action tag — clickable expandable tool learning section */}
      <div className="px-4 pb-3">
        {toolName && skill.risk >= 40 ? (
          <div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setToolExpanded(!toolExpanded); }}
              className="flex items-center gap-2 w-full text-left group hover:opacity-80 transition-opacity"
            >
              <ArrowRight className="w-3 h-3 text-primary flex-shrink-0" />
              <p className="text-[11px] font-semibold text-primary">{skill.actionTag}</p>
              <ChevronDown className={`w-3 h-3 text-primary ml-auto transition-transform ${toolExpanded ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {toolExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 rounded-lg border border-primary/15 bg-primary/[0.03] p-3 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <p className="text-xs font-bold text-foreground">Learn: {toolName}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {skill.risk >= 75
                        ? `${toolName} is actively automating this skill. Learning it makes you the operator, not the replaced.`
                        : `${toolName} augments this skill area. Fluency here makes you 2-3× more productive than peers who ignore it.`
                      }
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(`${toolName} tutorial for ${skill.name} professionals 2026`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-md bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                      >
                        🔍 Find tutorials
                      </a>
                      <a
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${toolName} crash course ${skill.name}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
                      >
                        ▶️ YouTube courses
                      </a>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(`${toolName} official documentation getting started`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-md bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition-colors"
                      >
                        📖 Official docs
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <ArrowRight className="w-3 h-3 text-primary flex-shrink-0" />
            <p className="text-[11px] font-semibold text-primary">{skill.actionTag}</p>
            {hasIntel && !expanded && <span className="text-[9px] text-muted-foreground ml-auto">tap for details</span>}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Capture target (inline styles — html2canvas safe) ────────────────────────
function CaptureTarget({
  innerRef, role, industry, skills, date,
}: {
  innerRef: React.RefObject<HTMLDivElement | null>;
  role: string; industry: string; skills: ClassifiedSkill[]; date: string;
}) {
  return (
    <div
      ref={innerRef as React.RefObject<HTMLDivElement>}
      style={{
        position: 'absolute', left: -9999, top: -9999,
        width: 380,
        background: 'linear-gradient(150deg, #0f172a 0%, #1e1b2e 60%, #0f172a 100%)',
        border: '1.5px solid rgba(99,102,241,0.3)',
        borderRadius: 20, padding: '24px 22px 20px',
        fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif', boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <p style={{ color: '#818cf8', fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>
          ⏳ Career AI Threat Analysis
        </p>
        <p style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 800, margin: '6px 0 0', lineHeight: 1.3 }}>
          {role} · {industry}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        {skills.slice(0, 3).map((skill) => {
          const ml = monthsLabel(skill.estimatedMonths);
          const barColor = skill.risk >= 75 ? '#ef4444' : skill.risk >= 50 ? '#f59e0b' : '#22c55e';
          return (
            <div key={skill.name} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 700, margin: 0 }}>{sanitize(skill.name, 40)}</p>
                  {skill.replacedBy && (
                    <p style={{ color: '#64748b', fontSize: 10, margin: '2px 0 0' }}>→ {sanitize(skill.replacedBy, 40)}</p>
                  )}
                </div>
                <p style={{ color: barColor, fontSize: 13, fontWeight: 900, margin: 0, flexShrink: 0 }}>{ml.text}</p>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${skill.risk}%`, height: '100%', background: barColor, borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <p style={{ color: '#94a3b8', fontSize: 9, fontWeight: 600, margin: 0 }}>{skill.actionTag}</p>
                <p style={{ color: barColor, fontSize: 10, fontWeight: 800, margin: 0 }}>{skill.risk}% risk</p>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 12 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, margin: 0 }}>jobbachao.com</p>
        <p style={{ color: '#475569', fontSize: 10, fontWeight: 500, margin: 0 }}>{date}</p>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function DoomClockCard({ report, scanId }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [shareMode, setShareMode] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const { track } = useTrack(scanId);

  const allSkills = useMemo(() => classifySkills(report), [report]);
  const atRisk = useMemo(() =>
    allSkills
      .filter(s => s.status !== 'safe')
      .sort((a, b) => a.estimatedMonths - b.estimatedMonths),
    [allSkills]
  );

  const topSkills = atRisk.slice(0, 5); // Show up to 5 skills
  const totalAtRisk = atRisk.length;
  const safeCount = allSkills.filter(s => s.status === 'safe').length;
  const aiProximity = computeAIProximity(allSkills);

  const role = sanitize(report.role || 'Professional', 50);
  const industry = sanitize(report.industry || '', 50);
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  useEffect(() => { return () => { mountedRef.current = false }; }, []);

  // ── capture ──
  const handleCapture = useCallback(async () => {
    if (!cardRef.current || capturing) return;
    setCapturing(true);
    setShareError(null);
    try {
      const html2canvas = (await import('html2canvas')).default;
      if (!mountedRef.current) return;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null, scale: 2, useCORS: true, logging: false,
        width: cardRef.current.offsetWidth, height: cardRef.current.offsetHeight,
      });
      if (!mountedRef.current) return;
      setImageUrl(canvas.toDataURL('image/png'));
      setShareMode(true);
    } catch {
      console.error('[DoomClockCard] image capture failed');
      if (!mountedRef.current) return;
      setShareError('Could not generate image. Try again.');
    } finally {
      if (mountedRef.current) setCapturing(false);
    }
  }, [capturing]);

  const handleDownload = useCallback(() => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `ai-threat-${safeFileName(role)}.png`;
    a.click();
  }, [imageUrl, role]);

  const handleWhatsAppShare = useCallback(() => {
    const appUrl = window.location.origin;
    const shareUrl = scanId ? `${appUrl}/share/${scanId}` : appUrl;
    const score = Math.round(report.determinism_index ?? 50);
    const message = encodeURIComponent(
      `I just checked my AI job risk — I scored ${score}/100 on JobBachao 🛡️\n\nAre YOU safe? Check your score free:\n${shareUrl}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer');
    track('whatsapp_share', { score, role, scan_id: scanId });
  }, [report, scanId, track, role]);

  const handleShare = useCallback(async () => {
    if (!imageUrl) return;
    const skillName = sanitize(topSkills[0]?.name || 'My top skill', 60);
    const text = `⚠️ AI Threat Analysis: ${skillName} has ${monthsLabel(topSkills[0]?.estimatedMonths || 24).text} before AI disruption. Check yours → jobbachao.com`;

    if (navigator.share && navigator.canShare) {
      try {
        const blob = await (await fetch(imageUrl)).blob();
        const file = new File([blob], 'ai-threat.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'AI Threat Analysis', text, files: [file] });
          return;
        }
      } catch { /* fall through */ }
    }

    const waText = encodeURIComponent(`${text}\n\n(Save the image & attach it in WhatsApp)`);
    window.open(`https://wa.me/?text=${waText}`, '_blank', 'noopener noreferrer');
  }, [imageUrl, topSkills]);

  // ── no at-risk skills ────────────────────────────────────────────────────
  if (topSkills.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-prophet-green/25 bg-prophet-green/5 p-6 text-center space-y-3"
      >
        <div className="w-12 h-12 rounded-full bg-prophet-green/10 flex items-center justify-center mx-auto">
          <Shield className="w-6 h-6 text-prophet-green" />
        </div>
        <p className="text-base font-black text-prophet-green">No immediate skill threats detected</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your skill profile shows strong AI resilience. Keep building your moat skills.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── AI Proximity Score ── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">AI Proximity Index</p>
              <p className="text-2xl font-black text-foreground">{aiProximity}%</p>
            </div>
          </div>
          <div className="text-right space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              <span className="text-xs font-semibold text-foreground">{totalAtRisk} at risk</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-prophet-green" />
              <span className="text-xs font-semibold text-foreground">{safeCount} safe</span>
            </div>
          </div>
        </div>
        <ProximityGauge value={aiProximity} />
      </motion.div>

      {/* ── Skill Threat Cards ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Skills closest to AI disruption
          </p>
          {topSkills.some(s => s.threatIntel) && (
            <p className="text-[9px] text-primary font-semibold">Tap each for deep analysis ↓</p>
          )}
        </div>
        {topSkills.map((skill, i) => (
          <SkillThreatRow key={`${skill.name}-${i}`} skill={skill} index={i} />
        ))}
      </div>

      {/* ── Share Section ── */}
      <CaptureTarget innerRef={cardRef} role={role} industry={industry} skills={topSkills} date={date} />

      {!shareMode ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={handleCapture}
          disabled={capturing}
          className="w-full py-3.5 rounded-xl border-2 border-primary/20 bg-primary/[0.04] text-primary font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-primary/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-all"
        >
          {capturing ? (
            <>
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              Generating share card…
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              Share Your AI Threat Analysis
            </>
          )}
        </motion.button>
      ) : (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="rounded-xl overflow-hidden border border-border">
              <img src={imageUrl!} alt={`AI threat analysis for ${role}`} className="w-full" />
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <button type="button" onClick={handleDownload}
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl border border-border bg-card text-foreground font-bold text-xs hover:bg-muted/50 transition-colors">
                <Download className="w-3.5 h-3.5" /> Download
              </button>
              <button type="button" onClick={handleWhatsAppShare}
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[#25D366] text-white font-bold text-xs hover:bg-[#20BA5A] transition-colors">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </button>
              <button type="button" onClick={handleShare}
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors">
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {shareError && <p className="text-xs text-destructive text-center">{shareError}</p>}

      {/* Cohort peer comparison */}
      {scanId && <CohortInsightBadge scanId={scanId} variant="doom" />}

      {/* Context footnote */}
      <div className="rounded-xl bg-muted/30 border border-border/50 p-3 flex items-start gap-2">
        <Clock className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Timelines are estimates based on current AI adoption curves for your role and industry.
          Margins vary ±6–18 months depending on skill specificity.
        </p>
      </div>
    </div>
  );
}

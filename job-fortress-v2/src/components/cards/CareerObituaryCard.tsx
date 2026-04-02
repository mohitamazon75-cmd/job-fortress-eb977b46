import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Download, ExternalLink, Loader2, RefreshCw, Share2 } from 'lucide-react';
import { type ScanReport, normalizeTools } from '@/lib/scan-engine';
import { supabase } from '@/integrations/supabase/client';
import { computeStabilityScore } from '@/lib/stability-score';
import PremiumGate from '@/components/PremiumGate';

export interface ObituaryData {
  headline: string;
  subheadline: string;
  dateline: string;
  body: string;
  cause_of_death?: string;
  survived_by?: string;
  epitaph: string;
  generatedAt?: string;
  _fallback?: boolean;
}

interface CareerObituaryCardProps {
  report: ScanReport;
  prefetchedData?: ObituaryData | null;
  prefetchedLoading?: boolean;
}

export default function CareerObituaryCard({ report, prefetchedData, prefetchedLoading }: CareerObituaryCardProps) {
  const [localData, setLocalData] = useState<ObituaryData | null>(null);
  const [localLoading, setLocalLoading] = useState(prefetchedData === undefined);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const clippingRef = useRef<HTMLDivElement>(null);
  const skillAdjustments = report.score_breakdown?.skill_adjustments || [];
  const tools = normalizeTools(report.ai_tools_replacing || []);
  const kgMatched = report.computation_method?.kg_skills_matched ?? skillAdjustments.length;
  const topRiskSkills = [...skillAdjustments].sort((a, b) => b.automation_risk - a.automation_risk).slice(0, 3);

  const prefetchValid = prefetchedData !== undefined && prefetchedData !== null;
  const data = prefetchValid ? prefetchedData : localData;
  const loading = prefetchValid ? false : (prefetchedLoading && prefetchedData === undefined) ? true : localLoading;

  const fetchData = useCallback(async () => {
    if (prefetchValid) return;
    setLocalLoading(true);
    try {
      const allSkills = (report.all_skills && report.all_skills.length > 0)
        ? report.all_skills.slice(0, 8)
        : [...(report.execution_skills_dead || []), ...(report.moat_skills || [])].slice(0, 8);

      const { data: result, error: fnError } = await supabase.functions.invoke('career-obituary', {
        body: {
          role: report.role,
          industry: report.industry,
          city: report.geo_advantage || 'Bengaluru',
          skills: allSkills,
          experience: (report as ScanReport & { years_experience?: string }).years_experience || undefined,
          topRiskSkills: topRiskSkills.map(s => s.skill_name),
          topTools: tools.slice(0, 3).map(t => t.tool_name),
        },
      });
      if (fnError) throw fnError;
      setLocalData(result as ObituaryData);
    } catch (e) {
      console.error('[CareerObituary] fetch error:', e);
      setLocalData({
        headline: `${report.role || 'The Professional'}: A Career Cut Short`,
        subheadline: "Survived by an outdated LinkedIn profile and 47 unread Jira tickets",
        dateline: `${(report.geo_advantage || 'BENGALURU').toUpperCase()}, ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
        body: `The ${report.role || 'Professional'}, once the pride of open-plan offices across India's silicon corridors, was pronounced redundant at approximately 2:47 PM IST, just moments after a quarterly all-hands where the CEO described the company as 'a family.' The cause of death was listed as 'automation,' though close colleagues suspect it was the bell-curve appraisal system that delivered the first wound.\n\nIn its prime, the role was known for its mastery of Excel pivot tables, its ability to sit through three-hour 'synergy alignment' meetings without visible suffering, and its uncanny talent for making PowerPoint decks that said absolutely nothing in 47 slides. These skills, once considered indispensable, were quietly replicated by a ChatGPT prompt costing ₹0.003 per query.\n\nThe role is survived by its three-month notice period, a half-finished Coursera certificate in 'AI for Everyone,' and a motivational quote pinned to its cubicle wall that read 'Adapt or Perish.' It chose neither. In lieu of flowers, the family requests that you update your own LinkedIn headline before it's too late.`,
        epitaph: "Ctrl+Z couldn't undo this one.",
        generatedAt: new Date().toISOString(),
        _fallback: true,
      });
    } finally {
      setLocalLoading(false);
    }
  }, [report, prefetchValid]);

  useEffect(() => {
    let mounted = true;
    const runFetch = async () => {
      try {
        await fetchData();
      } catch (e) {
        if (mounted) console.error(e);
      }
    };
    runFetch();
    return () => { mounted = false };
  }, [fetchData]);

  const handleDownload = async () => {
    if (!clippingRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(clippingRef.current, { backgroundColor: '#f4f0e6', scale: 3, useCORS: true });
      const link = document.createElement('a');
      link.download = `career-obituary-${report.role?.replace(/\s+/g, '-') || 'report'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch { /* silent */ } finally { setDownloading(false); }
  };

  const handleCopy = () => {
    if (!data) return;
    const text = `${data.headline}\n${data.subheadline}\n\n${data.body}\n\nEpitaph: "${data.epitaph}"\n\nGenerated by Job Bachao — ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!data) return;
    const text = `💀 Career Obituary: ${data.headline}\n\n"${data.epitaph}"\n\nGet your own: ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareTwitter = () => {
    if (!data) return;
    const text = `💀 "${data.epitaph}"\n\nMy AI career obituary hit different. Get yours free:`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.origin)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground font-medium">Writing your career obituary...</p>
      </div>
    );
  }
  if (!data) return null;

  const today = new Date();
  const volNum = `Vol. ${today.getFullYear() - 2000}, No. ${Math.floor(today.getMonth() * 30 + today.getDate())}`;
  const paragraphs = data.body.split('\n\n').filter(Boolean);
  const survivedItems = data.survived_by ? data.survived_by.split(/[;,]/).map(s => s.trim()).filter(Boolean) : [];

  // Prepare preview lines for the gate
  const previewLines = [
    `💀 ${data.headline}`,
    data.subheadline,
    `"${data.epitaph}"`,
  ];

  return (
    <PremiumGate featureId="career-obituary" previewLines={previewLines}>
      <div className="space-y-4">
      {topRiskSkills.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-destructive/15 bg-destructive/[0.03] p-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-destructive/60 mb-1.5">Skills that wrote this obituary</p>
          <div className="flex flex-wrap gap-1.5">
            {topRiskSkills.map((s, i) => (
              <span key={`risk-skill-${i}-${s.skill_name.slice(0, 15)}`} className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-destructive/20 bg-destructive/10 text-destructive">
                {s.skill_name} · {s.automation_risk}%
              </span>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, type: 'spring', damping: 25 }}>
        <div ref={clippingRef} className="obituary-container">
          <div className="obituary-masthead">
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="obituary-meta">Regd. No. DL(ND)-11/6000/2024-25-26</span>
              <span className="obituary-meta">{volNum}</span>
            </div>
            <div className="obituary-masthead-title">THE CAREER TIMES</div>
            <div className="flex items-center justify-between px-4 py-1">
              <span className="obituary-meta">{today.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
              <span className="obituary-meta">OBITUARIES · PAGE 7</span>
            </div>
            <div className="obituary-single-rule" />
          </div>

          <div className="obituary-section-marker">
            <span>✝</span>
            <span className="mx-2 tracking-[0.3em]">OBITUARY</span>
            <span>✝</span>
          </div>

          <div className="px-5 sm:px-8 pt-3 pb-2">
            <h2 className="obituary-headline">{data.headline}</h2>
            <p className="obituary-subheadline">{data.subheadline}</p>
          </div>

          <div className="obituary-thin-rule mx-5 sm:mx-8" />

          <div className="px-5 sm:px-8 py-4">
            <p className="obituary-dateline">{data.dateline}</p>
            <div className="obituary-body-columns">
              {paragraphs.map((p, i) => (
                <p key={`para-${i}-${String(p).slice(0, 15)}`} className={i === 0 ? 'obituary-first-para' : 'obituary-para'}>{p}</p>
              ))}
            </div>
          </div>

          {data.cause_of_death && (
            <div className="obituary-cause-box mx-5 sm:mx-8">
              <span className="obituary-cause-label">CAUSE OF DEATH:</span>
              <span className="obituary-cause-text">{data.cause_of_death}</span>
            </div>
          )}

          {survivedItems.length > 0 && (
            <div className="px-5 sm:px-8 py-3">
              <p className="obituary-survived-label">SURVIVED BY:</p>
              <ul className="obituary-survived-list">
                {survivedItems.map((item, i) => (<li key={`survived-${i}-${String(item).slice(0, 15)}`}>{item}</li>))}
              </ul>
            </div>
          )}

          <div className="obituary-thin-rule mx-5 sm:mx-8" />

          <div className="px-5 sm:px-8 py-4 text-center">
            <p className="obituary-epitaph-label">EPITAPH</p>
            <p className="obituary-epitaph">"{data.epitaph}"</p>
          </div>

          <div className="px-5 sm:px-8 pb-3 text-center">
            <span className="obituary-watermark">Generated by RiskIQ · jobbachao.com</span>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="space-y-2">
        <button onClick={handleShareWhatsApp}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all min-h-[52px]"
          style={{ backgroundColor: '#25D366', color: '#fff' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Share on WhatsApp
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button onClick={handleDownload} disabled={downloading}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-border bg-card text-foreground font-bold text-xs hover:bg-muted transition-all min-h-[48px]">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloading ? 'Saving...' : 'Save PNG'}
          </button>
          <button onClick={handleShareTwitter}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-border bg-card text-foreground font-bold text-xs hover:bg-muted transition-all min-h-[48px]">
            <ExternalLink className="w-4 h-4" /> Twitter/X
          </button>
          <button onClick={handleCopy}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-border bg-card text-foreground font-bold text-xs hover:bg-muted transition-all min-h-[48px]">
            {copied ? <><Check className="w-4 h-4 text-prophet-green" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
          </button>
        </div>
      </motion.div>

      {data._fallback && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <button onClick={fetchData}
            className="w-full text-center text-xs font-bold text-primary flex items-center justify-center gap-1.5 py-2 hover:underline">
            <RefreshCw className="w-3 h-3" /> Generate personalized obituary
          </button>
        </motion.div>
      )}

      <p className="text-[11px] text-muted-foreground text-center">
        📊 Based on <span className="font-bold">{kgMatched} KG-matched skills</span> · {tools.length} AI tools in your threat profile · Score: {computeStabilityScore(report)}/100
      </p>
      </div>
    </PremiumGate>
  );
}

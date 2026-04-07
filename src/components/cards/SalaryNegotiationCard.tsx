import { motion } from 'framer-motion';
import { IndianRupee, TrendingUp, TrendingDown, Copy, Check, ArrowUpRight, Calendar, AlertTriangle, Zap, Briefcase, BarChart3, ArrowLeftRight, Crosshair, Home, X, Star, Handshake } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { useState } from 'react';

interface SalaryNegotiationCardProps {
  report: ScanReport;
}

export default function SalaryNegotiationCard({ report }: SalaryNegotiationCardProps) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [showCTCBreakdown, setShowCTCBreakdown] = useState(false);

  const salaryBleed = report.salary_bleed_monthly || 0;
  const estimatedSalary = report.estimated_monthly_salary_inr;
  const hasSalaryData = estimatedSalary != null && estimatedSalary > 0;
  const role = report.role || 'Professional';
  const industry = report.industry || 'Technology';
  const moatSkills = report.moat_skills || [];
  const survivability = report.survivability;
  const marketPosition = report.market_position_model;

  // India CTC structure (typical split) — only compute if salary data available
  const annualCTC = (estimatedSalary || 0) * 12;
  const basicPct = 0.40;
  const hraPct = 0.20;
  const specialPct = 0.25;
  const variablePct = 0.15;
  const ctcBreakdown = hasSalaryData ? {
    basic: Math.round(annualCTC * basicPct),
    hra: Math.round(annualCTC * hraPct),
    special: Math.round(annualCTC * specialPct),
    variable: Math.round(annualCTC * variablePct),
    pf: Math.round(annualCTC * basicPct * 0.12),
    gratuity: Math.round((annualCTC * basicPct * 15) / 26 / 12),
  } : null;

  // Salary gap
  const annualBleed = salaryBleed * 12;
  const annualBleedLakhs = (annualBleed / 100000).toFixed(1);
  const fiveYearLoss = report.total_5yr_loss_inr || salaryBleed * 60;
  const fiveYearLossLakhs = (fiveYearLoss / 100000).toFixed(1);

  // Market leverage
  // Security / credibility: never silently fall back to 50 for percentile — that's the median
  // and drives "50% earn more — leverage the gap" advice for users with missing market data.
  // Use null to represent "unavailable" and show a transparent data-gap state in the UI.
  const leverageStatus = marketPosition?.leverage_status || 'moderate';
  const demandTrend = marketPosition?.demand_trend || 'stable';
  const percentile: number | null = marketPosition?.market_percentile ?? null;
  const hasPercentileData = percentile !== null;
  const isHighDemand = demandTrend === 'growing' || demandTrend === 'booming';
  const isHighPercentile = hasPercentileData && percentile >= 60;

  // Appraisal season detection (India: Mar-Apr, Sep-Oct)
  const currentMonth = new Date().getMonth();
  const isAppraisalSeason = [2, 3, 8, 9].includes(currentMonth); // Mar, Apr, Sep, Oct
  const appraisalSeasonLabel = isAppraisalSeason
    ? '🔥 Appraisal Season is LIVE — Best time to negotiate!'
    : currentMonth <= 1
      ? '📅 Appraisal season starts in ' + (2 - currentMonth) + ' month(s) — Prepare now!'
      : currentMonth <= 7
        ? '📅 Mid-year review window opens in ' + (8 - currentMonth) + ' month(s)'
        : '📅 Year-end appraisal cycle starts in ' + (14 - currentMonth) + ' month(s)';

  // India-specific negotiation scripts
  const scripts = [
    {
      label: 'Appraisal Meeting Opener',
      icon: Briefcase,
      context: isAppraisalSeason ? '🔥 USE NOW — Appraisal season is live' : 'For your next review meeting',
      script: `"Sir/Ma'am, I've been tracking market data for ${role} roles in ${industry}. Naukri and LinkedIn salary insights show the current market CTC for someone with ${(moatSkills?.[0] ?? 'my specialization')} and ${(moatSkills?.[1] ?? 'cross-functional ability')} is trending ${isHighDemand ? '15-25% above' : '10-15% above'} my current package. I'd like to discuss aligning my compensation — especially the fixed component — with this data."`,
      tag: 'Fixed CTC Focus',
    },
    {
      label: 'Counter When Offered Low Hike',
      icon: BarChart3,
      context: 'When they offer 5-8% instead of market rate',
      script: `"Thank you for the ${isHighDemand ? '8%' : '5%'} offer. However, ${role} professionals in ${industry} with similar skills are commanding ₹${annualBleedLakhs}L more annually based on role benchmarks from Naukri and AmbitionBox for ${role} professionals in ${industry}. A ${isHighDemand ? '20-25%' : '15-18%'} revision would bring me to market median, and I believe my contributions justify that."`,
      tag: 'Data Counter',
    },
    {
      label: 'Variable Pay → Fixed Conversion',
      icon: ArrowLeftRight,
      context: 'India-specific: Push variable into fixed CTC',
      script: `"I understand budget constraints on the fixed component. One thing I'd like to discuss — currently ${variablePct * 100}% of my CTC is variable/performance-linked. Given my consistent delivery, could we convert ${Math.round(variablePct * 50)}% of the variable into fixed? This doesn't increase the overall CTC but gives me more stability, and it shows the company's confidence in my output."`,
      tag: 'CTC Structure',
    },
    {
      label: 'Competing Offer Leverage',
      icon: Crosshair,
      context: 'When you have (or can credibly reference) another offer',
      script: `"I want to be transparent — I've been approached by [Your Target Company] for a ${role} position at a ${isHighDemand ? '30-40%' : '20-25%'} premium. I prefer staying here because of [team/project/growth]. But the gap of ₹${annualBleedLakhs}L per year is significant. Can we find a middle ground — perhaps a one-time retention bonus or an accelerated promotion timeline?"`,
      tag: 'Retention Counter',
    },
    {
      label: 'WFH/Benefits Trade',
      icon: Home,
      context: 'When salary hike is capped — negotiate beyond CTC',
      script: `"If the salary band is truly maxed, I'd like to explore total rewards — could we look at 2-3 additional WFH days, a learning budget of ₹50K-1L for upskilling in ${(moatSkills?.[0] ?? 'AI tools')}, or an ESOP refresh? These don't hit the salary budget but significantly increase my effective compensation and retention motivation."`,
      tag: 'Beyond CTC',
    },
  ];

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text.replace(/"/g, ''));
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const formatLakhs = (n: number) => (n / 100000).toFixed(1) + 'L';

  return (
    <div className="space-y-4">
      {/* Appraisal Season Alert */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`rounded-2xl border-2 p-4 text-center ${
          isAppraisalSeason
            ? 'border-destructive/30 bg-destructive/[0.06] animate-pulse'
            : 'border-primary/20 bg-primary/[0.04]'
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          <Calendar className={`w-4 h-4 ${isAppraisalSeason ? 'text-destructive' : 'text-primary'}`} />
          <p className={`text-xs font-black ${isAppraisalSeason ? 'text-destructive' : 'text-primary'}`}>
            {appraisalSeasonLabel}
          </p>
        </div>
      </motion.div>

      {/* Salary Gap section removed — user feedback: distracting from actionable negotiation content */}

      {/* Market Leverage Meter */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border-2 border-primary/20 bg-primary/[0.04] p-5"
      >
        <p className="text-xs font-semibold text-muted-foreground mb-3">Your Negotiation Leverage</p>

        <div className="space-y-3">
          {[
            {
              label: 'Market Demand (Naukri/LinkedIn)',
              value: isHighDemand ? 'Growing' : demandTrend === 'declining' ? 'Declining' : 'Stable',
              icon: isHighDemand ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />,
              color: isHighDemand ? 'text-prophet-green' : demandTrend === 'declining' ? 'text-destructive' : 'text-prophet-gold',
              strength: isHighDemand ? 'Strong leverage — hiring managers are competing' : 'Moderate — focus on retention value',
            },
            {
              label: 'Market Percentile',
              // Credibility: show '—' when data is absent rather than defaulting to 50% (median)
              // which would generate misleading "50% earn more — leverage the gap" advice.
              value: hasPercentileData ? `Better than ${percentile}%` : '— (data limited)',
              icon: <ArrowUpRight className="w-3.5 h-3.5" />,
              color: !hasPercentileData ? 'text-muted-foreground' : isHighPercentile ? 'text-prophet-green' : 'text-prophet-gold',
              strength: !hasPercentileData
                ? 'Add your current CTC in the salary picker above for a personalised market comparison'
                : isHighPercentile
                ? `Your CTC is higher than ${percentile}% of peers — ask for top-quartile`
                : `${100 - (percentile as number)}% of similar profiles earn more — use this gap as leverage`,
            },
            {
              label: 'Replaceability Score',
              value: `${survivability?.score || '—'}/100`,
              icon: <TrendingUp className="w-3.5 h-3.5" />,
              color: (survivability?.score || 0) >= 60 ? 'text-prophet-green' : 'text-prophet-gold',
              strength: (survivability?.score || 0) >= 60 ? 'Hard to replace — strong retention leverage' : 'Moderate — build more moats before negotiating',
            },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <span className={item.color}>{item.icon}</span>
                <div>
                  <p className="text-xs font-bold text-foreground">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.strength}</p>
                </div>
              </div>
              <span className={`text-sm font-black ${item.color}`}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* India Warning — elevated prominence */}
        <div className="mt-3 rounded-lg border-2 border-prophet-gold/40 bg-prophet-gold/[0.08] p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-prophet-gold mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-black text-prophet-gold uppercase tracking-wide mb-0.5">Before You Negotiate</p>
            <p className="text-[11px] text-foreground/80 leading-relaxed">
              Companies verify your last 3 payslips. If your current CTC is significantly below your ask (&gt;40% jump), frame it as a <strong>market correction</strong> — not a salary jump. Have data from Glassdoor or AmbitionBox ready to back your number.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Copy-Paste Scripts */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border-2 border-prophet-green/20 bg-prophet-green/[0.03] p-5"
      >
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-prophet-green" />
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-prophet-green">
            India-Ready Negotiation Scripts
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">
          Personalized for {role} in {industry} · Adapted for Indian corporate culture
        </p>

        <div className="space-y-3">
          {scripts.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.06 }}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <s.icon className="w-3.5 h-3.5 text-prophet-green flex-shrink-0" />
                  <p className="text-xs font-black text-foreground">{s.label}</p>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                    {s.tag}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(s.script, i)}
                  className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors min-h-[32px] px-2"
                >
                  {copiedIdx === i ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">{s.context}</p>
              <p className="text-xs text-foreground/80 leading-relaxed italic bg-muted/50 rounded-lg p-3">
                {s.script.split('[Your Target Company]').map((part, idx) => (
                  <span key={idx}>
                    {part}
                    {idx < s.script.split('[Your Target Company]').length - 1 && (
                      <span className="text-prophet-gold font-bold not-italic underline decoration-dashed">[Your Target Company]</span>
                    )}
                  </span>
                ))}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* India-specific DO/DON'T */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl border-2 border-border bg-card p-5"
      >
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground mb-3">
          India Salary Negotiation Rules
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-prophet-green" />
              <p className="text-xs font-semibold text-muted-foreground">DO</p>
            </div>
            {[
              'Negotiate on fixed CTC, not total package',
              'Time it during appraisal cycle (Mar–Apr)',
              'Use Naukri/AmbitionBox data as evidence',
              'Ask for variable → fixed conversion',
              'Negotiate joining bonus to cover notice buyout',
            ].map((tip, i) => (
              <p key={i} className="text-xs text-foreground/80 leading-relaxed pl-2 border-l-2 border-prophet-green/30">
                {tip}
              </p>
            ))}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <X className="w-3.5 h-3.5 text-destructive" />
              <p className="text-xs font-semibold text-muted-foreground">DON'T</p>
            </div>
            {[
              'Share exact current CTC — say "expectations"',
              'Accept verbal promises on variable pay',
              'Resign before getting revised offer letter',
              'Negotiate over email only — request a call',
              'Compare with US/EU salaries in discussions',
            ].map((tip, i) => (
              <p key={i} className="text-xs text-foreground/80 leading-relaxed pl-2 border-l-2 border-destructive/30">
                {tip}
              </p>
            ))}
          </div>
        </div>
      </motion.div>

      <p className="text-[10px] text-muted-foreground/50 text-center italic">
        Scripts calibrated for Indian corporate culture · CTC structures · appraisal cycles · Naukri/LinkedIn market data
      </p>
    </div>
  );
}

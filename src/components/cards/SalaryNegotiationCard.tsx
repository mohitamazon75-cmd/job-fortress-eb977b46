import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Copy, Check, ArrowUpRight, Calendar, AlertTriangle, Zap, Briefcase, Crosshair, X, Star, Handshake } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { useState } from 'react';

interface SalaryNegotiationCardProps {
  report: ScanReport;
}

export default function SalaryNegotiationCard({ report }: SalaryNegotiationCardProps) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  

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

  const di = report.determinism_index ?? 50;
  const topMoat = moatSkills[0] || 'my core specialisation';
  const secondMoat = moatSkills[1] || 'cross-functional leadership';
  const salaryRef = hasSalaryData && salaryBleed >= 8000
    ? `₹${(salaryBleed / 1000).toFixed(1)}K/month`
    : null;
  const salaryFraming = salaryRef
    ? `My research shows ${role} roles are experiencing ${salaryRef} salary compression from AI adoption`
    : `Research shows ${role} roles with ${di}% AI exposure are being repriced in ${industry}`;

  const scripts = [
    {
      label: 'Annual Performance Review',
      icon: Briefcase,
      context: isAppraisalSeason ? '🔥 USE NOW — Appraisal season is live' : 'For your next annual review',
      script: `Sir/Ma'am, I want to discuss my compensation at this review. ${salaryFraming} — I want to discuss how my ${topMoat} differentiates me from that trend. My ${topMoat} capability is specifically what clients and stakeholders say they cannot get from AI tools. Combined with my ${secondMoat}, I believe a ${isHighDemand ? '20-25%' : '15-18%'} revision would align my CTC with market benchmarks on Naukri and AmbitionBox for ${role} professionals in ${industry}.`,
      tag: 'Annual Review',
    },
    {
      label: 'Counter-Offer (You Have Another Offer)',
      icon: Crosshair,
      context: 'When you have a competing offer in hand',
      script: `I want to be transparent — I have received an offer for a ${role} position at a ${isHighDemand ? '30-40%' : '20-25%'} premium over my current CTC. I genuinely prefer to stay because of the team and the projects here. However, ${salaryFraming}, and the gap of ₹${annualBleedLakhs}L per year is significant. My ${topMoat} and ${secondMoat} are difficult to replace in the current market. Can we discuss a retention package — whether that is a revised fixed CTC, a one-time retention bonus, or an accelerated promotion timeline?`,
      tag: 'Counter-Offer',
    },
    {
      label: 'New Job — Offer Negotiation Opener',
      icon: ArrowUpRight,
      context: 'First salary discussion at a new company',
      script: `Thank you for the offer — I am excited about this ${role} opportunity. Before I sign, I would like to discuss the compensation structure. Based on market data from Naukri, LinkedIn, and AmbitionBox, ${role} professionals in ${industry} with demonstrated ${topMoat} and ${secondMoat} are commanding CTC packages ${isHighDemand ? '20-30%' : '10-20%'} above what is offered here. My ${topMoat} capability is AI-resistant and directly impacts business outcomes. I would be comfortable at a fixed CTC of ₹${hasSalaryData ? ((estimatedSalary || 0) * 12 * 1.2 / 100000).toFixed(1) : 'X'}L, which reflects the current market median for this skill profile.`,
      tag: 'Offer Negotiation',
    },
    {
      label: 'Promotion Conversation (Same Company)',
      icon: Star,
      context: 'When you deserve a level jump, not just a hike',
      script: `I would like to discuss my career trajectory here. Over the past year, I have consistently delivered beyond my current level — especially in ${topMoat} and ${secondMoat}, which are the two capabilities our team needs most as AI reshapes ${industry}. ${salaryFraming}, and professionals who combine domain expertise with AI-augmented workflows are being promoted faster. I believe I am ready for the next level, and I would like to align both my title and compensation accordingly. A ${isHighDemand ? '25-35%' : '18-25%'} revision with a title change would reflect my actual contribution.`,
      tag: 'Promotion Ask',
    },
    {
      label: 'Freelance / Consulting Rate Discussion',
      icon: Handshake,
      context: 'Setting your rate for project-based or consulting work',
      script: `For this ${role} engagement in ${industry}, my consulting rate is ₹${hasSalaryData ? Math.round((estimatedSalary || 0) * 2 / 1000) : 'XX'}K per day. This reflects the market premium for ${topMoat} expertise — a capability that AI tools cannot replicate and that directly impacts project outcomes. My ${secondMoat} background means I deliver both strategic direction and execution without needing additional coordination layers. For a retainer arrangement of 10+ days per month, I can offer a 15% reduction on the day rate. I am happy to start with a 2-week trial engagement so you can validate the ROI before committing longer term.`,
      tag: 'Consulting Rate',
    },
  ];

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

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
                {s.script}
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

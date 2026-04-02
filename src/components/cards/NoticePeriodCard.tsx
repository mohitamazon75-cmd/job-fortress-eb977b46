import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator, Copy, Check, Clock, IndianRupee, FileText, Shield, AlertTriangle, Scale, Briefcase } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';

interface NoticePeriodCardProps {
  report: ScanReport;
}

const NOTICE_PERIODS = [30, 60, 90] as const;

export default function NoticePeriodCard({ report }: NoticePeriodCardProps) {
  const [noticeDays, setNoticeDays] = useState<number>(60);
  const [monthlyCTC, setMonthlyCTC] = useState<string>('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [pendingLeaves, setPendingLeaves] = useState<string>('');

  const role = report.role || 'Professional';
  const industry = report.industry || 'Technology';
  const moatSkills = report.moat_skills || [];

  // Buyout calculation
  const ctcNum = parseInt(monthlyCTC) || 0;
  const leaveDays = parseInt(pendingLeaves) || 0;
  const dailyRate = ctcNum / 30;
  const effectiveNoticeDays = Math.max(0, noticeDays - leaveDays);
  const buyoutCost = Math.round(dailyRate * effectiveNoticeDays);
  const buyoutLakhs = (buyoutCost / 100000).toFixed(2);
  const savedByLeaves = Math.round(dailyRate * Math.min(leaveDays, noticeDays));

  // PF & Gratuity impact
  const monthlyBasic = ctcNum * 0.40; // ~40% of CTC is basic
  const pfMonthly = monthlyBasic * 0.12;
  const pfLossIfAbscond = Math.round(pfMonthly * (noticeDays / 30)); // Employer PF contribution at risk
  const gratuityEligible = (report.years_experience && parseInt(report.years_experience) >= 5);

  // Negotiation templates — deeply India-specific
  const templates = [
    {
      label: '📧 Early Release Request',
      context: 'Email to HR / Reporting Manager',
      body: `Subject: Request for Early Release — ${noticeDays}-Day Notice Period

Dear [Manager Name],

I'm writing to formally request an early release from my ${noticeDays}-day notice period. I've prepared a comprehensive transition plan:

1. All active projects documented in [shared folder/Confluence]
2. Knowledge transfer sessions scheduled with [colleague name] — ${Math.ceil(effectiveNoticeDays / 7)} sessions planned
3. Handover checklist completed and shared with team lead
4. ${leaveDays > 0 ? `I have ${leaveDays} pending leaves that can be adjusted against the notice period.` : 'All pending deliverables are on track for completion.'}

Given my track record and the comprehensive handover, I'd appreciate consideration for a ${Math.max(15, noticeDays - 30)}-day release. I'm committed to ensuring zero disruption and can remain available on call for 2 weeks post-release for any critical queries.

I understand the importance of a clean exit and want to ensure I receive my experience letter and full & final settlement without delays.

Best regards,
[Your Name]
Employee ID: [Your ID]`,
    },
    {
      label: '🤝 Ask New Employer to Cover Buyout',
      context: 'During offer negotiation with new company',
      body: `"I'm currently on a ${noticeDays}-day notice period at [Current Company]. The buyout amount would be approximately ₹${buyoutLakhs}L${leaveDays > 0 ? ` (after adjusting ${leaveDays} pending leaves)` : ''}. 

This is standard in ${industry} companies in India. Many organizations like [TCS/Infosys/Wipro/competitor] cover this as part of the joining bonus or sign-on amount. Would [New Company] be open to:
1. A joining bonus of ₹${buyoutLakhs}L to cover the buyout, OR
2. Adding this to my first-year variable/retention bonus?

I can provide a buyout calculation letter from my current HR for reimbursement."`,
    },
    {
      label: '⚖️ Garden Leave Strategy',
      context: 'When company won\'t release early but you need to start',
      body: `"I understand the ${noticeDays}-day policy and I respect it. Could we explore a garden leave arrangement for the final ${Math.round(noticeDays / 3)} days? 

During garden leave, I'll:
- Remain on payroll and available for critical queries
- Not be required to come to office/log in daily
- Complete any remaining documentation remotely
- Not join the new employer until garden leave ends

This is common practice in ${industry} — companies like [Flipkart/Swiggy/competitor] offer this. It protects the company's interests while providing flexibility. I'm happy to sign a garden leave agreement."`,
    },
    {
      label: '🛡️ Bond/Service Agreement Counter',
      context: 'When company cites a training bond or service agreement',
      body: `"I understand there's a service agreement clause. I'd like to discuss this constructively:

1. Under Indian labor law, restrictive employment bonds are generally unenforceable if they unreasonably restrain trade (Indian Contract Act, Section 27).
2. I've completed [X months/years] of my [Y year] bond period — could we calculate a pro-rata refund instead of the full bond amount?
3. Many ${industry} companies waive bonds for employees with good standing — my performance ratings of [rating] over [X] years demonstrate my contributions.

I'd prefer to settle this amicably rather than involve legal counsel. Could we schedule a meeting to discuss options?"`,
    },
    {
      label: '📱 WhatsApp Message to Manager',
      context: 'Informal heads-up before formal resignation',
      body: `"Hi [Manager], hope you're doing well. I wanted to talk to you about something important before I send a formal email. I've received an opportunity that I'm considering seriously. I wanted to give you a heads up first because I respect our working relationship. 

I'd love to explore if there's a way to make it work here — maybe a role change, compensation revision, or project switch. Can we grab a chai and discuss? 🙏

If it does come to a transition, I'll ensure a clean handover — no loose ends. Let me know when you're free."`,
    },
  ];

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // India-specific risks and tips
  const risks = [
    {
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      title: 'Absconding Risk',
      tip: `Not serving notice = "absconding" on record. Many ${industry} companies share this via background verification (BGV). Future employers WILL check.`,
      severity: 'high' as const,
    },
    {
      icon: <Shield className="w-3.5 h-3.5" />,
      title: 'Experience Letter at Risk',
      tip: 'Companies can withhold your experience/relieving letter if you don\'t serve full notice. Without it, BGV for next job may fail.',
      severity: 'high' as const,
    },
    {
      icon: <IndianRupee className="w-3.5 h-3.5" />,
      title: gratuityEligible ? 'Gratuity Eligible ✅' : 'Gratuity Not Eligible',
      tip: gratuityEligible
        ? `With 5+ years, you're eligible for gratuity (~₹${Math.round((monthlyBasic * 15 * parseInt(report.years_experience || '5')) / 26 / 100000 * 100) / 100}L). Ensure F&F settlement includes this.`
        : 'Gratuity kicks in after 5 years of continuous service. If you\'re close, consider timing your exit.',
      severity: gratuityEligible ? 'info' as const : 'medium' as const,
    },
    {
      icon: <Scale className="w-3.5 h-3.5" />,
      title: 'PF Transfer',
      tip: `Don't forget to transfer PF to new employer via UAN portal. Employer PF contribution (~₹${Math.round(pfMonthly).toLocaleString('en-IN')}/mo) stays with you if you serve notice properly.`,
      severity: 'info' as const,
    },
  ];

  const timeline = [
    { day: 'Day 1', action: 'Submit resignation + share handover plan', icon: '📝' },
    { day: 'Day 1-7', action: 'Document all projects, credentials, processes', icon: '📋' },
    { day: 'Week 2-3', action: 'KT sessions with team + apply pending leaves', icon: '🎓' },
    { day: 'Last Week', action: 'F&F initiation, PF transfer, collect relieving letter', icon: '✅' },
    { day: 'Post-Exit', action: 'Follow up on F&F within 45 days (legal right)', icon: '💰' },
  ];

  return (
    <div className="space-y-4">
      {/* Buyout Calculator */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl border-2 border-primary/20 bg-primary/[0.04] p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-4 h-4 text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Buyout Cost Calculator</p>
        </div>

        {/* Notice Period Selector */}
        <div className="mb-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Your Notice Period</p>
          <div className="flex gap-2">
            {NOTICE_PERIODS.map(days => (
              <button
                key={days}
                onClick={() => setNoticeDays(days)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-black transition-all ${
                  noticeDays === days
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>

        {/* Monthly CTC + Leave Inputs */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Monthly CTC (₹)</p>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="number"
                placeholder="e.g. 80000"
                value={monthlyCTC}
                onChange={e => setMonthlyCTC(e.target.value)}
                className="w-full pl-9 pr-3 py-3 rounded-lg border border-border bg-card text-foreground text-sm font-bold placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Pending Leaves</p>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="number"
                placeholder="e.g. 12"
                value={pendingLeaves}
                onChange={e => setPendingLeaves(e.target.value)}
                className="w-full pl-9 pr-3 py-3 rounded-lg border border-border bg-card text-foreground text-sm font-bold placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>

        {/* Result */}
        {ctcNum > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border-2 border-destructive/20 bg-destructive/[0.04] p-4"
          >
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-destructive mb-1">Buyout Cost</p>
                <p className="text-2xl font-black text-destructive">₹{buyoutCost.toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  ₹{Math.round(dailyRate).toLocaleString('en-IN')}/day × {effectiveNoticeDays} days
                </p>
              </div>
              {leaveDays > 0 && (
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-prophet-green mb-1">Saved by Leaves</p>
                  <p className="text-2xl font-black text-prophet-green">₹{savedByLeaves.toLocaleString('en-IN')}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {Math.min(leaveDays, noticeDays)} leave days adjusted
                  </p>
                </div>
              )}
            </div>
            <div className="mt-3 space-y-1.5">
              <p className="text-[10px] text-muted-foreground text-center">
                💡 Ask new employer to cover ₹{buyoutLakhs}L as <span className="font-bold text-foreground">joining/sign-on bonus</span>
              </p>
              {leaveDays > 0 && (
                <p className="text-[10px] text-muted-foreground text-center">
                  📅 Effective last working day: <span className="font-bold text-foreground">Day {effectiveNoticeDays}</span> (after leave adjustment)
                </p>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Risks & Warnings — India-Specific */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="rounded-2xl border-2 border-destructive/20 bg-destructive/[0.03] p-5"
      >
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive mb-3">
          ⚠️ India Exit Risks — Don't Get Caught
        </p>
        <div className="space-y-2.5">
          {risks.map((r, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 rounded-lg border p-3 ${
                r.severity === 'high'
                  ? 'border-destructive/20 bg-destructive/[0.04]'
                  : r.severity === 'medium'
                    ? 'border-prophet-gold/20 bg-prophet-gold/[0.04]'
                    : 'border-border bg-background'
              }`}
            >
              <span className={`mt-0.5 shrink-0 ${
                r.severity === 'high' ? 'text-destructive' : r.severity === 'medium' ? 'text-prophet-gold' : 'text-primary'
              }`}>
                {r.icon}
              </span>
              <div>
                <p className="text-[10px] font-black text-foreground">{r.title}</p>
                <p className="text-[10px] text-foreground/70 leading-relaxed mt-0.5">{r.tip}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Exit Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="rounded-2xl border-2 border-primary/20 bg-primary/[0.04] p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="w-4 h-4 text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            {noticeDays}-Day Exit Playbook
          </p>
        </div>
        <div className="space-y-0">
          {timeline.map((step, i) => (
            <div key={i} className="flex items-start gap-3 relative">
              {i < timeline.length - 1 && (
                <div className="absolute left-[14px] top-7 bottom-0 w-px bg-border" />
              )}
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm z-10">
                {step.icon}
              </div>
              <div className="pb-3">
                <p className="text-[10px] font-black text-primary">{step.day}</p>
                <p className="text-[10px] text-foreground/80">{step.action}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Negotiation Templates */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.09 }}
        className="rounded-2xl border-2 border-prophet-green/20 bg-prophet-green/[0.03] p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-prophet-green" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-prophet-green">
            Copy-Paste Templates (India-Ready)
          </p>
        </div>

        <div className="space-y-3">
          {templates.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12 + i * 0.06 }}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-black text-foreground">{t.label}</p>
                <button
                  onClick={() => handleCopy(t.body, i)}
                  className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors min-h-[32px] px-2"
                >
                  {copiedIdx === i ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wider">{t.context}</p>
              <pre className="text-[10px] text-foreground/80 leading-relaxed bg-muted/50 rounded-lg p-3 whitespace-pre-wrap font-sans max-h-[200px] overflow-y-auto">
                {t.body}
              </pre>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <p className="text-[11px] text-muted-foreground/50 text-center italic">
        Built for Indian labor law · PF/gratuity rules · BGV practices · notice period norms
      </p>
    </div>
  );
}

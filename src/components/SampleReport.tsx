import { motion, useInView } from 'framer-motion';
import {
  Shield, AlertTriangle, Zap, TrendingUp, ArrowRight, Brain, BarChart3,
  Clock, Briefcase, FileText, Target, DollarSign, ExternalLink,
  ChevronRight, Sparkles, Lock, CheckCircle2, XCircle, TrendingDown
} from 'lucide-react';
import { useRef, useState } from 'react';

interface SampleReportProps {
  onCTA: () => void;
}

/* ─── SAMPLE DATA ─── */
const PROFILE = {
  name: 'Ananya R.',
  role: 'Marketing Manager',
  experience: '7 yrs',
  city: 'Mumbai',
  industry: 'FMCG',
  tier: 'Tier-1 Metro',
  score: 47,
  doomMonths: 22,
  salaryBleed: 18400,
};

const SCORE_FACTORS = [
  { label: 'AI Exposure Index', pts: -18, desc: '62% of daily tasks automatable' },
  { label: 'Human Edge Skills', pts: +12, desc: 'Stakeholder mgmt, negotiation' },
  { label: 'Career Capital', pts: +11, desc: 'Moat depth · experience · adaptability · peer validation' },
  { label: 'Market Demand', pts: +7, desc: 'Role still hiring in Tier-1' },
  { label: 'Income Risk', pts: -4, desc: 'Salary above AI-replacement threshold' },
  { label: 'Skill Freshness', pts: -8, desc: 'No AI-era upskilling detected' },
];

const SKILLS_AT_RISK = [
  { name: 'Data Analysis & Reporting', risk: 82, tool: 'Power BI Copilot', timeline: '8 mo' },
  { name: 'Campaign Performance Tracking', risk: 76, tool: 'Google Analytics AI', timeline: '12 mo' },
  { name: 'Market Research', risk: 65, tool: 'Perplexity AI', timeline: '18 mo' },
  { name: 'Content Brief Writing', risk: 71, tool: 'Claude / GPT-5', timeline: '6 mo' },
];

const SKILLS_SAFE = [
  { name: 'Client Relationship Mgmt', safety: 88, edge: 'Trust & empathy' },
  { name: 'Cross-functional Leadership', safety: 91, edge: 'Org navigation' },
  { name: 'Brand Strategy', safety: 79, edge: 'Creative judgment' },
  { name: 'Vendor Negotiation', safety: 85, edge: 'Human leverage' },
];

const DEFENSE_ACTIONS = [
  { phase: 'Week 1–2', action: 'Complete Google AI Marketing certification', impact: '+6 pts', status: 'critical' },
  { phase: 'Week 3–4', action: 'Build 3 AI-augmented campaign case studies', impact: '+4 pts', status: 'important' },
  { phase: 'Month 2', action: 'Lead one AI tool adoption in your team', impact: '+8 pts', status: 'important' },
  { phase: 'Month 3', action: 'Publish thought leadership on AI+Marketing', impact: '+5 pts', status: 'bonus' },
];

const SAMPLE_JOBS = [
  { title: 'Marketing Strategy Lead', company: 'Hindustan Unilever', match: 87, safety: 82, fit: 'STRONG', location: 'Mumbai', salary: '28-35 LPA' },
  { title: 'Brand Manager – Digital', company: 'ITC Limited', match: 74, safety: 76, fit: 'GOOD', location: 'Kolkata / Hybrid', salary: '22-28 LPA' },
  { title: 'Growth Marketing Manager', company: 'Swiggy', match: 69, safety: 71, fit: 'GOOD', location: 'Bengaluru', salary: '30-40 LPA' },
];

const PIVOT_PATHS = [
  { role: 'Product Marketing Manager', transferPct: 82, salaryDelta: '+15%', demand: 'High', risk: 34 },
  { role: 'Customer Success Director', transferPct: 71, salaryDelta: '+22%', demand: 'Very High', risk: 21 },
  { role: 'Marketing Analytics Lead', transferPct: 65, salaryDelta: '+30%', demand: 'High', risk: 28 },
];

/* ─── MINI COMPONENTS ─── */
function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? 'hsl(var(--prophet-green))' : score >= 40 ? 'hsl(var(--prophet-gold))' : 'hsl(var(--destructive))';

  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r="54" fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-foreground leading-none">{score}</span>
        <span className="text-[10px] font-bold text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

function SectionLabel({ icon: Icon, label, tag }: { icon: React.ElementType; label: string; tag?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
        <Icon className="w-3.5 h-3.5 text-primary-foreground" />
      </div>
      <span className="text-[11px] font-black uppercase tracking-widest text-foreground">{label}</span>
      {tag && (
        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
          {tag}
        </span>
      )}
    </div>
  );
}

function BlurOverlay({ label, onCTA }: { label: string; onCTA: () => void }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 z-10 backdrop-blur-[6px] bg-background/60 rounded-xl flex flex-col items-center justify-center gap-2">
        <Lock className="w-5 h-5 text-muted-foreground" />
        <p className="text-xs font-bold text-foreground">{label}</p>
        <button
          onClick={onCTA}
          className="text-[11px] font-black text-primary hover:underline flex items-center gap-1"
        >
          Get your report <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <div className="opacity-40 pointer-events-none select-none" aria-hidden="true">
        {/* Placeholder content behind blur */}
        <div className="space-y-2 p-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN COMPONENT ─── */
export default function SampleReport({ onCTA }: SampleReportProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  const [activeTab, setActiveTab] = useState<'risk' | 'safe'>('risk');

  const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: isInView ? { opacity: 1, y: 0 } : {},
  };

  return (
    <section ref={ref} className="relative py-20 md:py-28 overflow-hidden">
      {/* Top divider */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      
      <div className="max-w-5xl mx-auto px-4 md:px-8">
      {/* Section header */}
      <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 mb-5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-primary">Live Preview</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground mb-3">
          Here's What Your Report{' '}
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-primary)' }}>
            Actually Looks Like
          </span>
        </h2>
        <p className="text-base text-muted-foreground mt-2 max-w-2xl mx-auto leading-relaxed">
          Real output from our engine for a <span className="text-foreground font-bold">Marketing Manager in Mumbai</span>. Your report will be even more detailed with your actual profile data.
        </p>
      </motion.div>

      {/* Report container */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="rounded-3xl border-2 border-primary/15 bg-card overflow-hidden"
        style={{ boxShadow: '0 20px 80px hsl(var(--primary) / 0.08), 0 4px 20px hsl(var(--border) / 0.5)' }}
      >
        {/* ═══ CARD 1: Profile + Score ═══ */}
        <div className="p-5 sm:p-8 border-b border-border">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <ScoreRing score={PROFILE.score} />
            <div className="flex-1 text-center sm:text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Career Position Score</p>
              <h3 className="text-xl sm:text-2xl font-black text-foreground mb-1">
                {PROFILE.name} · {PROFILE.role}
              </h3>
              <p className="text-xs text-muted-foreground">
                {PROFILE.experience} · {PROFILE.city} · {PROFILE.industry} · {PROFILE.tier}
              </p>

              {/* Urgency stats */}
              <div className="flex flex-wrap gap-3 mt-4 justify-center sm:justify-start">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/20 bg-destructive/5">
                  <Clock className="w-3.5 h-3.5 text-destructive" />
                  <span className="text-xs font-black text-destructive">{PROFILE.doomMonths} months</span>
                  <span className="text-[10px] text-muted-foreground">until partial displacement</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-prophet-gold/20 bg-prophet-gold/5">
                  <TrendingDown className="w-3.5 h-3.5 text-prophet-gold" />
                  <span className="text-xs font-black text-prophet-gold">₹{PROFILE.salaryBleed.toLocaleString()}/mo</span>
                  <span className="text-[10px] text-muted-foreground">salary bleed risk</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ CARD 2: Score Decomposition ═══ */}
        <div className="p-5 sm:p-8 border-b border-border">
          <SectionLabel icon={BarChart3} label="Score Decomposition" tag="Deterministic" />
          <div className="space-y-2.5">
            {SCORE_FACTORS.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, x: -12 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.06 }}
                className="flex items-center gap-3"
              >
                <div className="w-36 sm:w-44 text-right flex-shrink-0">
                  <p className="text-xs font-bold text-foreground leading-tight">{f.label}</p>
                  <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                </div>
                <div className="flex-1 h-7 bg-muted/40 rounded-lg overflow-hidden relative">
                  <motion.div
                    className={`h-full rounded-lg ${f.pts > 0 ? 'bg-prophet-green/25' : 'bg-destructive/20'}`}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${Math.min(Math.abs(f.pts) * 5, 100)}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.08, duration: 0.6 }}
                  />
                  <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black ${f.pts > 0 ? 'text-prophet-green' : 'text-destructive'}`}>
                    {f.pts > 0 ? '+' : ''}{f.pts}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ═══ CARD 3: Skill Doom Clock ═══ */}
        <div className="p-5 sm:p-8 border-b border-border">
          <SectionLabel icon={Clock} label="Skill Doom Clock" tag="AI-Mapped" />

          {/* Tab switcher */}
          <div className="flex gap-1 mb-4 p-1 rounded-xl bg-muted/50 w-fit">
            <button
              onClick={() => setActiveTab('risk')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeTab === 'risk' ? 'bg-destructive/10 text-destructive border border-destructive/20' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              At Risk ({SKILLS_AT_RISK.length})
            </button>
            <button
              onClick={() => setActiveTab('safe')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeTab === 'safe' ? 'bg-prophet-green/10 text-prophet-green border border-prophet-green/20' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Shield className="w-3 h-3 inline mr-1" />
              Your Moats ({SKILLS_SAFE.length})
            </button>
          </div>

          {activeTab === 'risk' ? (
            <div className="space-y-2">
              {SKILLS_AT_RISK.map((s, i) => (
                <motion.div
                  key={s.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.2 + i * 0.06 }}
                  className="flex items-center justify-between p-3 rounded-xl border border-destructive/15 bg-destructive/[0.03]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Zap className="w-4 h-4 text-destructive flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">Replaced by <span className="font-semibold text-destructive">{s.tool}</span></p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-black text-destructive">{s.risk}%</p>
                    <p className="text-[10px] text-muted-foreground">~{s.timeline}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {SKILLS_SAFE.map((s, i) => (
                <motion.div
                  key={s.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className="flex items-center justify-between p-3 rounded-xl border border-prophet-green/15 bg-prophet-green/[0.03]"
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-prophet-green flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-foreground">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">Human edge: <span className="font-semibold text-prophet-green">{s.edge}</span></p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-prophet-green flex-shrink-0">{s.safety}%</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ CARD 4: Best-Fit Jobs ═══ */}
        <div className="p-5 sm:p-8 border-b border-border">
          <SectionLabel icon={Briefcase} label="Best-Fit Jobs" tag="Live Search" />
          <p className="text-[11px] text-muted-foreground mb-3 -mt-2">
            <span className="font-bold text-foreground">24 openings scanned</span> across Naukri, LinkedIn, Indeed · Top 3 shown
          </p>
          <div className="space-y-2">
            {SAMPLE_JOBS.map((job, i) => {
              const fitColor = job.fit === 'STRONG' ? 'prophet-green' : job.fit === 'GOOD' ? 'prophet-cyan' : 'prophet-gold';
              return (
                <motion.div
                  key={job.title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className="p-3.5 rounded-xl border border-border bg-card hover:border-primary/20 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded bg-${fitColor}/10 text-${fitColor} border border-${fitColor}/20`}>
                          {job.fit === 'STRONG' ? '✓ Strong Fit' : job.fit === 'GOOD' ? '● Good Fit' : '◐ Stretch'}
                        </span>
                        <span className="text-xs font-black text-foreground">{job.title}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-foreground/70">{job.company}</span>
                        <span className="text-[10px] text-muted-foreground">📍 {job.location}</span>
                        <span className="text-[11px] font-bold text-primary">₹{job.salary}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> {job.match}% match
                        </span>
                        <span className={`text-[10px] font-bold flex items-center gap-1 ${job.safety >= 75 ? 'text-prophet-green' : 'text-prophet-gold'}`}>
                          <Shield className="w-3 h-3" /> {job.safety >= 75 ? 'Low AI Risk' : 'Medium AI Risk'}
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ═══ CARD 5: 90-Day Defense Plan ═══ */}
        <div className="p-5 sm:p-8 border-b border-border">
          <SectionLabel icon={Shield} label="90-Day Defense Plan" tag="Personalized" />
          <div className="space-y-2">
            {DEFENSE_ACTIONS.map((a, i) => (
              <motion.div
                key={a.phase}
                initial={{ opacity: 0, y: 8 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.06 }}
                className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card"
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  a.status === 'critical' ? 'bg-destructive/10' : a.status === 'important' ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  {a.status === 'critical' ? <Zap className="w-3.5 h-3.5 text-destructive" /> :
                   a.status === 'important' ? <Target className="w-3.5 h-3.5 text-primary" /> :
                   <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{a.phase}</span>
                    <span className="text-[10px] font-black text-prophet-green bg-prophet-green/10 px-2 py-0.5 rounded">{a.impact}</span>
                  </div>
                  <p className="text-xs font-bold text-foreground mt-0.5">{a.action}</p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* ═══ CARD 6: Career Pivot Analysis (Blurred) ═══ */}
        <div className="p-5 sm:p-8 border-b border-border">
          <SectionLabel icon={Target} label="Career Pivot Analysis" tag="Pro" />
          <div className="space-y-2 mb-3">
            {/* Show first one clearly, blur the rest */}
            <div className="p-3.5 rounded-xl border border-primary/15 bg-primary/[0.02]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-foreground">{PIVOT_PATHS[0].role}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-bold text-primary">{PIVOT_PATHS[0].transferPct}% skill transfer</span>
                    <span className="text-[10px] font-bold text-prophet-green">{PIVOT_PATHS[0].salaryDelta} salary</span>
                    <span className="text-[10px] font-bold text-prophet-gold">AI Risk: {PIVOT_PATHS[0].risk}%</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            <BlurOverlay label="2 more pivot paths in your report" onCTA={onCTA} />
          </div>
        </div>

        {/* ═══ CARD 7: Salary Negotiation (Blurred preview) ═══ */}
        <div className="p-5 sm:p-8 border-b border-border">
          <SectionLabel icon={DollarSign} label="Salary Negotiation Scripts" tag="Pro" />
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="p-3 rounded-xl border border-border bg-muted/30 text-center">
              <p className="text-[10px] font-black uppercase text-muted-foreground">Your CTC</p>
              <p className="text-lg font-black text-foreground">₹18.5L</p>
            </div>
            <div className="p-3 rounded-xl border border-prophet-green/20 bg-prophet-green/5 text-center">
              <p className="text-[10px] font-black uppercase text-prophet-green">Market 75th</p>
              <p className="text-lg font-black text-prophet-green">₹24.2L</p>
            </div>
            <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 text-center">
              <p className="text-[10px] font-black uppercase text-primary">Gap</p>
              <p className="text-lg font-black text-primary">+31%</p>
            </div>
          </div>
          <BlurOverlay label="Copy-paste negotiation scripts in your report" onCTA={onCTA} />
        </div>

        {/* ═══ CARD 8: Resume Rewrite Preview ═══ */}
        <div className="p-5 sm:p-8 border-b border-border">
          <SectionLabel icon={FileText} label="ATS Resume Rewrite" tag="AI-Powered" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-destructive/15 bg-destructive/[0.02]">
              <p className="text-[10px] font-black uppercase text-destructive mb-2 flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Before
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                "Managed digital marketing campaigns and analyzed performance metrics to optimize ROI across channels."
              </p>
            </div>
            <div className="p-3 rounded-xl border border-prophet-green/15 bg-prophet-green/[0.02]">
              <p className="text-[10px] font-black uppercase text-prophet-green mb-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> After — AI-Proof
              </p>
              <p className="text-[11px] text-foreground leading-relaxed">
                "Led cross-functional <strong>stakeholder alignment</strong> for ₹4.2Cr campaigns, <strong>negotiating</strong> vendor terms that saved 18% — combining <strong>strategic judgment</strong> with AI-augmented analytics."
              </p>
            </div>
          </div>
          <BlurOverlay label="Full resume rewrite in your report" onCTA={onCTA} />
        </div>

        {/* ═══ FINAL CTA ═══ */}
        <div className="p-6 sm:p-10 bg-gradient-to-b from-card to-muted/30">
          <div className="text-center max-w-lg mx-auto">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">This is a sample</p>
            <h3 className="text-xl sm:text-2xl font-black text-foreground mb-2">
              Your report will be{' '}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-primary)' }}>
                10× more personal
              </span>
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Built from your actual LinkedIn profile or resume — with real job matches, exact salary data for your city, and a defense plan tailored to your specific skills.
            </p>
            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={onCTA}
              className="w-full sm:w-auto sm:px-16 py-4.5 rounded-xl text-primary-foreground font-black text-base flex items-center justify-center gap-3 mx-auto"
              style={{ background: 'var(--gradient-primary)', boxShadow: '0 8px 32px hsl(var(--primary) / 0.3)' }}
            >
              Get My Personalized Report — Free
              <ArrowRight className="w-5 h-5" />
            </motion.button>
            <p className="text-[10px] text-muted-foreground mt-3">
              No credit card · No email required · Results in 90 seconds
            </p>
          </div>
        </div>
      </motion.div>
    </div>
    </section>
  );
}

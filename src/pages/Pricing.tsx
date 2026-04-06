import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Check, Shield, Zap, FileText, TrendingUp, Lock, AlertTriangle, Target, BarChart3, BookOpen, MessageSquare } from 'lucide-react';
import ProUpgradeModal from '@/components/ProUpgradeModal';

const REPORT_A_HIGHLIGHTS = [
  { icon: AlertTriangle, text: 'Career Position Score™ — your real AI displacement risk' },
  { icon: BarChart3, text: 'AI Impact Dossier — which tasks are already automatable' },
  { icon: Target, text: 'Skill-by-skill breakdown with risk ratings' },
  { icon: Shield, text: 'Peer comparison — where you stand vs. your cohort' },
];

const REPORT_B_HIGHLIGHTS = [
  { icon: TrendingUp, text: 'Growth Playbook — 90-day career defense roadmap' },
  { icon: BookOpen, text: 'Skill Roadmap — what to learn, in what order' },
  { icon: Zap, text: 'Side Hustle Generator — 3 AI-proof income ideas' },
  { icon: MessageSquare, text: 'AI Career Coach — unlimited strategic Q&A' },
];

const ALL_FEATURES = [
  'Full skill-by-skill risk breakdown',
  'AI Strategic Dossier (streaming)',
  'Side Hustle Generator with ₹ estimates',
  'AI Career Coach (unlimited questions)',
  'PDF export & WhatsApp sharing',
  'Re-scan with progress tracking',
  'Resume Weaponizer & ATS keywords',
  'Salary negotiation scripts',
];

export default function Pricing() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-xl font-black text-foreground">
            JobBachao
          </button>
          <button onClick={() => navigate('/')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-black text-foreground">
            Two Reports. One Price.<br />Your Complete Career Defense.
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            See exactly where AI threatens your career — and get the playbook to stay ahead.
          </p>
        </div>

        {/* Blurred Report Previews */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Report A — Risk Diagnosis */}
          <div className="relative rounded-2xl border border-destructive/20 bg-card overflow-hidden">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">Report A</h3>
                  <p className="text-[11px] text-destructive font-semibold">Risk Diagnosis</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                How safe is your job <em>really</em>? Get the honest, data-backed answer most career sites won't give you.
              </p>
            </div>

            {/* Blurred feature list */}
            <div className="relative px-5 pb-5">
              <div className="space-y-2.5 blur-[3px] opacity-60 select-none pointer-events-none">
                {REPORT_A_HIGHLIGHTS.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-start gap-2">
                    <Icon className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                    <span className="text-xs text-foreground">{text}</span>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20">
                  <Lock className="w-3 h-3 text-destructive" />
                  <span className="text-[11px] font-bold text-destructive">Locked</span>
                </div>
              </div>
            </div>
          </div>

          {/* Report B — Growth Playbook */}
          <div className="relative rounded-2xl border border-primary/20 bg-card overflow-hidden">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">Report B</h3>
                  <p className="text-[11px] text-primary font-semibold">Growth Playbook</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Your personalized 90-day action plan: what to learn, where to pivot, and how to earn more.
              </p>
            </div>

            {/* Blurred feature list */}
            <div className="relative px-5 pb-5">
              <div className="space-y-2.5 blur-[3px] opacity-60 select-none pointer-events-none">
                {REPORT_B_HIGHLIGHTS.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-start gap-2">
                    <Icon className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <span className="text-xs text-foreground">{text}</span>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                  <Lock className="w-3 h-3 text-primary" />
                  <span className="text-[11px] font-bold text-primary">Locked</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Price Card */}
        <div className="rounded-2xl border-2 border-primary bg-card p-8 space-y-6">
          {/* Price */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary uppercase tracking-wider mb-2">
              <Shield className="w-3.5 h-3.5" />
              Unlock Both Reports
            </div>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-5xl font-black text-foreground">₹300</span>
              <span className="text-lg text-muted-foreground">/month</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Full access to Report A + Report B · Cancel anytime
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="text-sm font-bold text-primary hover:underline transition-all mt-1"
            >
              Save 44% with yearly — ₹1,999/year →
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Everything included */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Everything included:</p>
            <ul className="space-y-2.5">
              {ALL_FEATURES.map((text) => (
                <li key={text} className="flex items-start gap-2.5 text-sm text-foreground">
                  <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <button
            onClick={() => setShowModal(true)}
            className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm transition-all flex items-center justify-center gap-2 min-h-[48px]"
          >
            <Zap className="w-4 h-4" />
            Unlock Both Reports — ₹300/month
          </button>
          <p className="text-[11px] text-muted-foreground text-center">
            🔒 Secure payment via Razorpay · UPI, cards, net banking
          </p>
        </div>

        {/* FAQ */}
        <div className="space-y-4 pt-4">
          <h3 className="text-lg font-bold text-center text-foreground">Questions?</h3>
          {[
            { q: 'What do I get?', a: 'Both reports — your full Risk Diagnosis (how safe your job is) and Growth Playbook (what to do about it) — all features unlocked.' },
            { q: 'Is there a free version?', a: 'You can run a free scan to see your Career Position Score. The two detailed reports require a subscription.' },
            { q: 'Can I cancel?', a: 'Yes. Cancel anytime from your dashboard. You keep access until the period ends.' },
            { q: 'What payment methods?', a: 'UPI, credit/debit cards, net banking, and wallets via Razorpay.' },
            { q: 'Is my data safe?', a: 'Your data is encrypted and never shared. Delete your account anytime.' },
          ].map(({ q, a }) => (
            <div key={q} className="rounded-xl bg-muted/50 p-4">
              <p className="font-semibold text-foreground text-sm">{q}</p>
              <p className="text-muted-foreground text-sm mt-1">{a}</p>
            </div>
          ))}
        </div>
      </div>

      <ProUpgradeModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        defaultTier="month"
      />
    </div>
  );
}

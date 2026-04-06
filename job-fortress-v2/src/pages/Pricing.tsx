import { useNavigate } from 'react-router-dom';
import { Check, Shield, Zap, FileText, TrendingUp } from 'lucide-react';

const INCLUDED = [
  { icon: FileText, text: 'Report A — Risk Diagnosis (Career Score, AI Impact Dossier)' },
  { icon: TrendingUp, text: 'Report B — Growth Playbook (Market Radar, Pivot Paths, Resume Weaponizer)' },
  { icon: Check, text: 'Full skill-by-skill breakdown' },
  { icon: Check, text: 'AI Strategic Dossier (streaming)' },
  { icon: Check, text: 'Side Hustle Generator' },
  { icon: Check, text: 'AI Career Coach (unlimited)' },
  { icon: Check, text: 'PDF export & WhatsApp sharing' },
  { icon: Check, text: 'Re-scan with progress tracking' },
];

export default function Pricing() {
  const navigate = useNavigate();

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

      <div className="max-w-xl mx-auto px-4 py-16 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5" />
            One-time payment
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-foreground">
            Unlock Both Reports
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            One payment. Full access to your Risk Diagnosis + Growth Playbook. No subscriptions.
          </p>
        </div>

        {/* Price Card */}
        <div className="rounded-2xl border-2 border-primary bg-card p-8 space-y-6 relative">
          {/* Price */}
          <div className="text-center space-y-1">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-5xl font-black text-foreground">₹300</span>
            </div>
            <p className="text-sm text-muted-foreground">
              One payment · Both reports · Lifetime access
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Two Reports Highlight */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-destructive/5 border border-destructive/15 p-3 text-center">
              <FileText className="w-5 h-5 text-destructive mx-auto mb-1.5" />
              <p className="text-xs font-bold text-foreground">Report A</p>
              <p className="text-[10px] text-muted-foreground">Risk Diagnosis</p>
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 text-center">
              <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1.5" />
              <p className="text-xs font-bold text-foreground">Report B</p>
              <p className="text-[10px] text-muted-foreground">Growth Playbook</p>
            </div>
          </div>

          {/* Feature list */}
          <ul className="space-y-3">
            {INCLUDED.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5 text-sm text-foreground">
                <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                {text}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <button
            disabled
            className="w-full py-3.5 rounded-xl bg-primary/60 text-primary-foreground font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <Zap className="w-4 h-4" />
            Pay ₹300 & Unlock Both Reports
          </button>
          <p className="text-[11px] text-muted-foreground text-center">
            Payment launching soon. Run your free scan now — you'll get early access.
          </p>
        </div>

        {/* FAQ */}
        <div className="space-y-4 pt-4">
          <h3 className="text-lg font-bold text-center text-foreground">Questions?</h3>
          {[
            { q: 'What do I get for ₹300?', a: 'Both reports — your full Risk Diagnosis and Growth Playbook — unlocked permanently for that scan.' },
            { q: 'Is it a subscription?', a: 'No. One payment, both reports. No recurring charges.' },
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
    </div>
  );
}

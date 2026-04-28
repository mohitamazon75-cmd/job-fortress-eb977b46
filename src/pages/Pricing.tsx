import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Star, Zap, Shield } from 'lucide-react';
import SEO from '@/components/SEO';
import { useTrack } from '@/hooks/use-track';

const FREE_FEATURES = [
  'One full AI career scan',
  'Career Position Score™',
  'Top 3 skill risk analysis',
  'Basic action plan',
  'Peer comparison',
  'WhatsApp sharing',
];

// One-payment-one-analysis rule (mem://business/monetization-constraints):
// Each Free scan analyses exactly one resume. Re-running on a new resume
// requires a new scan slot. Pro removes this cap.

const PRO_FEATURES = [
  'Everything in Free, plus:',
  'Full skill-by-skill breakdown',
  'AI Strategic Dossier (streaming)',
  'Side Hustle Generator',
  'Weekly intelligence briefs',
  'Re-scan with progress tracking',
  'PDF export',
  'Priority scan queue',
  'AI Career Coach (unlimited)',
];

export default function Pricing() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const { track } = useTrack();

  useEffect(() => {
    track('pricing_view');
  }, [track]);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Pricing — JobBachao Free & Pro Plans | AI Career Risk Score"
        description="Start free with full AI career scan and Career Position Score. Upgrade to Pro for unlimited scans, AI Strategic Dossier, side hustle generator and weekly briefs."
        canonical="https://jobbachao.com/pricing"
      />
      {/* Header */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-xl font-black text-foreground">
            JobBachao
          </button>
          <button onClick={() => navigate('/')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Home
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-16 space-y-10 sm:space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground">
            Simple, Transparent Pricing
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free. Upgrade when you want the full intelligence advantage.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billingCycle === 'monthly' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billingCycle === 'yearly' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            Yearly <span className="text-xs opacity-75">(Save 44%)</span>
          </button>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
          {/* Free */}
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-xl font-bold text-foreground">Free</h2>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">₹0</span>
                <span className="text-muted-foreground text-sm">forever</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Perfect for a quick career check-up</p>
              <p className="text-[11px] text-muted-foreground mt-1 italic">
                One scan analyses one resume. Re-scan a different resume = a new free slot.
              </p>
            </div>
            <ul className="space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-all"
            >
              Start Free Scan
            </button>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border-2 border-primary bg-card p-6 sm:p-8 space-y-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              MOST POPULAR
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Pro</h2>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">
                  {billingCycle === 'monthly' ? '₹300' : '₹1,999'}
                </span>
                <span className="text-muted-foreground text-sm">
                  {billingCycle === 'monthly' ? '/month' : '/year'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {billingCycle === 'yearly' ? 'Unlimited scans + all features' : 'Monthly access · cancel anytime'}
              </p>
            </div>
            <ul className="space-y-3">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                  <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              disabled
              className="w-full py-3 rounded-xl bg-primary/60 text-primary-foreground font-semibold transition-all flex items-center justify-center gap-2 cursor-not-allowed"
            >
              Coming Soon — Join Waitlist
            </button>
            <p className="text-[11px] text-muted-foreground text-center">
              Pro launch is imminent. Run your free scan now — you'll get early access pricing.
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto space-y-6 pt-8">
          <h3 className="text-2xl font-bold text-center text-foreground">Questions?</h3>
          <div className="space-y-4">
            {[
              { q: 'Can I try before buying?', a: 'Absolutely! The free tier gives you one full scan with your Career Position Score and top 3 skill risks. No credit card needed.' },
              { q: 'How many scans does Free include?', a: 'One free scan analyses one resume end-to-end. To analyse a different resume, you start a new free scan. Pro removes this limit — unlimited scans, unlimited re-runs.' },
              { q: 'What does Pro unlock that Free does not?', a: 'Pro unlocks the full Strategic Dossier, Side Hustle Generator, weekly intelligence briefs, PDF export, priority queue, and unlimited AI Coach questions. Free users see partial previews of these.' },
              { q: 'What payment methods do you accept?', a: 'We use Razorpay — supports UPI, credit/debit cards, net banking, and wallets.' },
              { q: 'Can I cancel anytime?', a: 'Yes. Yearly plans can be cancelled anytime. You keep access until the period ends.' },
              { q: 'Is my data safe?', a: 'Your data is encrypted, retained for 90 days per India DPDP Act, and never shared. You can delete your account and all data at any time.' },
            ].map(({ q, a }) => (
              <div key={q} className="rounded-xl bg-muted/50 p-4">
                <p className="font-semibold text-foreground text-sm">{q}</p>
                <p className="text-muted-foreground text-sm mt-1">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

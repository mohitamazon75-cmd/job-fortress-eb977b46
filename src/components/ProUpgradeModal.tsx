import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Sparkles, Star, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/lib/supabase-config';

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (tier: string) => void;
  defaultTier?: 'month' | 'year';
}

// Server is the source of truth for amounts. Client only sends `tier`.
const TIER_CONFIG = {
  month: { label: '₹300/month', tier: 'pro_monthly', description: 'Monthly pro access' },
  year: { label: '₹1,999/year', tier: 'pro', description: 'Annual pro access' },
} as const;

interface RazorpayOrderResponse {
  success: boolean;
  order_id?: string;
  amount?: number;
  currency?: string;
  key_id?: string;
  error?: string;
}

async function createServerOrder(tier: string, authToken: string): Promise<RazorpayOrderResponse> {
  const url = `${SUPABASE_URL}/functions/v1/create-razorpay-order`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ tier }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) return { success: false, error: (data as any).error || 'Order creation failed' };
  return data as RazorpayOrderResponse;
}

async function loadRazorpaySDK(): Promise<void> {
  if ((window as any).Razorpay) return;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(script);
  });
}

async function activateSubscription(
  paymentId: string, orderId: string | undefined, tier: string, authToken: string,
): Promise<{ success: boolean; error?: string }> {
  const url = `${SUPABASE_URL}/functions/v1/activate-subscription`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ payment_id: paymentId, order_id: orderId, tier }),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    return { success: false, error: (data as any).error || 'Activation failed' };
  }
  return { success: true };
}

const PRO_FEATURES = [
  { label: 'See which 3 skills are protecting your salary — and which 2 are already obsolete' },
  { label: 'Find out if your CTC is ₹1–2L below market for your role in your city' },
  { label: '12-week plan: exactly what to learn, in what order, to stay ahead of AI' },
  { label: 'Ask our AI anything: "Should I move to Hyderabad?" "What\'s my FAANG probability?"' },
  { label: 'Your score updates every month as AI advances — track it before your manager does' },
];

// (Removed SOCIAL_PROOF_AVATARS — fake hardcoded peer initials are a credibility risk.)

export default function ProUpgradeModal({ isOpen, onClose, onSuccess, defaultTier = 'year' }: ProUpgradeModalProps) {
  const [selected, setSelected] = useState<'month' | 'year'>(defaultTier);
  const [loading, setLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Update selected tier when modal opens or defaultTier changes
  useEffect(() => {
    if (isOpen) setSelected(defaultTier);
  }, [isOpen, defaultTier]);

  // Handle Escape key and modal focus restoration
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Focus trap and restore focus on close
  useEffect(() => {
    if (!isOpen) {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement;
    const modal = modalRef.current;
    if (!modal) return;

    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first?.focus();

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };

    modal.addEventListener('keydown', trapFocus);
    return () => modal.removeEventListener('keydown', trapFocus);
  }, [isOpen]);

  const handleUpgrade = useCallback(async () => {
    setLoading(true);
    setPaymentError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setPaymentError('Please sign in to upgrade.');
        setLoading(false);
        return;
      }
      await loadRazorpaySDK();
      const config = TIER_CONFIG[selected];

      // ── Create order on the server (server is the source of truth for amount) ──
      const order = await createServerOrder(config.tier, session.access_token);
      if (!order.success || !order.order_id || !order.amount || !order.key_id) {
        // If Razorpay isn't configured server-side, fall back to early-access list.
        if (order.error?.toLowerCase().includes('not configured')) {
          toast.info("You're on the early access list!", {
            description: "We'll notify you the moment payments go live. You'll get first access at this price.",
            duration: 5000,
          });
          onClose();
          return;
        }
        setPaymentError(order.error || 'Could not start checkout. Please try again.');
        setLoading(false);
        return;
      }

      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency || 'INR',
        order_id: order.order_id,
        name: 'JobBachao Pro',
        description: config.description,
        image: '/favicon.png',
        prefill: {
          email: session.user.email ?? '',
          name: session.user.user_metadata?.full_name ?? '',
        },
        notes: { tier: config.tier, user_id: session.user.id },
        theme: { color: 'hsl(217 91% 60%)' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id?: string }) => {
          try {
            const result = await activateSubscription(
              response.razorpay_payment_id, response.razorpay_order_id,
              config.tier, session.access_token,
            );
            if (!result.success) {
              setPaymentError(`Payment received but activation failed. Payment ID: ${response.razorpay_payment_id}. Contact support.`);
              setLoading(false);
              return;
            }
            toast.success("You're in. Your full defense plan is ready. 👇", {
              description: 'All Pro features are now unlocked. Scroll down to see everything.',
              duration: 5000,
            });
            window.dispatchEvent(new Event('subscription-updated'));
            onSuccess?.(config.tier);
            onClose();
          } catch {
            setPaymentError(`Activation error. Payment ID: ${response.razorpay_payment_id}. Contact support.`);
          }
          setLoading(false);
        },
        modal: { ondismiss: () => setLoading(false) },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        setPaymentError(resp.error?.description ?? 'Payment failed. Please try again.');
        setLoading(false);
      });
      rzp.open();
    } catch {
      setPaymentError('Could not open payment window. Please try again.');
      setLoading(false);
    }
  }, [selected, onClose, onSuccess]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="relative w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="px-5 pt-6 pb-5 border-b border-border flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-black text-primary uppercase tracking-wider">Career Defense</span>
              </div>
              <h2 className="text-lg font-black text-foreground leading-tight mb-2">
                Your salary is bleeding ₹3–8L over 24 months. Plug the leak for ₹10/day.
              </h2>
              <p className="text-sm text-foreground font-semibold mb-3">Less than one Swiggy order. Cancel anytime.</p>
              <p className="text-xs text-muted-foreground">
                Your scan already named the threat. This unlocks the exact 12-week plan to fight it.
              </p>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Social Proof Bar */}
          <div className="px-5 py-3 bg-muted/40 border-b border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-yellow-500 text-yellow-500" />
              ))}
              <span className="text-[11px] font-semibold text-foreground ml-1">4.9/5</span>
            </div>
            <p className="text-[11px] text-muted-foreground flex-1 text-center">Backed by deterministic scoring · India-specific market data</p>
          </div>

          {/* Pricing toggle */}
          <div className="px-5 py-4">
            <div className="grid grid-cols-2 gap-2 mb-5">
              <button
                autoFocus
                onClick={() => setSelected('month')}
                className={`rounded-xl border p-3 text-left transition-all ${selected === 'month' ? 'border-primary/40 bg-primary/5' : 'border-border bg-background'}`}
              >
                <p className="text-base font-black text-foreground">₹300</p>
                <p className="text-[11px] text-muted-foreground mt-1">per month</p>
                <p className="text-[10px] text-muted-foreground mt-1">Cancel anytime</p>
              </button>
              <button
                onClick={() => setSelected('year')}
                className={`rounded-xl border p-3 text-left transition-all relative ${selected === 'year' ? 'border-primary/40 bg-primary/5' : 'border-border bg-background'}`}
              >
                {selected === 'year' && (
                  <span className="absolute -top-2 right-2 text-[10px] font-black bg-primary text-primary-foreground px-2 py-0.5 rounded-full">BEST VALUE</span>
                )}
                <p className="text-base font-black text-foreground">₹1,999</p>
                <p className="text-[11px] text-muted-foreground mt-1">per year</p>
                <p className="text-[10px] text-muted-foreground mt-1">= ₹167/month — less than a coffee</p>
              </button>
            </div>

            {/* Features */}
            <div className="space-y-2.5 mb-5">
              {PRO_FEATURES.map(({ label }) => (
                <div key={label} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-foreground leading-relaxed">{label}</span>
                </div>
              ))}
            </div>

            {paymentError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
                <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-xs text-destructive leading-relaxed">{paymentError}</p>
              </div>
            )}

            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-70 text-primary-foreground text-sm font-black transition-colors flex items-center justify-center gap-2 min-h-[48px]"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Processing...</>
              ) : (
                selected === 'year' ? 'Best Value — ₹5.5/day' : 'Protect My Career — ₹10/day'
              )}
            </button>
            <p className="text-center text-xs text-foreground/40 mt-2">
              14-day refund if you don't find it useful. No questions asked.
            </p>
            <p className="text-center text-[10px] text-muted-foreground mt-2">
              🔒 Early access pricing · ends soon
            </p>

            {/* Risk Reversal */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
                If you don't find value in 7 days, email us — we'll refund. No questions.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

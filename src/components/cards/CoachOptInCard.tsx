import { useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, MessageCircle, Bell, Check, Sparkles, Mail, Send, Inbox } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { type ScanReport } from '@/lib/scan-engine';

interface Props {
  report: ScanReport;
  scanId?: string;
}

export default function CoachOptInCard({ report, scanId }: Props) {
  const [activated, setActivated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async () => {
    if (!scanId) {
      console.warn('CoachOptInCard: scanId missing');
      setError('Unable to connect right now — please refresh.');
      return;
    }
    if (activated) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.functions.invoke('coach-nudge', {
        body: { mode: 'schedule', scan_id: scanId, user_id: user.id },
      });
      setActivated(true);
    } catch (err) {
      console.error('[CoachOptIn] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl border-2 border-destructive/30 bg-destructive/[0.06] p-6 text-center space-y-3"
      >
        <p className="text-sm text-destructive font-bold">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-primary hover:text-primary/80 underline"
        >
          Refresh page
        </button>
      </motion.div>
    );
  }

  if (activated) {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl border-2 border-prophet-green/30 bg-prophet-green/[0.06] p-6 text-center space-y-4"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12, delay: 0.1 }}
          className="w-14 h-14 rounded-full bg-prophet-green/20 flex items-center justify-center mx-auto"
        >
          <Check className="w-7 h-7 text-prophet-green" />
        </motion.div>
        <h3 className="text-lg font-black text-foreground">Your AI Coach is Active 🧠</h3>
        <p className="text-sm text-foreground/70 leading-relaxed max-w-sm mx-auto">
          You'll get 3 personalized coaching nudges over the next 48 hours — 
          delivered to your inbox and in-app, tailored to your specific skills and career risks.
        </p>
        <div className="flex items-center justify-center gap-4 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Bell className="w-3.5 h-3.5" />
            <span>In-app</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-prophet-green font-bold">
            <Mail className="w-3.5 h-3.5" />
            <span>Email reminders</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2">
          {['Tonight\'s Move', 'Market Pulse', 'Progress Check'].map((label, i) => (
            <div key={label} className="rounded-lg bg-background/60 border border-border/50 p-2.5 text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                {i === 0 ? '+6h' : i === 1 ? '+24h' : '+48h'}
              </p>
              <p className="text-[11px] font-bold text-foreground">{label}</p>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  // Pull personalization from the scan report (with safe fallbacks)
  const roleLabel =
    (report as any)?.role_detected ||
    (report as any)?.current_role ||
    'your role';
  const topVulnerability =
    (report as any)?.survivability?.primary_vulnerability ||
    (report as any)?.top_risk_skill ||
    'your most exposed skill';

  // Trim long vulnerability strings for the preview line
  const vulnPreview =
    typeof topVulnerability === 'string' && topVulnerability.length > 70
      ? topVulnerability.slice(0, 70).trim() + '…'
      : topVulnerability;

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-6 space-y-5"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-prophet-green/10 flex items-center justify-center">
          <Mail className="w-6 h-6 text-prophet-green" />
        </div>
        <div>
          <h3 className="text-base font-black text-foreground">Your AI Career Coach</h3>
          <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
            Free · 3 nudges · 48 hours · Then we stop
          </p>
        </div>
      </div>

      <p className="text-sm text-foreground/80 leading-relaxed">
        Don't just take our word for it. Here's the <span className="font-bold text-foreground">actual first message</span> we'd send you tonight:
      </p>

      {/* Sample inbox preview — what the user will actually receive */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-xl border-2 border-dashed border-prophet-green/30 bg-background/60 overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-2 bg-prophet-green/[0.08] border-b border-prophet-green/20">
          <Inbox className="w-3.5 h-3.5 text-prophet-green" />
          <span className="text-[10px] font-black text-prophet-green uppercase tracking-wider">
            Sample · arrives in your inbox tonight
          </span>
        </div>
        <div className="p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold text-muted-foreground">From: JobBachao Coach</p>
            <p className="text-[10px] text-muted-foreground">Tonight · ~9:00 PM</p>
          </div>
          <p className="text-sm font-black text-foreground leading-snug">
            🎯 Tonight's 15-min move for {roleLabel}
          </p>
          <p className="text-xs text-foreground/75 leading-relaxed">
            Hey — based on your scan, your biggest exposure right now is{' '}
            <span className="font-bold text-foreground">{vulnPreview}</span>. Here's one specific thing you can do before bed that moves your score by Sunday. Open the playbook →
          </p>
        </div>
      </motion.div>

      {/* Compact schedule strip — what comes after the sample */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Tonight', sub: '15-min move', icon: '🎯' },
          { label: '+24h', sub: 'Market intel', icon: '📊' },
          { label: '+48h', sub: 'Progress check', icon: '🏆' },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.06 }}
            className="rounded-lg bg-muted/40 border border-border/50 p-2.5 text-center"
          >
            <p className="text-base leading-none mb-1">{item.icon}</p>
            <p className="text-[10px] font-black text-foreground uppercase tracking-wider">
              {item.label}
            </p>
            <p className="text-[10px] text-muted-foreground">{item.sub}</p>
          </motion.div>
        ))}
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleActivate}
        disabled={loading}
        className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-black text-sm tracking-wide hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <span className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
        ) : (
          <>
            <Send className="w-4 h-4" />
            Send me this tonight — Free
          </>
        )}
      </motion.button>

      <p className="text-[10px] text-muted-foreground/70 text-center leading-relaxed">
        No spam, ever. 3 emails over 48 hours, then we stop.
        <br />Unsubscribe in one click.
      </p>
    </motion.div>
  );
}

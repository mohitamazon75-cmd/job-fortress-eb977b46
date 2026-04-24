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
          <h3 className="text-base font-black text-foreground">AI Career Coach</h3>
          <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Free · Email + In-app · 48 hours</p>
        </div>
      </div>

      <p className="text-sm text-foreground/80 leading-relaxed">
        Get 3 personalized coaching nudges delivered to your email inbox — 
        actionable career advice based on your risk profile.
        Fully private, no spam.
      </p>

      <div className="space-y-2.5">
        {[
          { time: 'Tonight', icon: '🎯', desc: 'One action you can do in 15 min — delivered to your inbox' },
          { time: 'Tomorrow', icon: '📊', desc: 'Market intel for your role — fresh insights via email' },
          { time: 'Day 2', icon: '🏆', desc: 'Progress check + challenge a colleague to scan' },
        ].map((item, i) => (
          <motion.div
            key={item.time}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="flex items-center gap-3 rounded-xl bg-muted/50 border border-border/50 p-3"
          >
            <span className="text-lg">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-foreground">{item.time}</p>
              <p className="text-[11px] text-muted-foreground">{item.desc}</p>
            </div>
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
            <Sparkles className="w-4 h-4" />
            Activate My AI Coach — Free
          </>
        )}
      </motion.button>

      <p className="text-[10px] text-muted-foreground/60 text-center">
        No spam, ever. Just 3 nudges over 48 hours, then we stop.
      </p>
    </motion.div>
  );
}

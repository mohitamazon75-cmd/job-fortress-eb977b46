import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CohortRankCardProps {
  userId: string;
  role: string;
  city: string;
  score: number;
  isProUser?: boolean;
  onUpgradeClick?: () => void;
}

interface CohortData {
  safer_than_pct: number;
  cohort_size: number;
  city_label: string;
}

export default function CohortRankCard({
  userId,
  role,
  city,
  score,
  isProUser,
  onUpgradeClick,
}: CohortRankCardProps) {
  const [data, setData] = useState<CohortData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCohort() {
      try {
        const { data: res } = await supabase.functions.invoke('get-cohort-rank', {
          body: { userId, role, city, score },
        });
        if (res) {
          setData(res);
        }
      } catch {
        // Silent failure — no cohort data available
      } finally {
        setLoading(false);
      }
    }

    fetchCohort();
  }, [userId, role, city, score]);

  if (loading) {
    return <div className="rounded-2xl border border-border/50 bg-card/50 p-4 animate-pulse h-20" />;
  }

  if (!data) return null;

  // N≥50 minimum: a cohort of fewer than 50 peers produces a statistically meaningless
  // percentile. Showing "you're in the 68th percentile" at N=3 damages credibility with
  // any quantitatively literate professional. Show a "building" message instead.
  if (data.cohort_size < 50) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/50 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-primary" />
          <p className="text-xs font-semibold text-foreground/50 uppercase tracking-widest">Peer Comparison</p>
        </div>
        <p className="text-sm text-foreground/70">
          Building your cohort — {data.cohort_size} {role} professionals tracked so far.
          Check back in 30 days as more peers scan.
        </p>
      </div>
    );
  }

  const pct = Math.round(data.safer_than_pct);
  const barWidth = Math.max(5, Math.min(95, pct));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/50 bg-card/50 p-5 relative overflow-hidden"
    >
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-primary" />
        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-widest">Peer Comparison</p>
      </div>

      {isProUser ? (
        <>
          <p className="text-base font-bold text-foreground mb-1">
            You're safer than <span className="text-primary">{pct}%</span> of{' '}
            <span className="text-foreground/80">{role}</span> professionals in{' '}
            <span className="text-foreground/80">{data.city_label}</span>
          </p>
          <p className="text-xs text-foreground/40 mb-3">{data.cohort_size.toLocaleString()} peers tracked</p>
          {/* Progress bar */}
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${barWidth}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
            />
          </div>
        </>
      ) : (
        <>
          <p className="text-base font-bold text-foreground mb-1">
            You rank in the{' '}
            <span className="blur-sm select-none text-primary">top XX%</span>{' '}
            of {role} professionals in {data.city_label}
          </p>
          <p className="text-xs text-foreground/40 mb-3">{data.cohort_size.toLocaleString()} peers tracked</p>
          <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary/20 to-primary/40 blur-sm" />
          </div>
          <button
            onClick={onUpgradeClick}
            className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
          >
            <Lock className="w-3 h-3" />
            Unlock your exact rank with Pro
          </button>
        </>
      )}
    </motion.div>
  );
}

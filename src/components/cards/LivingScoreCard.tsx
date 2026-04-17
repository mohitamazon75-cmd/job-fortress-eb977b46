import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LivingScoreCardProps {
  userId: string;
  baseScore: number;
  role: string;
}

interface DriftData {
  currentScore: number;
  drift: number;
  driftReason: string | null;
}

export default function LivingScoreCard({ userId, baseScore, role }: LivingScoreCardProps) {
  const [data, setData] = useState<DriftData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDrift() {
      try {
        const { data: res, error: driftErr } = await supabase.functions.invoke('score-drift', {
          body: { userId },
        });
        if (res && Math.abs(res.drift) >= 0.5) {
          setData(res);
        }
      } catch {
        // Silent failure — no drift data available
      } finally {
        setLoading(false);
      }
    }

    fetchDrift();
  }, [userId]);

  if (loading || !data) return null;

  const isPositive = data.drift > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const colorClass = isPositive
    ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
    : 'text-amber-400 border-amber-500/20 bg-amber-500/5';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${colorClass}`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="font-semibold">
        {isPositive ? '+' : ''}{data.drift.toFixed(1)} pts this month
      </span>
      {data.driftReason && (
        <span className="text-foreground/60 text-xs">— {data.driftReason}</span>
      )}
    </motion.div>
  );
}

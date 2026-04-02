import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';

interface TimelinePoint {
  month: string;
  score: number;
  event?: string;
}

interface ScoreTimelineProps {
  userId: string;
  currentScore: number;
}

export default function ScoreTimeline({ userId, currentScore }: ScoreTimelineProps) {
  const [points, setPoints] = useState<TimelinePoint[]>([]);

  useEffect(() => {
    async function load() {
      try {
        // Get score history
        const { data: history } = await supabase
          .from('score_history' as string)
          .select('created_at, determinism_index, survivability_score')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(12);

        // Get score events (drift events)
        const { data: events } = await supabase
          .from('score_events' as string)
          .select('computed_at, delta, reason, event_type')
          .eq('user_id', userId)
          .order('computed_at', { ascending: true })
          .limit(20);

        if (!history?.length) return;

        const mapped: TimelinePoint[] = history.map((h) => ({
          month: new Date(h.created_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
          score: h.determinism_index ?? h.survivability_score ?? currentScore,
        }));

        // Overlay drift events on existing points
        events?.forEach((ev) => {
          const evMonth = new Date(ev.computed_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
          const existing = mapped.find((p) => p.month === evMonth);
          if (existing) existing.event = ev.reason;
        });

        // Add current point
        const now = new Date().toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        if (!mapped.find((p) => p.month === now)) {
          mapped.push({ month: now, score: currentScore, event: 'Current' });
        }

        setPoints(mapped);
      } catch {
        // Silent failure — no history available
      }
    }

    load();
  }, [userId, currentScore]);

  if (points.length < 2) return null;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 p-4">
      <p className="text-xs font-semibold text-foreground/50 uppercase tracking-widest mb-3">Score History</p>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(value: number) => [`${value}/100`, 'Score']}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="hsl(217 91% 60%)"
            strokeWidth={2}
            dot={{ fill: 'hsl(217 91% 60%)', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

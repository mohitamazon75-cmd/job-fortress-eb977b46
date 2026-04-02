import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  monthsRemaining: number;
}

export default function CountdownTimer({ monthsRemaining }: CountdownTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  // Convert months to total seconds from now
  const totalSeconds = monthsRemaining * 30 * 24 * 60 * 60;

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const remaining = Math.max(0, totalSeconds - elapsed);
  const days = Math.floor(remaining / (24 * 60 * 60));
  const hours = Math.floor((remaining % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((remaining % (60 * 60)) / 60);
  const seconds = remaining % 60;

  const units = [
    { label: 'DAYS', value: days },
    { label: 'HRS', value: hours },
    { label: 'MIN', value: minutes },
    { label: 'SEC', value: seconds },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-xl border border-prophet-red/20 bg-prophet-red/[0.02] p-4"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-prophet-red mb-3 text-center">
        ⏱ Estimated Time Before Significant AI Impact
      </p>
      <div className="flex items-center justify-center gap-2 md:gap-3">
        {units.map((unit, i) => (
          <div key={unit.label} className="flex items-center gap-2 md:gap-3">
            <div className="text-center">
              <motion.p
                key={unit.value}
                initial={{ y: -5, opacity: 0.5 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-2xl md:text-3xl font-black text-prophet-red font-mono tabular-nums"
              >
                {String(unit.value).padStart(unit.label === 'DAYS' ? 1 : 2, '0')}
              </motion.p>
              <p className="text-[10px] md:text-[11px] font-bold text-muted-foreground tracking-widest mt-0.5">{unit.label}</p>
            </div>
            {i < units.length - 1 && (
              <span className="text-prophet-red/30 text-xl font-bold mb-3">:</span>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground text-center mt-2">
        Based on current AI adoption rates in your industry. Individual timing varies.
      </p>
    </motion.div>
  );
}

import { useState, useCallback } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface MicroFeedbackProps {
  scanId: string;
  cardId: string; // e.g. 'diagnosis_skill_table', 'defense_judo', 'intel_company_news'
  label?: string;
}

export default function MicroFeedback({ scanId, cardId, label = 'Was this useful?' }: MicroFeedbackProps) {
  const [vote, setVote] = useState<'up' | 'down' | null>(null);

  const handleVote = useCallback(async (v: 'up' | 'down') => {
    if (vote) return; // already voted
    setVote(v);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await (supabase.from('beta_events' as any).insert({
        event_type: 'micro_feedback',
        user_id: user?.id || null,
        payload: {
          scan_id: scanId,
          card_id: cardId,
          vote: v,
          timestamp: new Date().toISOString(),
        },
      }) as any);
    } catch (e) {
      console.debug('[micro-feedback] failed:', e);
    }
  }, [vote, scanId, cardId]);

  if (vote) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {vote === 'up' ? (
          <ThumbsUp className="w-3 h-3 text-primary fill-primary" />
        ) : (
          <ThumbsDown className="w-3 h-3 text-destructive fill-destructive" />
        )}
        <span>Thanks for the feedback!</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
      <span>{label}</span>
      <button
        onClick={() => handleVote('up')}
        className="p-1 rounded hover:bg-primary/10 hover:text-primary transition-colors"
        aria-label="Useful"
      >
        <ThumbsUp className="w-3 h-3" />
      </button>
      <button
        onClick={() => handleVote('down')}
        className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
        aria-label="Not useful"
      >
        <ThumbsDown className="w-3 h-3" />
      </button>
    </div>
  );
}

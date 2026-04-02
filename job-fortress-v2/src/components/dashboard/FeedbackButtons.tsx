import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface FeedbackButtonsProps {
  scanId: string;
  cardName: string;
}

export default function FeedbackButtons({ scanId, cardName }: FeedbackButtonsProps) {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const handleFeedback = async (type: 'up' | 'down') => {
    if (feedback) return; // Already submitted
    setFeedback(type);

    try {
      await (supabase.from('scan_feedback' as any).insert({
        scan_id: scanId,
        accuracy_rating: type === 'up' ? 5 : 1,
        relevance_rating: type === 'up' ? 5 : 1,
        feedback_text: `${cardName}: ${type === 'up' ? 'helpful' : 'not helpful'}`,
      }) as any);
    } catch {
      // Silent fail — feedback is non-critical
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleFeedback('up')}
        disabled={!!feedback}
        className={`p-1 rounded transition-colors ${
          feedback === 'up' ? 'text-prophet-green' : 'text-muted-foreground/40 hover:text-prophet-green'
        }`}
        title="Helpful"
      >
        <ThumbsUp className="w-3 h-3" />
      </button>
      <button
        onClick={() => handleFeedback('down')}
        disabled={!!feedback}
        className={`p-1 rounded transition-colors ${
          feedback === 'down' ? 'text-prophet-red' : 'text-muted-foreground/40 hover:text-prophet-red'
        }`}
        title="Not helpful"
      >
        <ThumbsDown className="w-3 h-3" />
      </button>
    </div>
  );
}

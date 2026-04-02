import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface FeedbackWidgetProps {
  scanId: string;
}

export default function FeedbackWidget({ scanId }: FeedbackWidgetProps) {
  const [accuracy, setAccuracy] = useState(0);
  const [relevance, setRelevance] = useState(0);
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (accuracy === 0) return;
    setSubmitting(true);
    try {
      await supabase.from('scan_feedback').insert({
        scan_id: scanId,
        accuracy_rating: accuracy,
        relevance_rating: relevance || null,
        feedback_text: text || null,
      });

      if (accuracy <= 2) {
        await supabase.from('scans').update({
          feedback_flag: 'low_accuracy',
        }).eq('id', scanId);
      }

      setSubmitted(true);
    } catch (e) {
      console.error('Feedback submit error:', e);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 rounded-xl border border-prophet-green/20 bg-prophet-green/[0.02] p-4 text-center">
        <p className="text-sm font-bold text-prophet-green">Thank you for your feedback! 🙏</p>
      </motion.div>
    );
  }

  const StarRow = ({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) => (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-20">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} onClick={() => onChange(star)} className="transition-colors">
            <Star className={`w-5 h-5 ${star <= value ? 'fill-prophet-gold text-prophet-gold' : 'text-muted-foreground/30'}`} />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-primary" />
        <p className="text-xs font-black text-foreground uppercase tracking-wider">Rate This Analysis</p>
      </div>
      <div className="space-y-2 mb-3">
        <StarRow value={accuracy} onChange={setAccuracy} label="Accuracy" />
        <StarRow value={relevance} onChange={setRelevance} label="Relevance" />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Optional: What could be better?"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        rows={2}
      />
      <button
        onClick={handleSubmit}
        disabled={accuracy === 0 || submitting}
        className="mt-2 px-4 py-1.5 rounded-lg text-xs font-bold text-primary-foreground disabled:opacity-50"
        style={{ background: 'var(--gradient-primary)' }}
      >
        {submitting ? 'Submitting...' : 'Submit Feedback'}
      </button>
    </div>
  );
}

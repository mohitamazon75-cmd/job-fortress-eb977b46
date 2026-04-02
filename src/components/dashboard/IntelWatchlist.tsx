import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/lib/supabase-config';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import IntelSignalCard from './IntelSignalCard';

interface RoleIntelSignal {
  id: string;
  headline: string;
  summary: string;
  relevance_score: number;
  relevance_reason: string;
  signal_type: 'company' | 'market' | 'skill_threat' | 'opportunity' | 'salary';
  action_prompt?: string;
  source_url?: string;
  published_at: string;
  stale?: boolean;
  fallback?: boolean;
}

interface WatchlistItem {
  id: string;
  user_id: string;
  signal_json: RoleIntelSignal;
  added_at: string;
}

interface IntelWatchlistProps {
  userId: string;
  onWatchlistChange?: () => void;
}

export default function IntelWatchlist({ userId, onWatchlistChange }: IntelWatchlistProps) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );

  useEffect(() => {
    fetchWatchlist();
  }, [userId]);

  const fetchWatchlist = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('intel_watchlist')
        .select('*')
        .eq('user_id', userId)
        .order('added_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
      setIsOpen((data?.length ?? 0) > 0);
    } catch (error) {
      console.error('[IntelWatchlist] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (watchlistId: string, signal: RoleIntelSignal) => {
    try {
      setRemoving(watchlistId);
      // Optimistic removal
      setItems(items.filter(item => item.id !== watchlistId));

      const { error } = await supabase
        .from('intel_watchlist')
        .delete()
        .eq('id', watchlistId);

      if (error) {
        // Restore on error
        fetchWatchlist();
        console.error('[IntelWatchlist] Remove error:', error);
        return;
      }

      onWatchlistChange?.();
    } catch (error) {
      console.error('[IntelWatchlist] Remove error:', error);
      fetchWatchlist();
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-8 bg-muted rounded-lg w-32" />
        <div className="h-24 bg-muted rounded-lg" />
      </div>
    );
  }

  const headerText = `Saved Signals (${items.length})`;
  const isEmpty = items.length === 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-6">
      {/* Header */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between mb-3"
      >
        <h3 className="text-sm font-semibold text-foreground">{headerText}</h3>
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.2 }}
        >
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </motion.div>
      </motion.button>

      {/* Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {isEmpty ? (
              <p className="text-xs text-muted-foreground italic">
                No saved signals yet. Add signals from the feed below.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <IntelSignalCard
                    key={item.id}
                    signal={item.signal_json}
                    onAddToWatchlist={() => {}}
                    isWatchlisted={true}
                    onRemoveFromWatchlist={() => handleRemove(item.id, item.signal_json)}
                    compact={true}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

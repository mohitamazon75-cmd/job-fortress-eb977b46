import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, MessageCircle, ExternalLink, Eye, X, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface NudgeContent {
  title: string;
  message: string;
  action_label: string;
  action_type: string;
  skill_focus?: string;
  whatsapp_text: string;
}

interface Nudge {
  id: string;
  nudge_type: string;
  scheduled_at: string;
  delivered_at: string | null;
  seen_at: string | null;
  content: NudgeContent | null;
}

export default function CoachNudgeWidget() {
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNudges();
    // Poll every 5 minutes for new nudges
    const interval = setInterval(fetchNudges, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchNudges = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('coach-nudge', {
        body: { mode: 'fetch' },
      });
      if (!error && data?.nudges) {
        setNudges(data.nudges);
      }
    } catch (err) {
      console.error('[CoachWidget] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const markSeen = async (nudgeId: string) => {
    try {
      await supabase.functions.invoke('coach-nudge', {
        body: { mode: 'mark_seen', nudge_id: nudgeId },
      });
      setNudges(prev => prev.map(n => n.id === nudgeId ? { ...n, seen_at: new Date().toISOString() } : n));
    } catch (err) {
      console.error('[CoachWidget] Mark seen error:', err);
    }
  };

  const deliveredNudges = nudges.filter(n => n.content && n.delivered_at);
  const unseenCount = deliveredNudges.filter(n => !n.seen_at).length;
  const pendingCount = nudges.filter(n => !n.delivered_at).length;

  if (loading || nudges.length === 0) return null;

  const handleWhatsApp = (text: string) => {
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const getNudgeEmoji = (type: string) => {
    if (type === '6h') return '🎯';
    if (type === '24h') return '📊';
    return '🏆';
  };

  const getNudgeLabel = (type: string) => {
    if (type === '6h') return "Tonight's Move";
    if (type === '24h') return 'Market Pulse';
    return 'Progress Check';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Brain className="w-5 h-5 text-primary" />
          <span className="text-sm font-black text-foreground">AI Career Coach</span>
          {unseenCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center"
            >
              {unseenCount}
            </motion.span>
          )}
        </div>
        {pendingCount > 0 && (
          <span className="text-[10px] font-bold text-muted-foreground">
            {pendingCount} more coming
          </span>
        )}
      </div>

      {/* Nudge cards */}
      <div className="px-4 pb-4 space-y-2">
        {deliveredNudges.map((nudge) => {
          const content = nudge.content!;
          const isExpanded = expandedId === nudge.id;
          const isUnseen = !nudge.seen_at;

          return (
            <motion.div
              key={nudge.id}
              layout
              className={`rounded-xl border transition-all cursor-pointer ${
                isUnseen
                  ? 'border-primary/30 bg-primary/[0.06]'
                  : 'border-border/50 bg-muted/30'
              }`}
              onClick={() => {
                setExpandedId(isExpanded ? null : nudge.id);
                if (isUnseen) markSeen(nudge.id);
              }}
            >
              <div className="flex items-center gap-3 p-3.5">
                <span className="text-lg flex-shrink-0">{getNudgeEmoji(nudge.nudge_type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground truncate">{content.title}</p>
                    {isUnseen && (
                      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {getNudgeLabel(nudge.nudge_type)}
                  </p>
                </div>
                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3.5 pb-3.5 pt-0 space-y-3 border-t border-border/30">
                      <p className="text-sm text-foreground/80 leading-relaxed pt-3">
                        {content.message}
                      </p>

                      {content.skill_focus && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                          <span className="text-[10px] font-bold text-primary">Focus: {content.skill_focus}</span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleWhatsApp(content.whatsapp_text);
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-prophet-green/10 border border-prophet-green/20 text-prophet-green text-xs font-bold hover:bg-prophet-green/20 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          Share on WhatsApp
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {/* Pending nudges preview */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/40 border border-dashed border-border/50">
            <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-[11px] text-muted-foreground">
              {pendingCount === 1 ? 'Your next coaching nudge' : `${pendingCount} more coaching nudges`} arriving soon
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookMarked, Plus, Trash2, ChevronDown, ChevronUp, Loader2, Lock, Zap, Save, X, Brain, SkipForward, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/use-subscription';
import ProUpgradeModal from '@/components/ProUpgradeModal';

interface UserStory {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string | null;
  tags: string[];
  source_scan_id: string | null;
  created_at: string;
}

const FREE_LIMIT = 3;

interface StoryBankWidgetProps {
  userId?: string;
  scanId?: string;
}

export default function StoryBankWidget({ userId, scanId }: StoryBankWidgetProps) {
  const { isActive } = useSubscription();
  const [stories, setStories] = useState<UserStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showProModal, setShowProModal] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: '',
    situation: '',
    task: '',
    action: '',
    result: '',
    reflection: '',
  });

  const fetchStories = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('user_stories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setStories((data || []) as UserStory[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stories');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const atFreeLimit = !isActive && stories.length >= FREE_LIMIT;
  const canCompose = userId && !atFreeLimit;

  const resetForm = () => {
    setForm({ title: '', situation: '', task: '', action: '', result: '', reflection: '' });
    setComposing(false);
  };

  const handleSave = async () => {
    if (!userId) return;
    if (!form.title.trim() || !form.situation.trim() || !form.task.trim() || !form.action.trim() || !form.result.trim()) {
      setError('Title, Situation, Task, Action and Result are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('user_stories')
        .insert({
          user_id: userId,
          source_scan_id: scanId || null,
          title: form.title.trim(),
          situation: form.situation.trim(),
          task: form.task.trim(),
          action: form.action.trim(),
          result: form.result.trim(),
          reflection: form.reflection.trim() || null,
          tags: [],
        });
      if (err) throw err;
      resetForm();
      await fetchStories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save story');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!userId) return;
    if (!confirm('Delete this story? This cannot be undone.')) return;
    try {
      const { error: err } = await supabase.from('user_stories').delete().eq('id', id);
      if (err) throw err;
      await fetchStories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  // Sign-in required
  if (!userId) {
    return (
      <div className="rounded-xl border-2 border-border bg-card p-5 text-center space-y-2 mb-5">
        <BookMarked className="w-6 h-6 text-muted-foreground mx-auto" />
        <p className="text-sm font-bold text-foreground">Sign in to build your Story Bank</p>
        <p className="text-[11px] text-muted-foreground">Save reusable interview stories that work across roles.</p>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border-2 border-prophet-cyan/20 bg-prophet-cyan/[0.03] p-4 mb-5"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <BookMarked className="w-4 h-4 text-prophet-cyan mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-widest text-prophet-cyan/80">
                Story Bank · STAR + Reflection
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                5–10 strong stories beat 100 memorised answers. Reuse across every interview.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
            {stories.length}{!isActive && ` / ${FREE_LIMIT}`}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 text-prophet-cyan animate-spin" />
          </div>
        ) : (
          <>
            {/* Story list */}
            {stories.length > 0 && (
              <div className="space-y-2 mb-3">
                {stories.map((s) => {
                  const open = expanded === s.id;
                  return (
                    <div key={s.id} className="rounded-lg border border-border bg-card overflow-hidden">
                      <button
                        onClick={() => setExpanded(open ? null : s.id)}
                        className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-muted/40 transition-colors"
                      >
                        <span className="text-sm font-bold text-foreground truncate">{s.title}</span>
                        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                      </button>
                      <AnimatePresence>
                        {open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 space-y-2 text-xs text-foreground/85 border-t border-border pt-3">
                              <Field label="Situation" value={s.situation} />
                              <Field label="Task" value={s.task} />
                              <Field label="Action" value={s.action} />
                              <Field label="Result" value={s.result} />
                              {s.reflection && <Field label="Reflection" value={s.reflection} muted />}
                              <button
                                onClick={() => handleDelete(s.id)}
                                className="text-[11px] text-destructive hover:underline inline-flex items-center gap-1 mt-2"
                              >
                                <Trash2 className="w-3 h-3" /> Delete story
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Composer */}
            {composing ? (
              <div className="rounded-lg border-2 border-prophet-cyan/40 bg-card p-3 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-black uppercase tracking-wider text-prophet-cyan">New story</p>
                  <button onClick={resetForm} className="text-muted-foreground hover:text-foreground" aria-label="Cancel">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <Input placeholder="Title (e.g. Shipped checkout in 6 weeks)" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
                <TextArea placeholder="Situation — context and stakes" value={form.situation} onChange={(v) => setForm({ ...form, situation: v })} />
                <TextArea placeholder="Task — what you owned" value={form.task} onChange={(v) => setForm({ ...form, task: v })} />
                <TextArea placeholder="Action — what you specifically did" value={form.action} onChange={(v) => setForm({ ...form, action: v })} />
                <TextArea placeholder="Result — measurable outcome" value={form.result} onChange={(v) => setForm({ ...form, result: v })} />
                <TextArea placeholder="Reflection — what you'd do differently (optional, signals seniority)" value={form.reflection} onChange={(v) => setForm({ ...form, reflection: v })} />
                {error && <p className="text-[11px] text-destructive">{error}</p>}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-prophet-cyan text-white font-black text-xs hover:bg-prophet-cyan/90 transition-colors disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save to bank
                </button>
              </div>
            ) : atFreeLimit ? (
              <button
                onClick={() => setShowProModal(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 text-primary font-bold text-xs hover:bg-primary/10 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                Free limit reached ({FREE_LIMIT}) · <span className="inline-flex items-center gap-1"><Zap className="w-3 h-3" />Unlock unlimited</span>
              </button>
            ) : canCompose ? (
              <button
                onClick={() => setComposing(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed border-prophet-cyan/40 bg-prophet-cyan/5 text-prophet-cyan font-bold text-xs hover:bg-prophet-cyan/10 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {stories.length === 0 ? 'Save your first story' : 'Add another story'}
              </button>
            ) : null}

            {error && !composing && (
              <p className="text-[11px] text-destructive mt-2">{error}</p>
            )}

            {stories.length === 0 && !composing && (
              <p className="text-[10px] text-muted-foreground/80 mt-2 text-center">
                Tip: a great story has a measurable result and one honest reflection.
              </p>
            )}
          </>
        )}
      </motion.div>

      <ProUpgradeModal isOpen={showProModal} onClose={() => setShowProModal(false)} />
    </>
  );
}

function Field({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className={`text-[10px] font-black uppercase tracking-widest ${muted ? 'text-muted-foreground/70' : 'text-prophet-cyan/70'}`}>{label}</p>
      <p className="whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  );
}

function Input({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={120}
      className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-prophet-cyan/40"
    />
  );
}

function TextArea({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={1000}
      rows={2}
      className="w-full px-3 py-2 rounded-md border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-prophet-cyan/40 resize-none"
    />
  );
}

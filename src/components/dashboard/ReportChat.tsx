import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, User, Loader2, Lock, Crown, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/lib/supabase-config';
import { SimpleMarkdown } from './SimpleMarkdown';

type Msg = { role: 'user' | 'assistant'; content: string };

const MAX_QUESTIONS_PER_SCAN = 10;
const MONTHLY_FREE_LIMIT = 5;

const SUGGESTED_QUESTIONS = [
  "What's my biggest career risk right now?",
  "How can I future-proof my skills?",
  "What salary should I target next?",
  "Should I switch industries?",
];

function getDaysUntilReset(resetAt: string | null): string {
  if (!resetAt) return 'in 30 days';
  const resetDate = new Date(resetAt);
  resetDate.setDate(resetDate.getDate() + 30);
  const days = Math.ceil((resetDate.getTime() - Date.now()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

function getResetDateLabel(resetAt: string | null): string {
  if (!resetAt) return '';
  const resetDate = new Date(resetAt);
  resetDate.setDate(resetDate.getDate() + 30);
  return resetDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export default function ReportChat({ scanId, accessToken, inline }: { scanId: string; accessToken?: string; inline?: boolean }) {
  const [open, setOpen] = useState(inline ? true : false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Monthly usage state
  const [isPro, setIsPro] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [monthlyRemaining, setMonthlyRemaining] = useState(MONTHLY_FREE_LIMIT);
  const [resetAt, setResetAt] = useState<string | null>(null);
  const [usageLoaded, setUsageLoaded] = useState(false);

  // Per-scan count (local)
  const scanQuestionCount = useMemo(() => messages.filter(m => m.role === 'user').length, [messages]);
  const scanQuestionsLeft = MAX_QUESTIONS_PER_SCAN - scanQuestionCount;

  // Effective limit: the most restrictive of monthly and per-scan
  const isMonthlyExhausted = !isPro && !isAnonymous && monthlyRemaining <= 0;
  const isScanExhausted = scanQuestionsLeft <= 0;
  const isExhausted = isMonthlyExhausted || isScanExhausted;

  // Usage bar color
  const barColor = isPro ? 'bg-prophet-green' : monthlyUsed <= 2 ? 'bg-prophet-green' : monthlyUsed <= 4 ? 'bg-prophet-gold' : 'bg-destructive';
  const barPct = isPro ? 0 : Math.min(100, (monthlyUsed / MONTHLY_FREE_LIMIT) * 100);

  // Fetch initial usage on mount
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsAnonymous(true);
          setMonthlyRemaining(MONTHLY_FREE_LIMIT);
          setUsageLoaded(true);
          return;
        }
        setIsAnonymous(false);

        const { data } = await supabase
          .from('profiles')
          .select('coach_questions_used, coach_usage_reset_at, subscription_tier, subscription_expires_at')
          .eq('id', user.id)
          .single();

        if (data) {
          const proActive = data.subscription_tier === 'pro' && 
            data.subscription_expires_at && new Date(data.subscription_expires_at) > new Date();
          setIsPro(!!proActive);
          
          // Check if reset needed (30 days)
          const resetTime = data.coach_usage_reset_at ? new Date(data.coach_usage_reset_at) : new Date();
          const needsReset = resetTime.getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000;
          const used = needsReset ? 0 : (data.coach_questions_used || 0);
          
          setMonthlyUsed(used);
          setMonthlyRemaining(proActive ? 999 : Math.max(0, MONTHLY_FREE_LIMIT - used));
          setResetAt(data.coach_usage_reset_at);
        }
      } catch (err) {
        console.error('[ReportChat] Usage fetch error:', err);
      }
      setUsageLoaded(true);
    };
    fetchUsage();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading || isExhausted) return;
    
    // Pre-check monthly limit for free authenticated users
    if (!isPro && !isAnonymous && monthlyRemaining <= 0) {
      setShowLimitModal(true);
      return;
    }

    const userMsg: Msg = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    let assistantSoFar = '';

    try {
      const CHAT_URL = `${SUPABASE_URL}/functions/v1/chat-report`;

      const { data: { user } } = await supabase.auth.getUser();
      const authToken = user
        ? (await supabase.auth.getSession()).data.session?.access_token
        : SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg], scanId, accessToken }),
      });

      // Handle 402 — monthly limit reached
      if (resp.status === 402) {
        const err = await resp.json().catch(() => ({}));
        if (err.code === 'COACH_LIMIT_REACHED') {
          setMonthlyRemaining(0);
          setMonthlyUsed(MONTHLY_FREE_LIMIT);
          setShowLimitModal(true);
          // Remove the user message we optimistically added
          setMessages(prev => prev.slice(0, -1));
          setLoading(false);
          return;
        }
      }

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: 'Failed' }));
        setMessages(prev => [...prev, { role: 'assistant', content: err.error || 'Something went wrong. Please try again.' }]);
        setLoading(false);
        return;
      }

      // Read remaining count from response header
      const remainingHeader = resp.headers.get('X-Coach-Questions-Remaining');
      if (remainingHeader !== null) {
        const remaining = parseInt(remainingHeader, 10);
        if (!isNaN(remaining)) {
          setMonthlyRemaining(remaining);
          setMonthlyUsed(remaining >= 999 ? 0 : MONTHLY_FREE_LIMIT - remaining);
        }
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: 'assistant', content: assistantSoFar }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch {
            buf = line + '\n' + buf;
            break;
          }
        }
      }

      // flush remaining
      if (buf.trim()) {
        for (const raw of buf.split('\n')) {
          if (!raw.startsWith('data: ')) continue;
          const json = raw.slice(6).trim();
          if (json === '[DONE]') continue;
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch {}
        }
      }

      if (!assistantSoFar) {
        setMessages(prev => [...prev, { role: 'assistant', content: "I couldn't generate a response. Please try again." }]);
      }
    } catch (e) {
      console.error('Chat error:', e);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    }
    setLoading(false);
  }, [loading, isExhausted, isPro, isAnonymous, monthlyRemaining, messages, scanId, accessToken]);

  // ── Usage counter component ────────────────────────────────
  const UsageCounter = () => {
    if (!usageLoaded) return null;
    if (isPro) {
      return (
        <div className="flex items-center gap-1.5 text-[10px] text-prophet-green font-bold">
          <span>∞</span> Unlimited questions
        </div>
      );
    }
    if (isAnonymous) {
      return null; // Don't show counter for anonymous users
    }
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground font-semibold">
            {monthlyUsed} of {MONTHLY_FREE_LIMIT} questions used this month
          </span>
          {resetAt && (
            <span className="text-muted-foreground/60 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" /> Resets {getDaysUntilReset(resetAt)}
            </span>
          )}
        </div>
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${barPct}%` }} />
        </div>
      </div>
    );
  };

  // ── Limit modal ────────────────────────────────────────────
  const LimitModal = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-10 bg-background/90 backdrop-blur-sm flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl border-2 border-primary/20 bg-card p-6 text-center space-y-4 max-w-xs w-full shadow-lg"
      >
        <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7 text-destructive" />
        </div>
        <h3 className="text-base font-black text-foreground">
          {isAnonymous ? "Sign up to continue" : "You've used your 5 free questions this month"}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {isAnonymous
            ? "Create a free account to track your monthly questions and save this conversation."
            : `Your questions reset ${resetAt ? `on ${getResetDateLabel(resetAt)}` : 'in 30 days'}. Or unlock unlimited conversations with Pro.`
          }
        </p>
        <div className="space-y-2">
          {isAnonymous ? (
            <button
              onClick={() => { window.location.href = '/auth'; }}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm flex items-center justify-center gap-2"
            >
              Sign up free
            </button>
          ) : (
            <>
              <button
                onClick={() => { window.location.href = '/pricing'; }}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4" /> Unlock Pro →
              </button>
              <button
                onClick={() => setShowLimitModal(false)}
                className="w-full py-2.5 rounded-xl border border-border text-muted-foreground text-xs font-semibold hover:bg-muted/50 transition-colors"
              >
                Wait for reset — {getDaysUntilReset(resetAt)}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );

  // ── Header subtitle ────────────────────────────────────────
  const headerSubtitle = isMonthlyExhausted
    ? 'Monthly limit reached'
    : isScanExhausted
      ? 'Scan question limit reached'
      : isPro
        ? 'Unlimited questions · Grounded in your report data'
        : isAnonymous
          ? `${scanQuestionsLeft} question${scanQuestionsLeft === 1 ? '' : 's'} remaining · Grounded in your report data`
          : `${Math.min(monthlyRemaining, scanQuestionsLeft)} question${Math.min(monthlyRemaining, scanQuestionsLeft) === 1 ? '' : 's'} remaining`;

  const inputPlaceholder = isMonthlyExhausted
    ? `Limit reached — resets ${getDaysUntilReset(resetAt)}`
    : isScanExhausted
      ? 'Question limit reached for this scan'
      : `Ask about your career...`;

  // Inline mode
  if (inline) {
    return (
      <div className="rounded-2xl border border-border bg-card flex flex-col overflow-hidden relative" style={{ minHeight: '500px', maxHeight: '70vh' }}>
        <AnimatePresence>{showLimitModal && <LimitModal />}</AnimatePresence>
        {/* Header */}
        <div className="px-4 py-3 border-b border-border" style={{ background: 'var(--gradient-primary)' }}>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary-foreground" />
            <div>
              <p className="text-sm font-black text-primary-foreground">AI Career Coach</p>
              <p className="text-[10px] text-primary-foreground/70">{headerSubtitle}</p>
            </div>
          </div>
        </div>

        {/* Usage counter */}
        {!isPro && !isAnonymous && usageLoaded && (
          <div className="px-4 py-2 border-b border-border bg-muted/30">
            <UsageCounter />
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gradient-primary)' }}>
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="bg-muted rounded-xl rounded-tl-sm px-3 py-2 text-sm text-foreground">
                  I've analyzed your full career report. Ask me anything — your skills, risks, salary, pivots.
                  {isPro
                    ? ' You have unlimited questions.'
                    : isAnonymous
                      ? ` You have ${MAX_QUESTIONS_PER_SCAN} questions available.`
                      : ` You have ${monthlyRemaining} questions this month.`
                  }
                </div>
              </div>
              {!isExhausted && (
                <div className="flex flex-wrap gap-1.5 ml-9">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button key={q} onClick={() => sendMessage(q)} className="text-[11px] px-2.5 py-1 rounded-full border border-primary/20 text-primary hover:bg-primary/5 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant' ? '' : 'bg-muted'}`}
                style={msg.role === 'assistant' ? { background: 'var(--gradient-primary)' } : undefined}>
                {msg.role === 'assistant' ? <Bot className="w-4 h-4 text-primary-foreground" /> : <User className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'}`}>
                {msg.role === 'assistant' ? <SimpleMarkdown content={msg.content} /> : msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gradient-primary)' }}>
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="bg-muted rounded-xl rounded-tl-sm px-3 py-2"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-3">
          {isExhausted ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center py-1">
              <Lock className="w-3 h-3" />
              <span>{inputPlaceholder}</span>
              {isMonthlyExhausted && (
                <button onClick={() => setShowLimitModal(true)} className="text-primary font-bold hover:underline ml-1">
                  Upgrade
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={inputPlaceholder} disabled={loading}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
              <button type="submit" disabled={!input.trim() || loading} className="w-9 h-9 rounded-lg flex items-center justify-center text-primary-foreground disabled:opacity-50" style={{ background: 'var(--gradient-primary)' }}>
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // FAB + overlay mode
  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-24 right-6 z-[60] w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-primary-foreground"
            style={{ background: 'var(--gradient-primary)' }}
            title="Chat with your report"
          >
            <MessageCircle className="w-6 h-6" />
            {!isPro && !isAnonymous && monthlyRemaining > 0 && monthlyRemaining < MONTHLY_FREE_LIMIT && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-[10px] font-black text-primary-foreground flex items-center justify-center border-2 border-background">
                {monthlyRemaining}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-[60] w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-4rem)] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden relative"
          >
            <AnimatePresence>{showLimitModal && <LimitModal />}</AnimatePresence>
            
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border" style={{ background: 'var(--gradient-primary)' }}>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary-foreground" />
                <div>
                  <p className="text-sm font-black text-primary-foreground">Career AI Advisor</p>
                  <p className="text-[10px] text-primary-foreground/70">{headerSubtitle}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-primary-foreground/70 hover:text-primary-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Usage counter */}
            {!isPro && !isAnonymous && usageLoaded && (
              <div className="px-4 py-2 border-b border-border bg-muted/30">
                <UsageCounter />
              </div>
            )}

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gradient-primary)' }}>
                      <Bot className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div className="bg-muted rounded-xl rounded-tl-sm px-3 py-2 text-sm text-foreground">
                      Hi! I've analyzed your career report.
                      {isPro
                        ? ' You have unlimited questions — ask me anything!'
                        : isAnonymous
                          ? ` You have ${MAX_QUESTIONS_PER_SCAN} questions — make them count!`
                          : ` You have ${monthlyRemaining} questions this month — make them count!`
                      }
                    </div>
                  </div>
                  {!isExhausted && (
                    <div className="flex flex-wrap gap-1.5 ml-9">
                      {SUGGESTED_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => sendMessage(q)}
                          className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors text-left"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user' ? 'bg-primary/20' : ''
                  }`} style={msg.role === 'assistant' ? { background: 'var(--gradient-primary)' } : undefined}>
                    {msg.role === 'user' ? <User className="w-4 h-4 text-primary" /> : <Bot className="w-4 h-4 text-primary-foreground" />}
                  </div>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted text-foreground rounded-tl-sm'
                  }`}>
                    {msg.role === 'assistant' ? <SimpleMarkdown content={msg.content} /> : msg.content}
                  </div>
                </div>
              ))}

              {loading && !messages.find((m, i) => i === messages.length - 1 && m.role === 'assistant') && (
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div className="bg-muted rounded-xl rounded-tl-sm px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border p-3">
              {isExhausted ? (
                <div className="flex items-center justify-center gap-2 py-1.5 text-xs text-muted-foreground">
                  <Lock className="w-3.5 h-3.5" />
                  <span>{inputPlaceholder}</span>
                  {isMonthlyExhausted && (
                    <button onClick={() => setShowLimitModal(true)} className="text-primary font-bold hover:underline ml-1">
                      Upgrade
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={inputPlaceholder}
                    disabled={loading}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-primary-foreground disabled:opacity-50"
                    style={{ background: 'var(--gradient-primary)' }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

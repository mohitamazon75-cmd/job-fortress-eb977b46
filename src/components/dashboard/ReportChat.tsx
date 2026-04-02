import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, User, Loader2, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/lib/supabase-config';
import { SimpleMarkdown } from './SimpleMarkdown';

type Msg = { role: 'user' | 'assistant'; content: string };

const MAX_QUESTIONS = 10;

const SUGGESTED_QUESTIONS = [
  "What's my biggest career risk right now?",
  "How can I future-proof my skills?",
  "What salary should I target next?",
  "Should I switch industries?",
];

export default function ReportChat({ scanId, accessToken, inline }: { scanId: string; accessToken?: string; inline?: boolean }) {
  const [open, setOpen] = useState(inline ? true : false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Count user questions sent
  const questionCount = useMemo(() => messages.filter(m => m.role === 'user').length, [messages]);
  const questionsLeft = MAX_QUESTIONS - questionCount;
  const isExhausted = questionsLeft <= 0;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading || isExhausted) return;
    const userMsg: Msg = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    let assistantSoFar = '';

    try {
      const CHAT_URL = `${SUPABASE_URL}/functions/v1/chat-report`;

      // Step 1: Validate identity via getUser() (server-verified, tamper-proof).
      // Step 2: getSession() is used ONLY to retrieve the access_token string for
      // the Authorization header — NOT for auth validation (already done above).
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

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: 'Failed' }));
        setMessages(prev => [...prev, { role: 'assistant', content: err.error || 'Something went wrong. Please try again.' }]);
        setLoading(false);
        return;
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
  };

  // Inline mode: render chat directly without FAB/overlay
  if (inline) {
    return (
      <div className="rounded-2xl border border-border bg-card flex flex-col overflow-hidden" style={{ minHeight: '500px', maxHeight: '70vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border" style={{ background: 'var(--gradient-primary)' }}>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary-foreground" />
            <div>
              <p className="text-sm font-black text-primary-foreground">AI Career Coach</p>
              <p className="text-[10px] text-primary-foreground/70">
                {isExhausted ? 'Question limit reached' : `${questionsLeft} question${questionsLeft === 1 ? '' : 's'} remaining · Grounded in your report data`}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gradient-primary)' }}>
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="bg-muted rounded-xl rounded-tl-sm px-3 py-2 text-sm text-foreground">
                  I've analyzed your full career report. Ask me anything — your skills, risks, salary, pivots. I have <span className="font-bold">{MAX_QUESTIONS} questions</span> available.
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 ml-9">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button key={q} onClick={() => sendMessage(q)} className="text-[11px] px-2.5 py-1 rounded-full border border-primary/20 text-primary hover:bg-primary/5 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
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
              <Lock className="w-3 h-3" /> You've used all {MAX_QUESTIONS} questions
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your career..." disabled={loading}
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
            {questionsLeft > 0 && questionsLeft < MAX_QUESTIONS && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-[10px] font-black text-primary-foreground flex items-center justify-center border-2 border-background">
                {questionsLeft}
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
            className="fixed bottom-6 right-6 z-[60] w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-4rem)] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border" style={{ background: 'var(--gradient-primary)' }}>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary-foreground" />
                <div>
                  <p className="text-sm font-black text-primary-foreground">Career AI Advisor</p>
                  <p className="text-[10px] text-primary-foreground/70">
                    {isExhausted ? 'Question limit reached' : `${questionsLeft} question${questionsLeft === 1 ? '' : 's'} remaining`}
                  </p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-primary-foreground/70 hover:text-primary-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gradient-primary)' }}>
                      <Bot className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div className="bg-muted rounded-xl rounded-tl-sm px-3 py-2 text-sm text-foreground">
                      Hi! I've analyzed your career report. You have <span className="font-bold">{MAX_QUESTIONS} questions</span> — make them count! Ask me anything about your AI risk, skills, or career strategy.
                    </div>
                  </div>
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

              {/* Exhausted message */}
              {isExhausted && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2"
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="bg-muted rounded-xl rounded-tl-sm px-3 py-2.5 text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground mb-1">You've used all {MAX_QUESTIONS} questions</p>
                    <p className="text-xs">Run a new scan to get {MAX_QUESTIONS} more questions with fresh, updated analysis.</p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border p-3">
              {isExhausted ? (
                <div className="flex items-center justify-center gap-2 py-1.5 text-xs text-muted-foreground">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Question limit reached — run a new scan for more</span>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Ask about your career... (${questionsLeft} left)`}
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

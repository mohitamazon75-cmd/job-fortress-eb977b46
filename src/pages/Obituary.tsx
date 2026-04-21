import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skull, MessageCircle, Linkedin, Twitter, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ObituaryResult {
  headline: string;
  obituary: string;
  cause_of_death: string;
  epitaph: string;
}

export default function ObituaryPage() {
  const [jobTitle, setJobTitle] = useState('');
  const [yearsExp, setYearsExp] = useState('');
  const [industry, setIndustry] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ObituaryResult | null>(null);

  const canSubmit = jobTitle.trim().length >= 2 && yearsExp && industry.trim().length >= 2;

  const handleGenerate = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('career-obituary', {
        body: {
          role: jobTitle.trim(),
          industry: industry.trim(),
          experience: yearsExp,
          skills: [],
          topRiskSkills: [],
          topTools: [],
        },
      });
      if (error) throw error;
      setResult(data as ObituaryResult);
    } catch (err) {
      console.error('Obituary generation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const shareText = result
    ? `💀 R.I.P. ${jobTitle}\n\n"${result.epitaph}"\n\nGet YOUR career obituary → jobbachao.com/obituary`
    : '';

  const handleWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  const handleLinkedIn = () => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://jobbachao.com/obituary')}`, '_blank');
  const handleTwitter = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');

  return (
    <>
      <title>Career Obituary Generator — How Will AI Kill Your Job? | JobBachao</title>
      <meta name="description" content="Generate your career's darkly funny obituary. Find out how AI will replace your role — and what to do about it. Free, no sign-up required." />

      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Header */}
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-foreground/5 flex items-center justify-center mx-auto">
                    <Skull className="w-8 h-8 text-foreground" />
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-black text-foreground">Career Obituary</h1>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    How will AI kill your career? Get your role's darkly funny newspaper death notice.
                  </p>
                </div>

                {/* Form — 3 fields only */}
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                      Job Title
                    </label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={e => setJobTitle(e.target.value)}
                      placeholder="e.g. Marketing Manager"
                      className="w-full px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground font-medium text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                      Years of Experience
                    </label>
                    <select
                      value={yearsExp}
                      onChange={e => setYearsExp(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground font-medium text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="">Select</option>
                      <option value="0-2">0–2 years</option>
                      <option value="3-5">3–5 years</option>
                      <option value="6-10">6–10 years</option>
                      <option value="15+">11–15 years</option>
                      <option value="20+">16–20 years</option>
                      <option value="25+">21+ years</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                      Industry
                    </label>
                    <input
                      type="text"
                      value={industry}
                      onChange={e => setIndustry(e.target.value)}
                      placeholder="e.g. IT Services, Banking, eCommerce"
                      className="w-full px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground font-medium text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                {/* Submit */}
                <button
                  onClick={handleGenerate}
                  disabled={!canSubmit || loading}
                  className="w-full py-4 rounded-xl bg-foreground text-background font-black text-[14px] hover:bg-foreground/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Writing your obituary...</>
                  ) : (
                    <>Generate My Career Obituary</>
                  )}
                </button>

                <p className="text-center text-[10px] text-muted-foreground">
                  Free · No sign-up · Takes 30 seconds
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Obituary card */}
                <div className="rounded-2xl border-2 border-border bg-card p-6 sm:p-8 space-y-4">
                  <div className="text-center space-y-1 pb-3" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                    <Skull className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">In Memoriam</p>
                    <h2 className="text-xl sm:text-2xl font-black text-foreground">{result.headline}</h2>
                  </div>

                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{result.obituary}</p>

                  <div className="rounded-xl bg-muted/50 p-4 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Cause of Death</p>
                    <p className="text-sm font-bold text-foreground">{result.cause_of_death}</p>
                  </div>

                  <div className="text-center pt-2" style={{ borderTop: '1px solid hsl(var(--border))' }}>
                    <p className="text-[12px] italic text-muted-foreground">"{result.epitaph}"</p>
                  </div>
                </div>

                {/* Share buttons */}
                <div className="space-y-3">
                  <button
                    onClick={handleWhatsApp}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-[14px]"
                    style={{ background: '#25D366', color: '#fff' }}
                  >
                    <MessageCircle className="w-5 h-5" />
                    Share on WhatsApp
                  </button>

                  <div className="flex gap-3">
                    <button
                      onClick={handleLinkedIn}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] border-2 border-border bg-card text-foreground hover:bg-muted transition-all"
                    >
                      <Linkedin className="w-4 h-4" />
                      LinkedIn
                    </button>
                    <button
                      onClick={handleTwitter}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] border-2 border-border bg-card text-foreground hover:bg-muted transition-all"
                    >
                      <Twitter className="w-4 h-4" />
                      Twitter
                    </button>
                  </div>
                </div>

                {/* CTA to main flow */}
                <a
                  href="/"
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-primary text-primary-foreground font-black text-[14px] hover:bg-primary/90 transition-all"
                >
                  Get Your Full Career Risk Analysis
                  <ArrowRight className="w-4 h-4" />
                </a>

                {/* Try again */}
                <button
                  onClick={() => setResult(null)}
                  className="w-full text-center text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  Generate another obituary
                </button>

                <p className="text-center text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground/50">
                  jobbachao.com · AI Career Intelligence
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Star, Link2, Check, Mail, CalendarClock, Zap, ArrowRightLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ReferralCard from '@/components/ReferralCard';
import confetti from 'canvas-confetti';

interface ThankYouFooterProps {
  onStartOver: () => void;
  scanId?: string;
  userId?: string;
}

function SwitchModelCTA() {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9 }}
      className="flex flex-col items-center gap-2 pt-2"
    >
      <Button
        onClick={() => navigate('/results/choose')}
        className="gap-2 font-bold"
        size="lg"
      >
        <ArrowRightLeft className="w-4 h-4" />
        Try a Different Analysis Model
      </Button>
      <p className="text-[10px] text-muted-foreground/60">
        See how a different AI perspective evaluates your career
      </p>
    </motion.div>
  );
}

export default function ThankYouFooter({ scanId, userId }: ThankYouFooterProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [challengeLinkCopied, setChallengeLinkCopied] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  // Celebration confetti on mount
  useEffect(() => {
    const duration = 1500;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: ['#10b981', '#6366f1', '#f59e0b'] });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: ['#10b981', '#6366f1', '#f59e0b'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  const handleRate = async (stars: number) => {
    setRating(stars);
    setSubmitted(true);
    try {
      await supabase.from('scan_feedback' as any).insert({
        scan_id: scanId || '00000000-0000-0000-0000-000000000000',
        accuracy_rating: stars,
        feedback_text: `Overall experience: ${stars}/5`,
      } as any);
    } catch {}
  };

  const handleWeeklyOptIn = async () => {
    if (!emailInput.includes('@')) return;
    setEmailSubmitted(true);
    try {
      await supabase.functions.invoke('coach-nudge', {
        body: { scanId, email: emailInput, optInType: 'weekly_brief' },
      });
    } catch {}
  };

  const ratingLabels = ['', 'Needs work', 'Below average', 'Decent', 'Great', 'Mind-blowing'];
  const ratingEmojis = ['', '😕', '🤔', '😊', '🔥', '🤯'];

  const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shareText = `I just got my AI career risk score on JobBachao — find out if your boss can replace you 👉`;

  const handleWhatsAppShare = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`, '_blank');
  };
  const handleLinkedInShare = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank');
  };
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {}
  };

  const challengeText = `I just checked my AI career risk score on JobBachao. Curious what yours is? Takes 2 minutes: https://jobbachao.com?ref=challenge`;
  const challengeWhatsAppUrl = `https://wa.me/?text=${encodeURIComponent(challengeText)}`;
  const challengeUrl = 'https://jobbachao.com?ref=challenge';

  const handleChallengeWhatsApp = () => {
    window.open(challengeWhatsAppUrl, '_blank');
  };

  const handleChallengeCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(challengeUrl);
      setChallengeLinkCopied(true);
      setTimeout(() => setChallengeLinkCopied(false), 2000);
    } catch {}
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 0.2 }}
    >
      <Card className="border-border/60 shadow-sm overflow-hidden bg-gradient-to-b from-card to-muted/20">
        <CardContent className="py-10 sm:py-12 text-center space-y-8">
          {/* Animated heart */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 flex items-center justify-center mx-auto dark:from-rose-950/30 dark:to-pink-950/30 dark:border-rose-800"
          >
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}>
              <Heart className="w-7 h-7 text-rose-500 fill-rose-500" />
            </motion.div>
          </motion.div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-foreground">Your Report Is Complete 🎉</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Risk analysis, defense plan, side hustles — all personalized to your career profile.
            </p>
          </div>

          {/* Rating */}
          {!submitted ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="space-y-3">
              <p className="text-sm font-semibold text-foreground">How accurate was your analysis?</p>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.button key={star} onMouseEnter={() => setHoveredStar(star)} onMouseLeave={() => setHoveredStar(0)}
                    onClick={() => handleRate(star)} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} className="p-1.5 transition-colors">
                    <Star className={`w-8 h-8 transition-colors ${star <= (hoveredStar || rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
                  </motion.button>
                ))}
              </div>
              {hoveredStar > 0 && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-muted-foreground">
                  {ratingEmojis[hoveredStar]} {ratingLabels[hoveredStar]}
                </motion.p>
              )}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-2">
              <div className="text-3xl">{ratingEmojis[rating || 3]}</div>
              <p className="text-sm font-semibold text-prophet-green">Thanks for your feedback!</p>
              <p className="text-xs text-muted-foreground">Your rating helps us improve the engine.</p>
            </motion.div>
          )}

          {/* Weekly Updates Opt-In */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            className="rounded-xl border-2 border-primary/15 bg-primary/[0.04] p-5 max-w-sm mx-auto space-y-3">
            <div className="flex items-center justify-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Weekly Career Intel</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Get AI market shifts, new threats to your role, and skill upgrade tips — delivered free every Monday.
            </p>
            {!emailSubmitted ? (
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="you@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleWeeklyOptIn()}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <Button size="sm" onClick={handleWeeklyOptIn} disabled={!emailInput.includes('@')} className="font-bold text-xs">
                  Subscribe
                </Button>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center justify-center gap-2 text-prophet-green">
                <Check className="w-4 h-4" />
                <p className="text-sm font-bold">You're in! First brief arrives Monday.</p>
              </motion.div>
            )}
          </motion.div>

          {/* Referral Card with Incentive */}
          <ReferralCard userId={userId} />

          {/* Challenge a Colleague Card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 mb-6 max-w-sm mx-auto">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">Challenge a Colleague</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Think someone on your team is safe from AI? Send them this test — the results might surprise them.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleChallengeWhatsApp}
                  className="text-xs font-semibold px-3 py-2 rounded-lg bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/20"
                >
                  Send on WhatsApp →
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleChallengeCopyLink}
                  className="text-xs font-semibold px-3 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted/50"
                >
                  {challengeLinkCopied ? <Check className="w-3.5 h-3.5 text-prophet-green" /> : <Link2 className="w-3.5 h-3.5" />}
                  {challengeLinkCopied ? 'Copied!' : 'Copy link'}
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Share actions */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }} className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Challenge a colleague</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={handleWhatsAppShare} className="gap-2 text-xs font-bold">
                <span className="text-base">💬</span> WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={handleLinkedInShare} className="gap-2 text-xs font-bold">
                <span className="text-base">💼</span> LinkedIn
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-2 text-xs font-bold">
                {linkCopied ? <Check className="w-3.5 h-3.5 text-prophet-green" /> : <Link2 className="w-3.5 h-3.5" />}
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </Button>
            </div>
          </motion.div>

          {/* Rescan CTA */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85 }}
            className="rounded-xl border border-border/50 bg-muted/30 p-4 max-w-sm mx-auto">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CalendarClock className="w-4 h-4 text-muted-foreground" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Track Your Progress</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Your score changes as AI evolves. Rescan in 30 days to see how your defenses are holding up.
            </p>
          </motion.div>

          {/* Switch Model CTA */}
          <SwitchModelCTA />

          <p className="text-[10px] text-muted-foreground/60 pt-2">
            Built with ❤️ by JobBachao · Powered by multi-agent AI · Your data is encrypted & never shared
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

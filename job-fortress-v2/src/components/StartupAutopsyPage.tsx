import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Skull, Heart, Star, RotateCcw, ArrowRight } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StartupAutopsyCard from '@/components/StartupAutopsyCard';

interface StartupAutopsyPageProps {
  report: ScanReport;
  country?: string;
  onComplete: () => void;
}

function ThankYouFooter({ onStartOver }: { onStartOver: () => void }) {
  const [rating, setRating] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);

  const handleRate = async (stars: number) => {
    setRating(stars);
    setSubmitted(true);
    try {
      await supabase.from('scan_feedback' as any).insert({
        scan_id: '00000000-0000-0000-0000-000000000000',
        accuracy_rating: stars,
        feedback_text: `Overall experience: ${stars}/5`,
      } as any);
    } catch {}
  };

  const ratingLabels = ['', 'Needs work', 'Below average', 'Decent', 'Great', 'Mind-blowing'];
  const ratingEmojis = ['', '😕', '🤔', '😊', '🔥', '🤯'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <Card className="border-border/60 shadow-sm overflow-hidden bg-gradient-to-b from-card to-muted/20">
        <CardContent className="py-12 text-center space-y-6">
          {/* Animated heart */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.2 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 flex items-center justify-center mx-auto"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
            >
              <Heart className="w-7 h-7 text-rose-500 fill-rose-500" />
            </motion.div>
          </motion.div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-foreground">Thank You for Using JobBachao</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Your full career intelligence report is complete — risk analysis, side hustles, and startup stress-test, all personalized to you.
            </p>
          </div>

          {/* Rating */}
          {!submitted ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-3"
            >
              <p className="text-sm font-semibold text-foreground">Rate your experience</p>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.button
                    key={star}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    onClick={() => handleRate(star)}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-1.5 transition-colors"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        star <= (hoveredStar || rating || 0)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-muted-foreground/30'
                      }`}
                    />
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
              <p className="text-sm font-semibold text-emerald-600">Thanks for your feedback!</p>
              <p className="text-xs text-muted-foreground">Your rating helps us improve the engine.</p>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button variant="ghost" onClick={onStartOver} className="gap-2 text-muted-foreground" size="lg">
              <RotateCcw className="w-4 h-4" />
              Start New Scan
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground/60 pt-2">
            Built with ❤️ by JobBachao · Powered by multi-agent AI · Your data is encrypted & never shared
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

const StartupAutopsyPage: React.FC<StartupAutopsyPageProps> = ({ report, country, onComplete }) => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-semibold">
            <Skull className="w-3.5 h-3.5" />
            STARTUP STRESS TEST
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">
            Will Your Idea Survive?
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            We'll find startups like yours that died, analyze why, and build you a battle-tested "Don't Die" playbook.
          </p>
        </motion.div>

        {/* Autopsy Card */}
        <StartupAutopsyCard report={report} country={country} />

        {/* Thank You & Feedback Footer */}
        <ThankYouFooter onStartOver={onComplete} />
      </div>
    </div>
  );
};

export default StartupAutopsyPage;

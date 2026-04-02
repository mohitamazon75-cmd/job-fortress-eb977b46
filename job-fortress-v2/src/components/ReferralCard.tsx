import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface ReferralCardProps {
  userId?: string;
  existingGrantExpiry?: string | null;
}

export default function ReferralCard({ userId, existingGrantExpiry }: ReferralCardProps) {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState('https://jobbachao.com');
  const [conversionCount, setConversionCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load or create referral code
  useEffect(() => {
    if (!userId) {
      // Fallback: static share without tracking
      setShareUrl('https://jobbachao.com');
      return;
    }

    const fetchReferralData = async () => {
      try {
        setLoading(true);

        // Check for existing referral code
        const { data: existingReferral, error: fetchErr } = await supabase
          .from('referrals')
          .select('referral_code')
          .eq('referrer_user_id', userId)
          .limit(1)
          .single();

        if (fetchErr && fetchErr.code !== 'PGRST116') {
          throw fetchErr;
        }

        let code = existingReferral?.referral_code;

        // If no code exists, create one
        if (!code) {
          const response = await supabase.functions.invoke('referral-track', {
            body: { action: 'create', userId },
          });

          if (!response.data) throw new Error('Failed to create referral code');
          code = response.data.code;
        }

        setReferralCode(code);
        setShareUrl(`https://jobbachao.com?ref=${code}`);

        // Fetch conversion count
        const { count, error: countErr } = await supabase
          .from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('referrer_user_id', userId)
          .eq('status', 'converted');

        if (countErr) throw countErr;
        setConversionCount(count || 0);

        setError(null);
      } catch (err) {
        console.error('[ReferralCard] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load referral data');
      } finally {
        setLoading(false);
      }
    };

    fetchReferralData();
  }, [userId]);

  const shareText = `I just found out my AI career risk score on JobBachao. Check yours free — takes 2 min. (Referred by a colleague): ${shareUrl}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleWhatsAppShare = () => {
    const encoded = encodeURIComponent(shareText);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  // Show pro grant message if already earned
  if (existingGrantExpiry) {
    const expiryDate = new Date(existingGrantExpiry).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
      >
        <Card className="border-primary/20 bg-primary/5 max-w-sm mx-auto mb-6">
          <CardContent className="py-6 px-6">
            <div className="text-center space-y-2">
              <div className="text-3xl">🎉</div>
              <h3 className="text-sm font-black text-foreground">You've Earned 30 Days Pro!</h3>
              <p className="text-xs text-muted-foreground">
                Active until <span className="font-semibold text-foreground">{expiryDate}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Show referral invite card
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.65 }}
    >
      <Card className="border-primary/20 bg-primary/5 max-w-sm mx-auto mb-6">
        <CardContent className="py-6 px-6 space-y-4">
          {/* Header */}
          <div className="space-y-2">
            <h3 className="text-sm font-black text-foreground">Invite 3 colleagues → Get 30 Days Pro Free</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              They scan their CV, you get Pro access. Win-win.
            </p>
          </div>

          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">Progress</p>
              <p className="text-xs font-black text-foreground">{conversionCount}/3</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className={`flex-1 h-2 rounded-full ${
                    i < conversionCount ? 'bg-prophet-green' : 'bg-muted'
                  }`}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                />
              ))}
            </div>
          </div>

          {/* Share buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleWhatsAppShare}
              disabled={loading}
              className="flex-1 text-xs font-semibold bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/20"
              variant="outline"
            >
              <MessageCircle className="w-3.5 h-3.5 mr-1" />
              WhatsApp
            </Button>
            <Button
              size="sm"
              onClick={handleCopyLink}
              disabled={loading}
              className="flex-1 text-xs font-semibold"
              variant="outline"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1 text-prophet-green" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  Copy Link
                </>
              )}
            </Button>
          </div>

          {error && <p className="text-xs text-prophet-red text-center">{error}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

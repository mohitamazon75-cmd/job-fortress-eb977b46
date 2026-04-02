import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Swords, Copy, Check, Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface ChallengeColleagueProps {
  scanId: string;
  score: number;
  role: string;
}

export default function ChallengeColleague({ scanId, score, role }: ChallengeColleagueProps) {
  const [challengeCode, setChallengeCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const createChallenge = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Please sign in first'); return; }

      const { data, error } = await (supabase.from('challenges' as any) as any)
        .insert({ challenger_scan_id: scanId, challenger_user_id: user.id })
        .select('challenge_code')
        .single();

      if (error) throw error;
      setChallengeCode(data.challenge_code);
    } catch (err) {
      console.error('Failed to create challenge:', err);
      toast.error('Failed to create challenge');
    } finally {
      setLoading(false);
    }
  };

  const challengeUrl = challengeCode
    ? `${window.location.origin}/share/challenge/${challengeCode}`
    : null;

  const shareMessage = challengeUrl
    ? `I scored ${score}/100 as a ${role} on my AI Career Safety test. Think you can beat me? 💪 Check yours: ${challengeUrl}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareMessage);
    setCopied(true);
    toast.success('Challenge link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, '_blank');
  };

  if (!challengeCode) {
    return (
      <button
        onClick={createChallenge}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-all text-sm font-medium disabled:opacity-50"
      >
        <Swords className="w-4 h-4" />
        {loading ? 'Creating...' : 'Challenge a Colleague'}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-accent font-semibold text-sm">
        <Swords className="w-4 h-4" />
        Challenge Created!
      </div>
      <p className="text-xs text-muted-foreground">
        Share this link — your colleague will run their own scan and see who scores higher.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-foreground text-xs hover:bg-muted/80 transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
        <button
          onClick={handleWhatsApp}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-all"
        >
          <Share2 className="w-3.5 h-3.5" />
          WhatsApp
        </button>
      </div>
    </div>
  );
}

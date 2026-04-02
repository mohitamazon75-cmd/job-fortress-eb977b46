import { useState } from 'react';
import { motion } from 'framer-motion';
import { ScanReport } from '@/lib/scan-engine';
import { Share2, Download, Copy, Check, MessageCircle, Linkedin, Swords } from 'lucide-react';
import { computeStabilityScore } from '@/lib/stability-score';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ShareExportCardProps {
  report: ScanReport;
  scanId: string;
}

export default function ShareExportCard({ report, scanId }: ShareExportCardProps) {
  const score = computeStabilityScore(report);
  const role = (report as any).matched_job_family || report.role || 'Professional';
  const industry = report.industry || 'Technology';
  const [copied, setCopied] = useState(false);
  const [challengeCode, setChallengeCode] = useState<string | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(false);

  const shareUrl = `${window.location.origin}/share/${scanId}`;
  const shareText = `I just checked my AI Career Safety Score — ${score}/100 as a ${role} in ${industry}. Check yours:`;

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`, '_blank');
  };

  const handleLinkedIn = () => {
    const postText = `I just discovered that some of my professional skills are being automated by AI tools I hadn't heard of 6 months ago. My Career Position Score: ${score}/100.\n\nHere's what I'm doing about it:\n1. Learning the AI tools that threaten my role (turning threats into advantages)\n2. Doubling down on skills AI can't replicate\n3. Positioning myself as the human + AI expert\n\nCheck your own score for free: ${shareUrl}\n\n#CareerDevelopment #AI #FutureOfWork`;
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank');
    // Also copy the post text
    navigator.clipboard.writeText(postText).catch(() => {});
    toast.success('LinkedIn post text copied! Paste it when sharing.');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChallenge = async () => {
    setChallengeLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Please sign in first'); return; }

      const { data, error } = await (supabase.from('challenges' as any) as any)
        .insert({ challenger_scan_id: scanId, challenger_user_id: user.id })
        .select('challenge_code')
        .single();

      if (error) throw error;
      setChallengeCode(data.challenge_code);
      const challengeMsg = `I scored ${score}/100 on my AI Career Safety test as a ${role}. Think you can beat me? 💪 ${window.location.origin}/share/challenge/${data.challenge_code}`;
      navigator.clipboard.writeText(challengeMsg);
      toast.success('Challenge created & copied!');
    } catch (err) {
      console.error('Challenge error:', err);
      toast.error('Failed to create challenge');
    } finally {
      setChallengeLoading(false);
    }
  };

  const handlePDF = () => {
    toast.info('Printing report...', { description: 'Use your browser\'s "Save as PDF" option for best results.' });
    setTimeout(() => window.print(), 500);
  };

  return (
    <div className="space-y-5">
      {/* Share Hero */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 22 }}
        className="rounded-2xl border-2 border-primary/20 bg-primary/[0.04] p-6 text-center"
      >
        <Share2 className="w-8 h-8 text-primary mx-auto mb-3" />
        <h3 className="text-xl font-black text-foreground">Share Your Results</h3>
        <p className="text-xs text-muted-foreground mt-1.5">
          Help your network check their career safety. Awareness is the first step.
        </p>
      </motion.div>

      {/* Primary share buttons */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={handleWhatsApp}
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-card p-4 hover:bg-muted transition-all min-h-[80px] justify-center"
        >
          <MessageCircle className="w-6 h-6 text-primary" />
          <span className="text-xs font-bold text-foreground">WhatsApp</span>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          onClick={handleLinkedIn}
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-card p-4 hover:bg-muted transition-all min-h-[80px] justify-center"
        >
          <Linkedin className="w-6 h-6 text-primary" />
          <span className="text-xs font-bold text-foreground">LinkedIn</span>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={handleCopyLink}
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-card p-4 hover:bg-muted transition-all min-h-[80px] justify-center"
        >
          {copied ? <Check className="w-6 h-6 text-prophet-green" /> : <Copy className="w-6 h-6 text-muted-foreground" />}
          <span className="text-xs font-bold text-foreground">{copied ? 'Copied!' : 'Copy Link'}</span>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          onClick={handlePDF}
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-card p-4 hover:bg-muted transition-all min-h-[80px] justify-center"
        >
          <Download className="w-6 h-6 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground">Print / Save PDF</span>
        </motion.button>
      </div>

      {/* Challenge a Colleague */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl border-2 border-accent/20 bg-accent/[0.04] p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <Swords className="w-4 h-4 text-accent" />
          <p className="text-[10px] font-black uppercase tracking-widest text-accent">Challenge a Colleague</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Think you're safer than your colleague? Challenge them — both run a scan, then compare scores.
        </p>
        {challengeCode ? (
          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="text-xs font-bold text-prophet-green">✓ Challenge link copied to clipboard!</p>
            <p className="text-[10px] text-muted-foreground mt-1">Share it on WhatsApp or paste it anywhere.</p>
          </div>
        ) : (
          <button
            onClick={handleChallenge}
            disabled={challengeLoading}
            className="w-full py-3 rounded-lg bg-accent/10 border border-accent/20 text-accent font-bold text-sm hover:bg-accent/20 transition-all disabled:opacity-50"
          >
            {challengeLoading ? 'Creating...' : '⚔️ Generate Challenge Link'}
          </button>
        )}
      </motion.div>

      {/* Subtle credibility footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-center text-[10px] text-muted-foreground"
      >
        <p>Your shared report uses a unique URL with your score preview.</p>
        <p className="mt-0.5">No personal data is shared — only your score, role, and industry.</p>
      </motion.div>
    </div>
  );
}

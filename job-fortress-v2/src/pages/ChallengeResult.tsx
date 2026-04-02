import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, Swords, ArrowRight, MessageCircle, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ChallengeData {
  challengerScore: number;
  challengerRole: string;
  respondentScore: number | null;
  respondentRole: string | null;
  challengeCode: string;
  challengerName: string;
}

export default function ChallengeResult() {
  const { challengeCode } = useParams<{ challengeCode: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!challengeCode) return;

    const fetchChallenge = async () => {
      try {
        // Fetch challenge with related scan data
        const { data: challenge, error } = await (supabase.from('challenges' as any) as any)
          .select('*')
          .eq('challenge_code', challengeCode)
          .single();

        if (error || !challenge) {
          setLoading(false);
          return;
        }

        // Get challenger's scan report
        const { data: challengerScan } = await supabase
          .from('scans')
          .select('final_json_report, role_detected, determinism_index')
          .eq('id', challenge.challenger_scan_id)
          .single();

        let respondentScore: number | null = null;
        let respondentRole: string | null = null;

        if (challenge.respondent_scan_id) {
          const { data: respondentScan } = await supabase
            .from('scans')
            .select('final_json_report, role_detected, determinism_index')
            .eq('id', challenge.respondent_scan_id)
            .single();

          if (respondentScan) {
            const rReport = respondentScan.final_json_report as any;
            respondentScore = rReport?.career_position_score ?? (100 - (respondentScan.determinism_index ?? 50));
            respondentRole = respondentScan.role_detected || 'Professional';
          }
        }

        const cReport = challengerScan?.final_json_report as any;
        const challengerScore = cReport?.career_position_score ?? (100 - (challengerScan?.determinism_index ?? 50));

        setData({
          challengerScore,
          challengerRole: challengerScan?.role_detected || 'Professional',
          respondentScore,
          respondentRole,
          challengeCode,
          challengerName: cReport?.linkedin_name?.split(' ')[0] || 'Your colleague',
        });
      } catch (err) {
        console.error('Challenge fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChallenge();
  }, [challengeCode]);

  // Fire confetti for winner
  useEffect(() => {
    if (!data || data.respondentScore === null) return;
    if (data.respondentScore > data.challengerScore) {
      try {
        confetti({ particleCount: 60, spread: 70, origin: { x: 0.5, y: 0.4 }, colors: ['#22c55e', '#10b981', '#fff'], disableForReducedMotion: true });
      } catch {}
    }
  }, [data]);

  const handleRematch = () => {
    navigate('/');
  };

  const handleShareResult = () => {
    if (!data || data.respondentScore === null) return;
    const msg = `Career Challenge Result 🎯\n\n${data.challengerName}: ${data.challengerScore}/100\nMe: ${data.respondentScore}/100\n\n${data.respondentScore > data.challengerScore ? "I'm safer! 🛡️" : "I need to step up ⚠️"}\n\nCheck YOUR score → jobbachao.com`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading challenge...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <Swords className="w-12 h-12 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-black text-foreground">Challenge Not Found</h1>
          <p className="text-muted-foreground text-sm">This challenge link may be invalid or expired.</p>
          <button onClick={() => navigate('/')}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold">
            Check Your Own Score
          </button>
        </div>
      </div>
    );
  }

  // No respondent yet — show invitation to take the scan
  if (data.respondentScore === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="max-w-md text-center space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Swords className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-black text-foreground">You've Been Challenged!</h1>
          <p className="text-muted-foreground">
            <span className="font-bold text-foreground">{data.challengerName}</span> scored{' '}
            <span className="font-black text-foreground">{data.challengerScore}/100</span> on their AI Career Safety test.
          </p>
          <p className="text-muted-foreground text-sm">
            Think you can beat them? Take the free scan and find out.
          </p>
          <button onClick={() => navigate('/')}
            className="w-full px-8 py-4 rounded-xl bg-primary text-primary-foreground font-black text-lg hover:bg-primary/90 transition-all">
            Accept Challenge — Free
          </button>
        </motion.div>
      </div>
    );
  }

  // Both scores available — show comparison
  const youWin = data.respondentScore > data.challengerScore;
  const tie = data.respondentScore === data.challengerScore;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            Challenge Result
          </p>
          <h1 className="text-2xl font-black text-foreground">
            {tie ? "It's a Tie! 🤝" : youWin ? 'You Win! 🛡️' : 'You\'re More at Risk ⚠️'}
          </h1>
        </div>

        {/* Score comparison */}
        <div className="rounded-2xl border-2 border-border bg-card overflow-hidden">
          {/* Challenger */}
          <div className="px-5 py-5 flex items-center justify-between border-b border-border">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                {data.challengerName}
              </div>
              <div className="text-[10px] text-muted-foreground">{data.challengerRole}</div>
            </div>
            <div className="text-right">
              <span className="text-[36px] font-black tabular-nums text-foreground" style={{ fontFeatureSettings: "'tnum'" }}>
                {data.challengerScore}
              </span>
              <span className="text-[14px] font-bold text-muted-foreground">/100</span>
            </div>
          </div>

          {/* Respondent (you) */}
          <div className="px-5 py-5 flex items-center justify-between" style={{
            background: youWin ? 'hsl(var(--primary) / 0.05)' : tie ? undefined : 'hsl(var(--destructive) / 0.05)'
          }}>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1">
                You
              </div>
              <div className="text-[10px] text-muted-foreground">{data.respondentRole}</div>
            </div>
            <div className="text-right flex items-center gap-2">
              {youWin ? (
                <Shield className="w-5 h-5 text-primary" />
              ) : !tie ? (
                <AlertTriangle className="w-5 h-5 text-destructive" />
              ) : null}
              <span className={`text-[36px] font-black tabular-nums ${youWin ? 'text-primary' : tie ? 'text-foreground' : 'text-destructive'}`}
                style={{ fontFeatureSettings: "'tnum'" }}>
                {data.respondentScore}
              </span>
              <span className="text-[14px] font-bold text-muted-foreground">/100</span>
            </div>
          </div>
        </div>

        {/* Verdict */}
        <div className={`rounded-xl p-4 text-center ${youWin ? 'bg-primary/5 border border-primary/20' : tie ? 'bg-muted border border-border' : 'bg-destructive/5 border border-destructive/20'}`}>
          <p className="text-[13px] font-bold leading-relaxed">
            {youWin
              ? `You scored ${data.respondentScore - data.challengerScore} points higher. You're in a safer position — for now. AI doesn't stop improving.`
              : tie
              ? `Dead even! You're both facing the same level of AI pressure. Time to differentiate.`
              : `${data.challengerName} is ${data.challengerScore - data.respondentScore} points ahead. You need to strengthen your position before AI closes the gap.`
            }
          </p>
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <button onClick={handleShareResult}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-[14px]"
            style={{ background: '#25D366', color: '#fff' }}>
            <MessageCircle className="w-5 h-5" />
            Share Result on WhatsApp
          </button>

          <button onClick={handleRematch}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] border-2 border-border bg-card text-foreground hover:bg-muted transition-all">
            <RotateCcw className="w-4 h-4" />
            Rematch — Run a New Scan
          </button>

          <button onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[12px] text-muted-foreground hover:text-foreground transition-colors">
            Get My Full Career Intelligence Report
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <p className="text-center text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground/50">
          jobbachao.com · AI Career Intelligence
        </p>
      </motion.div>
    </div>
  );
}

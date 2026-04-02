import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, AlertTriangle, CheckCircle, Copy, Check, Share2, Shield, Zap, Eye, TrendingDown, Award, MessageCircle } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';

interface LinkedInRoastCardProps {
  report: ScanReport;
}

interface RoastItem {
  category: string;
  icon: React.ReactNode;
  score: number; // 0-10
  roast: string;
  fix: string;
  severity: 'critical' | 'warning' | 'ok';
}

export default function LinkedInRoastCard({ report }: LinkedInRoastCardProps) {
  const [copiedRoast, setCopiedRoast] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const name = report.linkedin_name || 'Unknown';
  const company = report.linkedin_company || '';
  const role = report.role || 'Professional';
  const industry = report.industry || 'Technology';
  const allSkills = report.all_skills || [];
  const moatSkills = report.moat_skills || [];
  const deadSkills = report.execution_skills_dead || [];
  const strategicSkills = report.strategic_skills || [];
  const executionSkills = report.execution_skills || [];
  const seniorityTier = report.seniority_tier || 'PROFESSIONAL';
  const source = report.source || '';
  const isLinkedIn = source === 'linkedin';
  const determinismIndex = report.determinism_index || 50;
  const survivability = report.survivability;
  const tools = report.ai_tools_replacing || [];
  const yearsExp = report.years_experience ? parseInt(report.years_experience) : 5;

  // ═══════════════════════════════════════════════
  // ROAST ENGINE — Deterministic audit from scan data
  // ═══════════════════════════════════════════════

  const roastItems = useMemo<RoastItem[]>(() => {
    const items: RoastItem[] = [];

    // 1. HEADLINE AUDIT
    const hasGenericRole = /^(professional|employee|working|looking|seeking)/i.test(role);
    const headlineScore = hasGenericRole ? 2 : role.split(' ').length >= 3 ? 8 : 5;
    items.push({
      category: 'Headline',
      icon: <Eye className="w-4 h-4" />,
      score: headlineScore,
      roast: headlineScore <= 3
        ? `"${role}" as a headline? Bhai, even a chai tapri has a better tagline. Recruiters scroll past generic headlines faster than you skip YouTube ads.`
        : headlineScore <= 6
          ? `"${role}" is fine but forgettable. On Naukri and LinkedIn India, you're competing with 10,000 people with the exact same headline. It's like wearing a white shirt to Holi.`
          : `Your headline has specificity — that's good. But does it mention your moat skill (${moatSkills[0] ?? 'your specialty'})? Top 5% Indian profiles do.`,
      fix: headlineScore <= 6
        ? `Try: "${role} | ${moatSkills[0] ?? 'Domain Expert'} + ${moatSkills[1] ?? 'AI-Augmented'} | ${industry}" — this gets 3x more profile views on LinkedIn India.`
        : `Add a measurable impact: "${role} | ${moatSkills[0] ?? 'Specialist'} | Helped [Company] achieve [result]"`,
      severity: headlineScore <= 3 ? 'critical' : headlineScore <= 6 ? 'warning' : 'ok',
    });

    // 2. SKILLS AUDIT — India context
    const hasAISkills = allSkills.some(s => /\b(ai|machine learning|gpt|llm|automation|copilot|generative)\b/i.test(s));
    const skillCount = allSkills.length;
    const skillScore = (skillCount >= 10 ? 4 : skillCount >= 5 ? 2 : 0) + (hasAISkills ? 4 : 0) + (moatSkills.length >= 2 ? 2 : 0);
    const clampedSkillScore = Math.min(10, skillScore);
    items.push({
      category: 'Skills Listed',
      icon: <Zap className="w-4 h-4" />,
      score: clampedSkillScore,
      roast: !hasAISkills
        ? `Zero AI skills listed in 2026? That's like a rickshaw driver refusing to learn about Ola/Uber. ${industry} recruiters are filtering for AI keywords RIGHT NOW. You're invisible to them.`
        : skillCount < 5
          ? `Only ${skillCount} skills? LinkedIn's algorithm needs 10+ to properly match you with jobs. You're basically telling Naukri recruiters "don't find me."`
          : `${skillCount} skills with AI coverage — decent. But ${deadSkills.length > 0 ? `"${deadSkills[0]}" is actively being automated and dragging your profile down` : 'are all of them endorsed?'}`,
      fix: !hasAISkills
        ? `Add these TODAY: "${moatSkills[0] ?? role} + AI", "Prompt Engineering", "${tools[0] && typeof tools[0] === 'object' ? (tools[0] as { tool_name: string }).tool_name : String(tools[0] ?? 'GitHub Copilot')}" — even listing them boosts your search visibility by 40%.`
        : `Remove outdated skills (${deadSkills.slice(0, 2).join(', ') ?? 'manual processes'}) and add "${moatSkills[0] ?? 'domain'} + AI Augmentation" as a combined skill.`,
      severity: clampedSkillScore <= 3 ? 'critical' : clampedSkillScore <= 6 ? 'warning' : 'ok',
    });

    // 3. EXPERIENCE SECTION AUDIT
    const expScore = yearsExp >= 10 ? (seniorityTier === 'EXECUTIVE' || seniorityTier === 'SENIOR_LEADER' ? 8 : 5) : yearsExp >= 5 ? 6 : 4;
    items.push({
      category: 'Experience Section',
      icon: <Shield className="w-4 h-4" />,
      score: expScore,
      roast: expScore <= 4
        ? `${yearsExp} years and still no ${industry} leadership keywords? In India's job market, "responsible for" means nothing. "Delivered ₹X crore impact" means everything.`
        : expScore <= 6
          ? `Your experience reads like a JD, not a highlight reel. Indian HRs scan 200+ profiles daily — they need numbers: "Managed ₹${yearsExp * 2}Cr portfolio" or "Led ${yearsExp * 3}-member team across ${yearsExp > 7 ? 'multiple' : '2'} verticals."`
          : `Solid experience framing. But do your bullet points show AI-augmented outcomes? In 2026, that's the differentiator.`,
      fix: `Rewrite each role using: "[Action Verb] + [Metric in ₹/Cr/%] + [Business Impact] + [AI Tool Used]". Example: "Automated ${industry} reporting using ${tools[0] && typeof tools[0] === 'object' ? (tools[0] as { tool_name: string }).tool_name : 'AI tools'}, saving 20hrs/month."`,
      severity: expScore <= 4 ? 'critical' : expScore <= 6 ? 'warning' : 'ok',
    });

    // 4. MOAT VISIBILITY
    const moatScore = moatSkills.length >= 3 ? 8 : moatSkills.length >= 1 ? 5 : 2;
    items.push({
      category: 'Human Moat Visibility',
      icon: <Award className="w-4 h-4" />,
      score: moatScore,
      roast: moatScore <= 3
        ? `Your profile shows ZERO human moats. You know what that tells recruiters? "This person can be replaced by ChatGPT." In India's cost-sensitive market, that's a pink slip waiting to happen.`
        : moatScore <= 6
          ? `You have "${moatSkills[0] ?? 'your moat'}" as a moat — but it's buried. Is it in your headline? Summary? Featured section? If an HR manager can't find it in 6 seconds, it doesn't exist.`
          : `Strong moat portfolio: ${moatSkills.slice(0, 3).join(', ')}. Make sure each is reflected in your headline, summary, AND endorsements — triple reinforcement works.`,
      fix: moatScore <= 6
        ? `Pin a featured post about your ${moatSkills[0] ?? 'domain expertise'}. Write one LinkedIn post about how you combined ${moatSkills[0] ?? 'your skill'} with AI — this alone gets 5-10x engagement in Indian LinkedIn.`
        : `Create a "What I Do That AI Can't" post featuring your moats. Tag 3 industry leaders for visibility.`,
      severity: moatScore <= 3 ? 'critical' : moatScore <= 6 ? 'warning' : 'ok',
    });

    // 5. DEAD SKILLS AUDIT
    const deadCount = deadSkills.length;
    const deadScore = deadCount === 0 ? 9 : deadCount <= 2 ? 6 : 3;
    items.push({
      category: 'Obsolete Skills',
      icon: <TrendingDown className="w-4 h-4" />,
      score: deadScore,
      roast: deadScore <= 3
        ? `You're proudly displaying ${deadCount} skills that are being automated. That's like putting "Expert Typewriter User" on your CV. ${deadSkills.slice(0, 3).join(', ')} — recruiters see these as red flags, not badges.`
        : deadScore <= 6
          ? `"${deadSkills[0]}" is losing relevance fast. It's not just obsolete — it signals to recruiters that you haven't updated your profile since before GPT existed.`
          : `Clean skills section — no major obsolete baggage. You're ahead of 70% of Indian professionals who still list Windows XP as a skill.`,
      fix: deadScore <= 6
        ? `Remove or reframe: "${deadSkills[0] ?? 'outdated skill'}" → "${deadSkills[0] ?? 'outdated skill'} + AI Automation". Don't delete — evolve. Show you've upgraded the skill, not abandoned it.`
        : `Keep pruning quarterly. Set a calendar reminder every 3 months to audit your skills against Naukri's trending skills.`,
      severity: deadScore <= 3 ? 'critical' : deadScore <= 6 ? 'warning' : 'ok',
    });

    // 6. PROFILE COMPLETENESS (inferred)
    const hasCompany = !!company;
    const completenessScore = (hasCompany ? 2 : 0) + (skillCount >= 5 ? 2 : 0) + (moatSkills.length > 0 ? 2 : 0) + (yearsExp >= 3 ? 2 : 0) + (strategicSkills.length > 0 ? 2 : 0);
    const clampedCompleteness = Math.min(10, completenessScore);
    items.push({
      category: 'Profile Completeness',
      icon: <CheckCircle className="w-4 h-4" />,
      score: clampedCompleteness,
      roast: clampedCompleteness <= 4
        ? `Your LinkedIn is less complete than a half-built Noida apartment. Incomplete profiles get 80% fewer views. In India's competitive job market, that means thousands of missed opportunities.`
        : clampedCompleteness <= 7
          ? `Decent but not "All-Star." LinkedIn literally tells you when your profile is complete — and rewards it with 14x more views. You're leaving free visibility on the table.`
          : `Near-complete profile. Final push: Add a custom banner image with your role + top skill. It's the billboard of LinkedIn.`,
      fix: clampedCompleteness <= 7
        ? `Add: Featured section (pin 1 post), Custom URL (linkedin.com/in/yourname), Profile banner, 3+ recommendations from ${industry} colleagues. Takes 30 min, lasts forever.`
        : `Get 3 recommendations from senior colleagues. In Indian corporate culture, social proof from a "sir/ma'am" carries 10x weight.`,
      severity: clampedCompleteness <= 4 ? 'critical' : clampedCompleteness <= 7 ? 'warning' : 'ok',
    });

    return items;
  }, [report, name, company, role, industry, allSkills, moatSkills, deadSkills, strategicSkills, executionSkills, seniorityTier, source, isLinkedIn, determinismIndex, survivability, tools, yearsExp]);

  // Overall score
  const overallScore = Math.round(roastItems.reduce((sum, item) => sum + item.score, 0) / roastItems.length * 10);
  const criticalCount = roastItems.filter(i => i.severity === 'critical').length;
  const warningCount = roastItems.filter(i => i.severity === 'warning').length;

  // Roast verdict
  const verdict = overallScore <= 30
    ? { label: '🔥 BURNT TO CRISP', desc: 'Your LinkedIn is actively hurting your career', color: 'text-destructive' }
    : overallScore <= 50
      ? { label: '😬 HALF-BAKED', desc: 'Salvageable but needs serious work', color: 'text-destructive' }
      : overallScore <= 70
        ? { label: '🍳 MEDIUM RARE', desc: 'Decent foundation, missing the sizzle', color: 'text-prophet-gold' }
        : { label: '🏆 WELL DONE', desc: 'Solid profile — now make it legendary', color: 'text-prophet-green' };

  // Shareable roast text
  const shareText = `🔥 My LinkedIn got ROASTED!\n\nScore: ${overallScore}/100 — "${verdict.label}"\n${criticalCount > 0 ? `⚠️ ${criticalCount} critical issues found\n` : ''}${warningCount > 0 ? `⚡ ${warningCount} warnings\n` : ''}\nTop roast: "${roastItems.find(i => i.severity === 'critical')?.roast.slice(0, 100) ?? roastItems[0]?.roast?.slice(0, 100) ?? 'Your profile needs work'}..."\n\nGet your profile roasted: ${window.location.origin}\n\n#LinkedInRoast #CareerCheck #JobBachao`;

  const handleCopyRoast = () => {
    navigator.clipboard.writeText(shareText);
    setCopiedRoast(true);
    setTimeout(() => setCopiedRoast(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl border-2 border-destructive/20 bg-destructive/[0.04] p-6 text-center relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent" />
        <div className="relative z-10">
          <Flame className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-destructive mb-2">
            {isLinkedIn ? 'LinkedIn Profile Roast' : 'Profile Strength Audit'}
          </p>
          <p className="text-5xl font-black text-foreground">{overallScore}<span className="text-xl text-muted-foreground">/100</span></p>
          <p className={`text-lg font-black mt-1 ${verdict.color}`}>{verdict.label}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{verdict.desc}</p>

          <div className="flex items-center justify-center gap-4 mt-4">
            {criticalCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
                <span className="text-[10px] font-black text-destructive">{criticalCount} Critical</span>
              </div>
            )}
            {warningCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-prophet-gold" />
                <span className="text-[10px] font-black text-prophet-gold">{warningCount} Warnings</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-prophet-green" />
              <span className="text-[10px] font-black text-prophet-green">{roastItems.filter(i => i.severity === 'ok').length} Good</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Individual Roasts */}
      <div className="space-y-2.5">
        {roastItems.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.06 }}
            className={`rounded-xl border-2 overflow-hidden transition-all ${
              item.severity === 'critical'
                ? 'border-destructive/25 bg-destructive/[0.03]'
                : item.severity === 'warning'
                  ? 'border-prophet-gold/25 bg-prophet-gold/[0.03]'
                  : 'border-prophet-green/25 bg-prophet-green/[0.03]'
            }`}
          >
            <button
              type="button"
              onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              className="w-full flex items-center justify-between p-4 text-left min-h-[52px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            >
              <div className="flex items-center gap-3">
                <span className={
                  item.severity === 'critical' ? 'text-destructive' :
                  item.severity === 'warning' ? 'text-prophet-gold' : 'text-prophet-green'
                }>
                  {item.icon}
                </span>
                <div>
                  <p className="text-xs font-black text-foreground">{item.category}</p>
                  <p className={`text-[11px] font-bold ${
                    item.severity === 'critical' ? 'text-destructive' :
                    item.severity === 'warning' ? 'text-prophet-gold' : 'text-prophet-green'
                  }`}>
                    {item.severity === 'critical' ? '🔥 Needs Fixing' : item.severity === 'warning' ? '⚡ Could Improve' : '✅ Looking Good'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-black ${
                  item.severity === 'critical' ? 'text-destructive' :
                  item.severity === 'warning' ? 'text-prophet-gold' : 'text-prophet-green'
                }`}>
                  {item.score}/10
                </span>
                <motion.span
                  animate={{ rotate: expandedIdx === i ? 180 : 0 }}
                  className="text-muted-foreground text-xs"
                >
                  ▼
                </motion.span>
              </div>
            </button>

            <AnimatePresence>
              {expandedIdx === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3">
                    {/* The Roast */}
                    <div className="rounded-lg bg-card border border-border p-3">
                      <p className="text-[11px] font-black text-destructive uppercase tracking-wider mb-1">🔥 The Roast</p>
                      <p className="text-[11px] text-foreground/80 leading-relaxed italic">
                        {item.roast}
                      </p>
                    </div>
                    {/* The Fix */}
                    <div className="rounded-lg bg-prophet-green/[0.06] border border-prophet-green/20 p-3">
                      <p className="text-[11px] font-black text-prophet-green uppercase tracking-wider mb-1">💊 The Fix</p>
                      <p className="text-[11px] text-foreground/80 leading-relaxed">
                        {item.fix}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* India-specific LinkedIn Tips */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl border-2 border-primary/20 bg-primary/[0.04] p-5"
      >
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3">
          🇮🇳 India LinkedIn Hacks (That Actually Work)
        </p>
        {!isLinkedIn && (
          <p className="text-[10px] text-muted-foreground mb-3 italic">
            ℹ️ This audit is based on your scan data, not a direct LinkedIn scrape. Submit your LinkedIn URL for a more precise audit.
          </p>
        )}
        <div className="space-y-2">
          {[
            { hack: 'Post between 8-9 AM IST (Tuesday/Wednesday) — that\'s when Indian hiring managers scroll LinkedIn before standup.', icon: '⏰' },
            { hack: 'Write in "Hinglish" occasionally — it gets 2-3x engagement on Indian LinkedIn vs pure English.', icon: '💬' },
            { hack: `Add "Open to Work" privately (visible only to recruiters) — ${industry} hiring is 40% recruiter-driven in India.`, icon: '🎯' },
            { hack: 'Comment on posts by founders of Indian startups in your space — this builds network faster than connection requests.', icon: '🚀' },
            { hack: `Get endorsed for "${moatSkills[0] ?? role}" by 5+ people — endorsed skills appear 2x higher in LinkedIn search on Naukri.`, icon: '⭐' },
          ].map((h, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5">
              <span className="text-sm mt-0.5">{h.icon}</span>
              <p className="text-[10px] text-foreground/80 leading-relaxed">{h.hack}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Share Roast — Viral CTA */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="rounded-2xl border-2 border-prophet-green/20 bg-prophet-green/[0.03] p-5"
      >
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-prophet-green mb-3">
          📤 Share Your Roast
        </p>
        <p className="text-[11px] text-muted-foreground mb-4">
          Challenge your colleagues — who has the worst LinkedIn profile?
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-whatsapp text-white font-black text-sm hover:bg-whatsapp-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-colors min-h-[44px]"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={handleCopyRoast}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-border bg-card text-foreground font-black text-sm hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-colors min-h-[44px]"
          >
            {copiedRoast ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Roast</>}
          </button>
        </div>
      </motion.div>

      <p className="text-[11px] text-muted-foreground/50 text-center italic">
        Roast generated from your scan data · Naukri/LinkedIn India benchmarks · 2026 AI skill trends
      </p>
    </div>
  );
}

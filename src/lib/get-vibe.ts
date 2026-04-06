import { type ScanReport, normalizeTools } from '@/lib/scan-engine';
import { inferSeniorityTier } from '@/lib/seniority-utils';
import { getVerbatimRole } from '@/lib/role-guard';

// ═══════════════════════════════════════════════════════════════
// CENTRALIZED VIBE ENGINE — Fear → Anxiety → Hope → Plan arc
// 
// Every score tier follows this emotional structure:
//   🔴 FEAR: The brutal honest truth (opens with shock)
//   😰 ANXIETY: What happens if you do nothing (deepens urgency)
//   💚 HOPE: The specific thing protecting you (relief pivot)
//   🗺️ PLAN: Your exact next move (empowerment close)
//
// Used by: JobSafetyCard, JobDangerMeterCard, ManagerConfidenceCard,
//          AIDossierReveal. All MUST use this shared source.
// ═══════════════════════════════════════════════════════════════

export type Vibe = {
  emoji: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  headline: string;       // FEAR hook — short, punchy
  body: string;           // ANXIETY deepener — what inaction costs
  hope: string;           // HOPE pivot — what's protecting you
  plan: string;           // PLAN directive — exact next move
  replaceability: string; // Boss-eye-view framing
  warmIntro?: string;     // Optional empathetic opener
  bullets: string[];      // Supporting evidence points
};

/** Normalize demand trend to human-readable label */
function demandLabel(raw: string): string {
  const d = raw.toLowerCase().trim();
  if (d.includes('rising') || d.includes('growing') || d.includes('high')) return 'strong';
  if (d.includes('stable') || d.includes('steady')) return 'steady';
  if (d.includes('declining') || d.includes('falling') || d.includes('weak')) return 'softening';
  if (d.includes('pressure') || d.includes('competitive')) return 'under pressure';
  return 'steady';
}

/**
 * Returns the emotional narrative vibe for a given career position score.
 * Each tier follows a Fear → Anxiety → Hope → Plan arc.
 */
export function getVibe(score: number, report: ScanReport): Vibe {
  const tier = inferSeniorityTier(report.seniority_tier);
  const tierLabel = tier.replace('_', ' ').toLowerCase();
  const moatSkills = (report.moat_skills || []).length;
  const rawDemand = report.market_position_model?.demand_trend ?? 'Stable';
  const demand = demandLabel(rawDemand);
  const automationRisk = report.automation_risk ?? report.determinism_index ?? 50;
  const roleName = getVerbatimRole(report);
  const talentDensity = report.market_position_model?.talent_density ?? 'moderate';
  const riskPct = Math.round(automationRisk);

  // ── TIER 1: SAFE ZONE (70+) ──────────────────────────────
  if (score >= 70) return {
    emoji: '🛡️', label: 'Safe Zone',
    color: 'text-prophet-green', bg: 'bg-prophet-green/[0.06]', border: 'border-prophet-green/20',

    headline: `You're safe today. But "today" has a shelf life.`,
    warmIntro: `Take a breath — your career isn't on fire. But the smoke is closer than you think.`,

    body: `Here's what keeps us up at night for people like you: 18 months ago, only ~${Math.max(5, Math.round(riskPct * 0.5))}% of ${roleName} work overlapped with AI. Today it's ${riskPct}%. That number doesn't go backwards. The professionals who lose their "safe" status are always the ones who assumed it was permanent.`,

    hope: `${moatSkills >= 3 ? `Your ${moatSkills} moat skills — the judgment-heavy, relationship-dependent ones — are genuinely hard to automate today.` : 'Your work requires real human judgment, and that creates natural protection.'} ${talentDensity === 'scarce' ? 'The talent pool for your profile is thin — that\'s real leverage.' : `As a ${tierLabel}, you carry institutional knowledge that doesn't live in any document.`}`,

    plan: `Lock in your advantage: identify which of your "safe" skills were on the safe list 2 years ago — because some of them won't be 2 years from now. Your defense plan maps exactly which capabilities to double down on.`,

    replaceability: 'Replacing you today would be expensive and painful. But AI-augmented professionals are learning to match your output at a fraction of the cost — your edge needs active maintenance.',

    bullets: [
      `Hiring demand is ${demand} — but companies are already piloting AI alternatives for parts of this exact role`,
      moatSkills >= 3 ? `${moatSkills} skills are hard to automate — but the "safe" list shrinks every year. 2 of these weren't at risk 2 years ago.` : 'Your judgment-heavy work protects you — but AI agents are starting to handle nuanced decisions too',
      `Your defense plan shows which moat skills have the shortest shelf life — so you stay ahead of the curve, not react to it`,
    ],
  };

  // ── TIER 2: STAY SHARP (50–69) ───────────────────────────
  if (score >= 50) return {
    emoji: '⚡', label: 'Stay Sharp',
    color: 'text-primary', bg: 'bg-primary/[0.06]', border: 'border-primary/20',

    headline: `This is the danger zone where careers quietly die.`,
    warmIntro: `This is the trickiest score range. You feel secure, your manager hasn't flagged anything — but this is exactly where silent displacement happens.`,

    body: `${riskPct}% of ${roleName} tasks can already be done by AI. That number was lower last quarter. Right now, a 25-year-old with ChatGPT, Claude, and a weekend course can deliver what took you years to master — in half the time. That's not an insult. That's the new math your boss is doing quietly.`,

    hope: `${moatSkills > 0 ? `You have ${moatSkills} skills that are genuinely hard to replicate — these are your lifeline. ` : ''}The gap between "valued" and "irreplaceable" is usually just 1-2 skills. You're not far from the safe zone — but you need to move deliberately.`,

    plan: `Your defense plan identifies the exact 1-2 moves that shift you from 'replaceable' to 'essential'. Most people in your score range only need 90 days of focused action to cross the line.`,

    replaceability: `You're valued — but "valued" and "irreplaceable" are very different words when budgets get cut. A younger professional with AI tools is your real competition now.`,

    bullets: [
      `Market demand is ${demand} — but companies are hiring fewer people for more output. AI-augmented teams are the new baseline.`,
      moatSkills > 0 ? `${moatSkills} of your strengths are hard to replicate — but without active investment, that drops to zero within 2 years` : `You don't have a clear "only-I-can-do-this" skill yet — that's the single biggest risk we flag`,
      `The parts of your work that are routine? AI is already doing them better and cheaper. Focus on the messy, human-judgment stuff.`,
    ],
  };

  // ── TIER 3: HEADS UP (30–49) ─────────────────────────────
  if (score >= 30) return {
    emoji: '🔥', label: 'Heads Up',
    color: 'text-prophet-gold', bg: 'bg-prophet-gold/[0.06]', border: 'border-prophet-gold/20',

    headline: `Your career is bleeding — and you might not feel it yet.`,
    warmIntro: `We know this is uncomfortable. But the people who recover from this score range are always the ones who saw it clearly first.`,

    body: `~${riskPct}% of what you do every day is exactly what AI is built to replace. Hiring demand is ${demand}. That means more people competing for fewer seats, while machines quietly take over the routine work. If you do nothing for the next 6 months, this score drops further — and the options narrow.`,

    hope: `${moatSkills > 0 ? `You have ${moatSkills} unique strengths that still separate you from the crowd — that's your foundation to build on. ` : ''}You're seeing this before 90% of people in your role even think about it. That awareness gap is worth more than any single skill — if you act on it now.`,

    plan: `This weekend: pick ONE skill that requires human creativity or deep relationships, and go all-in. Your defense plan shows the fastest path — most people in your range can meaningfully shift their score in 60-90 days.`,

    replaceability: `Honestly? This role could be backfilled faster than you'd like. But that's precisely why seeing this now — before your boss does — changes everything.`,

    bullets: [
      `A big chunk of your daily work follows patterns AI can learn — that's the core vulnerability`,
      moatSkills > 0 ? `You have ${moatSkills} skills keeping you differentiated — lean into these hard, they're your margin of survival` : `Right now, it's hard to point to one thing that makes you irreplaceable — let's fix that before someone else notices`,
      `Your defense plan maps the fastest escape route from this risk zone — the window is open, but it's not open forever`,
    ],
  };

  // ── TIER 4: ACT NOW (<30) ────────────────────────────────
  return {
    emoji: '🚨', label: 'Act Now',
    color: 'text-destructive', bg: 'bg-destructive/[0.06]', border: 'border-destructive/20',

    headline: `This is the warning your company will never give you.`,
    warmIntro: `You're not alone. 1 in 3 professionals in your category scored under 30 this year. The ones who turned it around started with exactly this kind of honest picture.`,

    body: `Most ${roleName} day-to-day work maps directly onto what AI already does — well, fast, and for a fraction of your salary. High talent supply + routine tasks + ${demand} demand = the math isn't in your favor. Every month you wait, the options get fewer and the competition gets stronger.`,

    hope: `But here's what matters: you're looking at this right now. You have 6 months of runway that most people in your role don't even know they're burning through. ${moatSkills > 0 ? `And you still have ${moatSkills} skills that create real differentiation — that's your starting point.` : 'The defense plan below maps your fastest path to building a genuine moat.'}`,

    plan: `Start this week — not next month, this week. Identify one thing only YOU can do that requires human judgment, creativity, or relationships, and make it visible to decision-makers. Your defense plan gives you the exact 90-day roadmap.`,

    replaceability: `This seat could be filled quickly. But you're here, looking at this clearly, while your peers are scrolling LinkedIn pretending everything is fine. That's the whole point.`,

    bullets: [
      `~${riskPct}% of your tasks overlap with AI capabilities — one of the highest we see`,
      `Talent supply is high — you're competing with more people AND machines simultaneously`,
      `Your defense plan is your escape route — the people who act on it within 7 days see the fastest score improvements`,
    ],
  };
}

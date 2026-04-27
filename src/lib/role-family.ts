/**
 * role-family.ts
 *
 * Detects the user's *functional role family* (Marketing, Sales, Finance, Engineering, etc.)
 * — orthogonal to persona-detect.ts which keys on employer-type (IT_SERVICES / BPO / PSU).
 *
 * Why both exist:
 *   - persona-detect = "what kind of employer/sector are you in" → drives urgency framing
 *   - role-family    = "what kind of work do you do" → drives the verdict NARRATIVE
 *
 * A Digital Marketing Manager at a SaaS startup (GENERALIST persona, MARKETING family)
 * needs a wage-compression frame. A TCS Java dev (IT_SERVICES persona, ENGINEERING family)
 * needs an AI-pair-programmer commoditization frame. Same score → very different verdicts.
 *
 * This is the structural fix for the "are we just a ChatGPT layer" credibility leak:
 * persona × family × score = 50+ distinct narrative cells, all keyed off deterministic signals.
 */

import type { ScanReport } from './scan-engine';

export type RoleFamily =
  | 'MARKETING'
  | 'SALES'
  | 'ENGINEERING'
  | 'DATA_ANALYTICS'
  | 'FINANCE_OPS'
  | 'PRODUCT_DESIGN'
  | 'HR_PEOPLE'
  | 'CREATIVE_CONTENT'
  | 'LEGAL_COMPLIANCE'
  | 'CUSTOMER_SUCCESS'
  | 'EXECUTIVE'
  | 'GENERIC';

const SIGNAL_MAP: Array<{ family: RoleFamily; tokens: string[] }> = [
  { family: 'EXECUTIVE', tokens: ['ceo', 'cto', 'cfo', 'coo', 'cmo', 'chief ', 'founder', 'co-founder', 'co founder', 'managing director', 'vp ', 'vice president', 'president'] },
  { family: 'MARKETING', tokens: ['marketing', 'demand generation', 'demand gen', 'growth marketer', 'growth marketing', 'brand manager', 'seo', 'sem ', 'ppc', 'performance marketing', 'digital marketing', 'content marketing', 'product marketing', 'lifecycle marketing', 'crm marketing', 'abm', 'martech'] },
  { family: 'SALES', tokens: ['sales', 'business development', 'account executive', 'account manager', 'inside sales', 'sdr', 'bdr', 'enterprise sales', 'channel sales', 'partnerships', 'pre-sales', 'presales', 'sales engineer', 'revenue ops', 'revops'] },
  { family: 'ENGINEERING', tokens: ['software engineer', 'software developer', 'developer', 'programmer', 'devops', 'sre ', 'site reliability', 'qa engineer', 'test engineer', 'mobile engineer', 'frontend', 'backend', 'full stack', 'fullstack', 'engineering manager', 'tech lead', 'principal engineer', 'staff engineer'] },
  { family: 'DATA_ANALYTICS', tokens: ['data scientist', 'data analyst', 'business analyst', 'data engineer', 'analytics', 'machine learning', 'ml engineer', 'ai engineer', 'bi developer', 'business intelligence', 'quantitative', 'statistician'] },
  { family: 'FINANCE_OPS', tokens: ['finance', 'accountant', 'accounting', 'controller', 'auditor', 'tax ', 'treasury', 'fp&a', 'financial analyst', 'investment', 'banker', 'banking', 'operations manager', 'supply chain', 'procurement', 'logistics'] },
  { family: 'PRODUCT_DESIGN', tokens: ['product manager', 'product owner', 'pm ', 'ux designer', 'ui designer', 'product designer', 'design lead', 'visual designer', 'interaction designer', 'design system', 'researcher'] },
  { family: 'HR_PEOPLE', tokens: ['human resource', 'hr ', 'people ops', 'talent acquisition', 'recruiter', 'recruitment', 'l&d', 'learning and development', 'compensation', 'hrbp', 'people partner'] },
  { family: 'CREATIVE_CONTENT', tokens: ['copywriter', 'content writer', 'editor', 'journalist', 'creative director', 'art director', 'illustrator', 'photographer', 'videographer', 'video editor', 'animator', 'producer'] },
  { family: 'LEGAL_COMPLIANCE', tokens: ['lawyer', 'attorney', 'paralegal', 'legal counsel', 'compliance', 'risk manager', 'company secretary'] },
  { family: 'CUSTOMER_SUCCESS', tokens: ['customer success', 'customer experience', 'cx ', 'account success', 'csm ', 'support engineer', 'technical support', 'implementation specialist'] },
];

export function detectRoleFamily(report: ScanReport): RoleFamily {
  const role = (report.role || '').toLowerCase();
  const verbatim = ((report as any).role_detected || '').toLowerCase();
  const haystack = `${role} ${verbatim}`;

  // Executive check is permissive — a "Marketing Director" goes to MARKETING, not EXECUTIVE,
  // because the family-specific narrative is more useful than the generic exec one.
  // Only true C-suite / founder titles route to EXECUTIVE.
  for (const { family, tokens } of SIGNAL_MAP) {
    if (tokens.some(t => haystack.includes(t))) return family;
  }
  return 'GENERIC';
}

/**
 * Family-specific narrative overlay. Returned strings get spliced into getVibe()'s
 * tier-level templates so the SAME score reads differently for a marketer vs a developer.
 *
 * Each field is a sentence fragment designed to drop into a vibe-tier template without
 * needing the template to know the family.
 */
export interface FamilyNarrative {
  /** The *real* threat verb for this family. Replaces generic "AI replaces you". */
  threatFrame: string;
  /** What the user actually loses if they do nothing — concrete, not abstract. */
  lossFrame: string;
  /** Where this family's irreplaceable edge lives. */
  edgeFrame: string;
  /** The single most credible "we get your job" proof phrase. */
  credibilityProof: string;
  /** Cost-of-inaction anchor for the paywall — quantified where possible. */
  inactionCost: string;
}

export function getFamilyNarrative(family: RoleFamily): FamilyNarrative {
  switch (family) {
    case 'MARKETING':
      return {
        threatFrame: 'AI-native marketers with the same years + GPT/Claude/HubSpot Breeze workflows are quietly taking your salary band at 60–70% of cost.',
        lossFrame: 'It rarely shows up as a layoff. It shows up as a flat appraisal, a frozen hiring req, and a 26-year-old running your campaigns at half your CTC.',
        edgeFrame: 'Your real moat is GTM judgment, ABM orchestration, and the executive-room work — the parts AI can draft but cannot own.',
        credibilityProof: 'campaign ops, attribution, and lifecycle automation are already commodity — pipeline ownership is not.',
        inactionCost: 'Wage compression in your band: roughly 25–40% real-terms erosion over 24 months if you stay tactical.',
      };
    case 'SALES':
      return {
        threatFrame: 'AI SDRs and auto-prospecting tools are eating the top of your funnel — and your quota is being recalibrated against them.',
        lossFrame: 'Quotas go up, ramp times get shorter, and the bottom 30% of the team gets quietly managed out within two cycles.',
        edgeFrame: 'Your edge is complex deal navigation, exec-to-exec trust, and reading the room — none of which lives in any CRM.',
        credibilityProof: 'cold outreach and qualification are now AI-cheap — closing complex deals is not.',
        inactionCost: 'OTE compression for non-strategic AEs: 15–30% over 18 months as territory sizes grow and ramps shorten.',
      };
    case 'ENGINEERING':
      return {
        threatFrame: 'AI pair-programmers (Cursor, Copilot, Claude Code) have collapsed the value of mid-level execution work — promotion ladders are bifurcating.',
        lossFrame: 'You stay employed but stuck — bench time grows, raises shrink, and the next level keeps moving further away.',
        edgeFrame: 'Architecture, ambiguous problem framing, and code review judgment are still genuinely scarce — that is where your premium lives.',
        credibilityProof: 'ticket execution and boilerplate are AI-baseline — system design and code-review taste are not.',
        inactionCost: 'Mid-level IC salary bands are flattening: ~20% real compression projected over 24 months without the staff-track jump.',
      };
    case 'DATA_ANALYTICS':
      return {
        threatFrame: 'Self-serve BI plus LLM-driven SQL means the "pull this number for me" work — half your week — is collapsing fast.',
        lossFrame: 'Analyst headcount per business unit is being cut 30–50% as stakeholders self-serve. The survivors do statistical rigor and causal inference.',
        edgeFrame: 'Experimentation design, causal inference, and translating ambiguous business questions into models is what still pays.',
        credibilityProof: 'dashboarding and ad-hoc SQL are commodity — experiment design and modeling judgment are not.',
        inactionCost: 'Junior-mid analyst roles down ~30% YoY in posted openings; without the pivot to ML/causal work, salary stagnates.',
      };
    case 'FINANCE_OPS':
      return {
        threatFrame: 'AI is collapsing reconciliations, variance analysis, and routine reporting into one-click flows — your weekly cycle is the target.',
        lossFrame: 'Headcount per ₹100Cr revenue is dropping. The role survives; the team size does not. Comp growth flattens for the next 3 cycles.',
        edgeFrame: 'Forecasting judgment, board-room storytelling, and audit defensibility are still human work.',
        credibilityProof: 'closing the books and variance reports are AI-ready — strategic finance and audit posture are not.',
        inactionCost: 'Finance team sizes shrinking ~25% over 36 months at mid-cap firms; comp moves with seniority, not tenure.',
      };
    case 'PRODUCT_DESIGN':
      return {
        threatFrame: 'AI design tools and PRD-generators have collapsed the "translate spec to artifact" work — the seat is being redefined around taste and judgment.',
        lossFrame: 'Junior PM/designer reqs are being delayed indefinitely. Senior reqs are growing — but the bar is taste, not output volume.',
        edgeFrame: 'Customer insight, prioritization under ambiguity, and cross-functional persuasion are the irreplaceable layer.',
        credibilityProof: 'spec-writing and mock generation are commodity — prioritization judgment and customer insight are not.',
        inactionCost: 'Junior PM/design openings down 35% YoY; senior roles unchanged — the gap between the two has never been wider.',
      };
    case 'HR_PEOPLE':
      return {
        threatFrame: 'AI screening, automated outreach, and LLM-drafted JDs have compressed core recruiting and HR-ops work.',
        lossFrame: 'TA team sizes are being cut 30–40%. The work shifts to executive search, employer brand, and sensitive ER cases.',
        edgeFrame: 'Executive hiring judgment, ER navigation, and culture work cannot be templated.',
        credibilityProof: 'JD drafting and candidate screening are AI-ready — exec hiring and ER work are not.',
        inactionCost: 'Generalist HR/TA roles down ~30%; comp growth flat unless you pivot to exec search or HRBP.',
      };
    case 'CREATIVE_CONTENT':
      return {
        threatFrame: 'Generative tools have made first-draft content nearly free — the rate per piece is collapsing, and so is the assumption you are needed.',
        lossFrame: 'Per-word rates have dropped 40–60% for routine content; full-time content seats are being converted to fractional or eliminated.',
        edgeFrame: 'Original reporting, distinctive voice, brand-defining narrative work, and editing taste still command real money.',
        credibilityProof: 'first drafts and SEO content are commodity — original reporting and brand voice are not.',
        inactionCost: 'Routine content rates down 40–60%; full-time roles being converted to retainer/fractional at lower comp.',
      };
    case 'LEGAL_COMPLIANCE':
      return {
        threatFrame: 'AI contract review and compliance automation tools (Harvey, Spellbook) are compressing the associate/junior layer fastest.',
        lossFrame: 'Mid-tier associate work — diligence, contract review, research memos — is being absorbed by tooling. Hours billable per matter falls.',
        edgeFrame: 'Strategic counsel, courtroom judgment, and client trust are protected; the document-production layer is not.',
        credibilityProof: 'document review and standard contract drafting are AI-augmented — strategic counsel and litigation judgment are not.',
        inactionCost: 'Associate-tier billable hours down ~20–30% per matter at firms using AI review; partnership tracks shifting accordingly.',
      };
    case 'CUSTOMER_SUCCESS':
      return {
        threatFrame: 'AI-driven support and self-serve playbooks are absorbing tier-1 and tier-2 work — the seat is moving toward strategic CSM.',
        lossFrame: 'Support headcount per 1000 customers is collapsing. Generalist CSM roles are being merged or eliminated.',
        edgeFrame: 'Strategic account expansion, exec QBR ownership, and renewal negotiation cannot be automated.',
        credibilityProof: 'tier-1 support and onboarding are AI-baseline — strategic account ownership and renewals are not.',
        inactionCost: 'Generalist CSM roles down ~25%; strategic CSM/AM roles flat — the comp gap is widening.',
      };
    case 'EXECUTIVE':
      return {
        threatFrame: 'For your level, the threat is not displacement — it is restructuring: flatter org charts, AI-native peers, and shorter board patience for headcount-heavy plans.',
        lossFrame: 'It rarely arrives as a firing. It arrives as a quiet org redesign, a "strategic review", or a comp restructuring tied to AI-leveraged metrics.',
        edgeFrame: 'Capital allocation judgment, board trust, and operator pattern-matching across cycles is your moat.',
        credibilityProof: 'IC-level execution is AI-leverageable — capital allocation and board judgment are not.',
        inactionCost: 'Severance and re-employment friction at exec level is asymmetric — the cost of a forced exit is 12–24 months of lost comp.',
      };
    case 'GENERIC':
    default:
      return {
        threatFrame: 'The routine layer of your work is being absorbed by AI tools — the role survives, the team sizes do not.',
        lossFrame: 'It usually shows up as a flat appraisal and a frozen hiring req long before it shows up as a layoff.',
        edgeFrame: 'The judgment-heavy, relationship-dependent work is where your premium lives.',
        credibilityProof: 'execution work is AI-leverageable — judgment work is not.',
        inactionCost: 'Real-terms comp erosion typically runs 15–25% over 24 months when the routine layer is not actively replaced with judgment work.',
      };
  }
}

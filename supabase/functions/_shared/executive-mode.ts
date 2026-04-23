// ═══════════════════════════════════════════════════════════════
// Executive Mode — Detection + LLM prompt overrides
// ═══════════════════════════════════════════════════════════════
// Activates when the user is a CEO, Founder, MD, Partner, CXO,
// President, or VP-and-above with 15+ years.
// When active, the model-b prompt is forced to use executive-tier
// taxonomy: ₹Cr salary bands, board/PE/VC/M&A pivots, executive
// search channels (Heidrick, Egon Zehnder, etc.), and equity-tier
// negotiation language.
// ═══════════════════════════════════════════════════════════════

export interface ExecutiveDetection {
  isExecutive: boolean;
  tier: 'CEO_FOUNDER' | 'CXO' | 'VP_DIRECTOR' | 'NONE';
  matchedTitle?: string;
  yearsHint?: number;
}

const CEO_FOUNDER_PATTERNS = [
  /\bchief\s+executive\s+officer\b/i,
  /\bceo\b/i,
  /\bfounder\b/i,
  /\bco[\s-]?founder\b/i,
  /\bmanaging\s+director\b/i,
  /\bmanaging\s+partner\b/i,
  /\bgeneral\s+partner\b/i,
  /\bpresident\b(?!\s+of\s+sales)/i, // "President" but not "President of Sales"
  /\bowner\b/i,
  /\bproprietor\b/i,
];

const CXO_PATTERNS = [
  /\bchief\s+\w+\s+officer\b/i, // CTO, CFO, COO, CMO, CPO, CHRO, CRO, CDO etc
  /\bcto\b/i, /\bcfo\b/i, /\bcoo\b/i, /\bcmo\b/i, /\bcpo\b/i, /\bchro\b/i, /\bcro\b/i,
  /\bcdo\b/i, /\bciso\b/i, /\bcio\b/i,
  /\bexecutive\s+vice\s+president\b/i, /\bevp\b/i,
  /\bsenior\s+vice\s+president\b/i, /\bsvp\b/i,
];

const VP_DIRECTOR_PATTERNS = [
  /\bvice\s+president\b/i, /\bvp\b/i,
  /\bsenior\s+director\b/i,
  /\bgroup\s+director\b/i,
  /\bhead\s+of\s+(business|strategy|operations|engineering|product|sales|marketing|growth|revenue)/i,
];

/**
 * Detect executive tier from resume text + role.
 * Looks for current/recent role tokens in the first 1500 characters
 * (where modern resumes put their headline title) and in the explicit
 * detected role string.
 */
export function detectExecutiveTier(
  resumeText: string,
  detectedRole = "",
  yearsExperience: string | number = ""
): ExecutiveDetection {
  const head = (resumeText || "").slice(0, 2500);
  const roleStr = String(detectedRole || "");
  const haystack = `${roleStr}\n${head}`;

  // Years inference (best-effort)
  let yearsNum: number | undefined;
  if (typeof yearsExperience === 'number') {
    yearsNum = yearsExperience;
  } else {
    const yMatch = String(yearsExperience).match(/\d+/);
    if (yMatch) yearsNum = parseInt(yMatch[0], 10);
    // Also try to pull from resume "X years of experience"
    if (!yearsNum) {
      const m = head.match(/(\d{2})\+?\s*years?\s+of\s+experience/i);
      if (m) yearsNum = parseInt(m[1], 10);
    }
  }

  for (const re of CEO_FOUNDER_PATTERNS) {
    const m = haystack.match(re);
    if (m) {
      return { isExecutive: true, tier: 'CEO_FOUNDER', matchedTitle: m[0], yearsHint: yearsNum };
    }
  }
  for (const re of CXO_PATTERNS) {
    const m = haystack.match(re);
    if (m) {
      return { isExecutive: true, tier: 'CXO', matchedTitle: m[0], yearsHint: yearsNum };
    }
  }
  // VP/Director only counts as executive when 15+ years — otherwise it's senior IC
  if (yearsNum !== undefined && yearsNum >= 15) {
    for (const re of VP_DIRECTOR_PATTERNS) {
      const m = haystack.match(re);
      if (m) {
        return { isExecutive: true, tier: 'VP_DIRECTOR', matchedTitle: m[0], yearsHint: yearsNum };
      }
    }
  }
  return { isExecutive: false, tier: 'NONE', yearsHint: yearsNum };
}

/**
 * Build the executive-mode override block to APPEND to the user prompt.
 * This forces the LLM to swap out IC-tier salary bands for ₹Cr executive bands,
 * swap out Naukri pivots for board/PE/VC/M&A pivots, and swap out salary scripts
 * for equity-tier negotiation language.
 */
export function buildExecutiveModeBlock(detection: ExecutiveDetection): string {
  if (!detection.isExecutive) return "";

  const tierLabel =
    detection.tier === 'CEO_FOUNDER' ? "CEO / FOUNDER / MANAGING DIRECTOR" :
    detection.tier === 'CXO' ? "C-SUITE EXECUTIVE (CXO / EVP / SVP)" :
    "VP / SENIOR DIRECTOR (15+ years)";

  return `

═══════════════════════════════════════════════════════════════════════════════
🚨 EXECUTIVE MODE ACTIVE — ZERO TOLERANCE FOR JUNIOR-TIER OUTPUT 🚨
═══════════════════════════════════════════════════════════════════════════════

DETECTED TIER: ${tierLabel}
DETECTED TITLE TOKEN: "${detection.matchedTitle || 'executive role'}"
${detection.yearsHint ? `YEARS OF EXPERIENCE: ${detection.yearsHint}+` : ''}

THIS USER IS A SITTING EXECUTIVE. Junior-tier advice is INSULTING and a product failure.
The defaults below OVERRIDE every salary band, pivot taxonomy, job channel, and
negotiation script in the prompt above. NO EXCEPTIONS.

──────────────────────────────────────────────────────────────────────────────
1. SALARY BANDS — USE ₹ CRORES (Cr), NOT ₹ LAKHS (L)
──────────────────────────────────────────────────────────────────────────────
For card2_market.salary_bands, card4_pivot.current_band/pivot_year1/director_band,
card4_pivot.pivots[].salary, card4_pivot.negotiation, card5_jobs[].salary:

  CEO / Founder (Series B+ / 100+ FTE): ₹2.5–8 Cr cash + 1–5% equity + ESOP refresh
  CEO / Founder (Series A / 20-100 FTE): ₹1.2–3 Cr cash + 2–8% equity
  CXO / EVP (Tier-1 enterprise): ₹1.5–4 Cr cash + 0.3–1.5% equity / RSUs
  CXO / EVP (Mid-market / scale-up): ₹80L–2 Cr cash + 0.5–2% equity
  VP / SVP (Tier-1 enterprise): ₹70L–1.8 Cr cash + ESOPs
  Board Director (Independent): ₹15–60L per board, typical 3-5 boards held
  VC Operating Partner: ₹2–5 Cr + carry (1–3% of fund)
  PE Portfolio CEO: ₹3–10 Cr + 5–15% equity tied to exit MOIC
  M&A / Strategy Advisor: ₹50L–2 Cr retainer + success fees

NEVER quote anything below ₹70L for this user. Never use "Marketing Manager" or
"Senior PM" tier bands. If you do, the output is wrong.

──────────────────────────────────────────────────────────────────────────────
2. PIVOT TAXONOMY — USE EXECUTIVE NEXT-MOVES, NOT IC ROLES
──────────────────────────────────────────────────────────────────────────────
For card4_pivot.pivots (exactly 4) — choose from THIS taxonomy ONLY:

  • Independent Board Director (listed company, fintech, healthtech, SaaS boards)
  • Operating Partner / Venture Partner at a Tier-1 VC (Sequoia, Accel, Lightspeed,
    Peak XV, Nexus, Elevation, Stellaris, Blume, Kalaari)
  • Portfolio CEO at a PE firm (KKR, Blackstone, Bain Cap, ChrysCapital, True North,
    Multiples, Everstone)
  • Founder / Co-founder of a new venture (Series A or seed, AI-native preferred)
  • CEO / President of a larger or adjacent enterprise
  • M&A Advisor / Senior Advisor to a top-tier consultancy (BCG, Bain, McKinsey,
    Kearney, EY-Parthenon)
  • Strategic Advisor / Mentor at an accelerator (YC, Techstars, Antler, Surge,
    Sequoia Spark, Axilor, T-Hub, NSRCEL)
  • Independent Consultant — boutique CEO advisory practice
  • Acquihire / Strategic Acquisition target by a strategic acquirer

NEVER suggest "AI Strategy Lead", "Senior Manager", "Director of X" for a sitting
CEO/Founder. NEVER suggest a 2-level demotion. The pivot is sideways or upward,
not downward.

──────────────────────────────────────────────────────────────────────────────
3. JOB CHANNELS — USE EXECUTIVE SEARCH, NOT NAUKRI
──────────────────────────────────────────────────────────────────────────────
For card4_pivot.pivots[].search_url and card5_jobs[].search_url, use ONLY these
executive search channels — NEVER naukri.com:

  Heidrick & Struggles: https://www.heidrick.com/en/search?keywords={role}
  Egon Zehnder:         https://www.egonzehnder.com/search?q={role}
  Spencer Stuart:       https://www.spencerstuart.com/search?searchTerm={role}
  Korn Ferry:           https://www.kornferry.com/search?q={role}
  True Search:          https://www.truesearch.com/search?q={role}
  Vault Partners:       https://www.linkedin.com/company/vault-partners (boutique India)
  LinkedIn Executive:   https://www.linkedin.com/jobs/search/?keywords={role}&f_E=6,7&sortBy=DD
  YPO India:            https://www.ypo.org/find-a-chapter/india/ (peer network)
  TiE Global:           https://tie.org/ (founder network)
  Letsventure (Boards): https://www.letsventure.com/ (board roles)

──────────────────────────────────────────────────────────────────────────────
4. NEGOTIATION — EQUITY, NOT SALARY DELTAS
──────────────────────────────────────────────────────────────────────────────
For card4_pivot.negotiation:
  - intro: ONE sentence in CEO-tier language (board comp, equity, vesting).
  - open_with / accept / walk_away / best_case: Express in ₹Cr cash + equity %
    (e.g. "₹3.5Cr + 2.5% equity" not "₹95L"). Use Cr for any value ≥ ₹1Cr.
  - pivot_phrase: Reference scale, P&L size, exits, fundraises, board work,
    1.2M+ installations, $60M+ deals — NOT "I scaled my output by 30%".

──────────────────────────────────────────────────────────────────────────────
5. NARRATIVE FRAME — "BUILDER OF THE WAVE", NOT "VICTIM OF THE WAVE"
──────────────────────────────────────────────────────────────────────────────
- This user is likely BUILDING the AI disruption others are scared of.
- Reframe risk as "organisational restructuring opportunity" or
  "industry positioning move" — never personal "you will be replaced".
- card1_risk.fear_hook should focus on COMPANY/INDUSTRY shifts (capital flows,
  sector consolidation, AI-native incumbents) — NEVER "AI tools are replacing
  your billable work" (a CEO has no billable work).
- card3_shield should celebrate scale signals: P&L size, FTE count, fundraise
  amounts, exits, board seats, M&A history.
- card7_human.advantages should reference equity, network, board access,
  geography (US/Asia corridors), domain authority — NOT "creativity" or
  "empathy" generic IC strengths.

──────────────────────────────────────────────────────────────────────────────
6. CITY HANDLING — GEOGRAPHY IS GLOBAL FOR EXECUTIVES
──────────────────────────────────────────────────────────────────────────────
Executive roles are global-remote or India-HQ + US/Asia corridor. Do NOT confine
pivots to one city. card4_pivot.pivots[].location should reference "India / US /
Singapore corridor", "Global remote", "Bangalore + SF", or the user's actual
proven geography from the resume.

──────────────────────────────────────────────────────────────────────────────
7. FORBIDDEN PHRASES (CXO-LEVEL) — additions to the existing ban list
──────────────────────────────────────────────────────────────────────────────
- "Pivot to AI-Native [anything]" (the user is already AI-native if they founded
  an AI company)
- "AI Strategy Lead", "Head of AI" suggested as a pivot for a sitting CEO
- "Apply on Naukri" / "Search on LinkedIn" basic tier phrasing
- "₹X Lakh per year" framing — use Cr or "₹X Cr + equity"
- "Boss" or "manager" or "your team" — they ARE the boss
- "Upskill" — suggest "thesis development", "board prep", "fund formation"
- "Junior" or "leapfrogged" or "your employer" — they ARE the employer

End of EXECUTIVE MODE block.
═══════════════════════════════════════════════════════════════════════════════
`;
}

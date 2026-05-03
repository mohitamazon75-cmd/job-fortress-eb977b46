// ═══════════════════════════════════════════════════════════════
// Job vs Business — Founder Readiness Scoring (deterministic)
// ═══════════════════════════════════════════════════════════════
// Pure module. No LLM. No network. Fully testable.
//
// Why these 5 questions: blends the 3 highest-signal founder-survival
// predictors (runway, dependents, demand pull) with 2 commitment/edge
// signals (unfair advantage, hours+tolerance). Demand pull is weighted
// hardest because "people already paying / asking" is the single best
// predictor of startup survival per Y Combinator + First Round data.
//
// Score range: 0–15. Bands tuned to be honest, not flattering.

export type AnswerKey =
  | "runway"
  | "dependents"
  | "advantage"
  | "demand"
  | "commitment";

export interface QuizAnswers {
  runway: 0 | 1 | 2 | 3;        // months saved: <3 / 3-6 / 6-12 / 12+
  dependents: 0 | 1 | 2 | 3;    // who depends: many / some / partner only / none
  advantage: 0 | 1 | 2 | 3;     // unfair advantage: none / domain / domain+network / all three
  demand: 0 | 1 | 2 | 3;        // pull signal: idea only / 1-2 nods / 3+ asked / paid pilot
  commitment: 0 | 1 | 2 | 3;    // hrs/wk + dip tolerance: <5 / 5-15 / 15-25 + 12mo dip / 25+ + 18mo dip
}

export type Band = "BUILD" | "SIDE_HUSTLE" | "PREP_12_MONTHS" | "JOB_IS_MOAT";

export interface Verdict {
  score: number;            // 0–15
  band: Band;
  headline: string;
  oneLiner: string;
  goNoGo: "GO" | "WAIT" | "NO";
}

// Weights: equal raw 0–3 inputs (already differentiated by question difficulty),
// but demand acts as a soft veto via band logic below.
export function scoreAnswers(a: QuizAnswers): number {
  return a.runway + a.dependents + a.advantage + a.demand + a.commitment;
}

export function classify(a: QuizAnswers): Verdict {
  const score = scoreAnswers(a);

  // Veto rule: demand=0 AND advantage<=1 caps at PREP regardless of score.
  // Without paying customers OR an unfair edge, a high score just means
  // "comfortable to fail" — not "ready to win".
  const noEdgeNoDemand = a.demand === 0 && a.advantage <= 1;

  let band: Band;
  if (score >= 12 && a.demand >= 2) band = "BUILD";
  else if (score >= 9 && !noEdgeNoDemand) band = "SIDE_HUSTLE";
  else if (score >= 6) band = "PREP_12_MONTHS";
  else band = "JOB_IS_MOAT";

  return { score, band, ...COPY[band] };
}

const COPY: Record<Band, Omit<Verdict, "score" | "band">> = {
  BUILD: {
    headline: "You're rare. Build it.",
    oneLiner: "Runway, demand pull, and an unfair edge — the three things most aspirants don't have. Quit-and-build is on the table.",
    goNoGo: "GO",
  },
  SIDE_HUSTLE: {
    headline: "Side-hustle first. Don't quit yet.",
    oneLiner: "You have the edge but not the runway-or-demand combo to survive 18 months of zero income. Ship a paid pilot on weekends first.",
    goNoGo: "WAIT",
  },
  PREP_12_MONTHS: {
    headline: "12 months of prep before you bet.",
    oneLiner: "The instinct is real but the foundation isn't. Stack runway, find 3 paying customers, and rescore. Don't romanticise the leap.",
    goNoGo: "WAIT",
  },
  JOB_IS_MOAT: {
    headline: "Right now, your job is your moat.",
    oneLiner: "Building today would burn savings and morale before you find product-market fit. Stay employed, build optionality, revisit in 12 months.",
    goNoGo: "NO",
  },
};

// Question definitions — single source of truth for UI.
export interface QuizQuestion {
  key: AnswerKey;
  prompt: string;
  why: string;        // shown as small subtext — explains why we ask
  options: { value: 0 | 1 | 2 | 3; label: string }[];
}

export const QUESTIONS: QuizQuestion[] = [
  {
    key: "runway",
    prompt: "How many months of expenses do you have saved?",
    why: "Most founders fail not from bad ideas — they fail from running out of money before signal arrives.",
    options: [
      { value: 0, label: "Less than 3 months" },
      { value: 1, label: "3–6 months" },
      { value: 2, label: "6–12 months" },
      { value: 3, label: "12+ months (or working spouse covers fixed costs)" },
    ],
  },
  {
    key: "dependents",
    prompt: "Who financially depends on your income?",
    why: "Dependents change the math. A bad year for you can mean a bad year for them.",
    options: [
      { value: 0, label: "Parents + kids + spouse — I'm the only earner" },
      { value: 1, label: "Spouse + 1 child, partial dependence" },
      { value: 2, label: "Partner only, both contribute" },
      { value: 3, label: "Just me — no one depends on this paycheck" },
    ],
  },
  {
    key: "advantage",
    prompt: "What's your unfair advantage?",
    why: "Without one, you're a tourist competing with locals. Domain insight + distribution access is the rare combo that wins.",
    options: [
      { value: 0, label: "None really — I have a strong idea" },
      { value: 1, label: "Deep domain knowledge from my work" },
      { value: 2, label: "Domain + a network of potential customers" },
      { value: 3, label: "All three: domain, network, and a co-founder/team" },
    ],
  },
  {
    key: "demand",
    prompt: "Has anyone offered to pay for this — or asked when it'll be ready?",
    why: "The killer signal. People asking 'can I buy?' beats 1,000 'cool idea, bro' replies.",
    options: [
      { value: 0, label: "It's still in my head — I haven't tested it" },
      { value: 1, label: "1–2 friends said it sounds useful" },
      { value: 2, label: "3+ strangers/professionals asked when it's launching" },
      { value: 3, label: "I've already taken money for a manual version of it" },
    ],
  },
  {
    key: "commitment",
    prompt: "How much can you commit, and for how long without income?",
    why: "Startups take longer than you think. Most ideas need 18 months of grind before they pay you back.",
    options: [
      { value: 0, label: "<5 hrs/week, can't afford any income drop" },
      { value: 1, label: "5–15 hrs/week, could survive 6 months on savings" },
      { value: 2, label: "15–25 hrs/week, could go 12 months without salary" },
      { value: 3, label: "25+ hrs/week, ready for 18+ months of zero income" },
    ],
  },
];

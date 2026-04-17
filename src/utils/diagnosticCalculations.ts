// ─── Constants ─────────────────────────────────────────────────────────────────

export const AI_STACK_COST_INR = 6000; // ₹6,000/month (Claude Pro + ChatGPT + Perplexity + Canva AI)

export const AI_SKILLS = [
  "writing content",
  "data analysis",
  "research",
  "scheduling",
  "reporting",
  "customer support",
  "email drafting",
  "translation",
  "basic coding",
  "data entry",
  "market research",
  "social media posting",
  "making presentations",
  "proofreading",
  "invoice processing",
  "lead generation",
  "SEO",
  "excel/sheets work",
  "cold outreach",
];

export const HUMAN_SKILLS = [
  "client relationships",
  "leadership",
  "team management",
  "strategy",
  "mentoring",
  "creative direction",
  "negotiation",
  "complex sales",
  "stakeholder alignment",
  "crisis management",
  "product vision",
  "hiring & culture",
  "public speaking",
  "conflict resolution",
  "vendor management",
  "P&L ownership",
  "investor relations",
];

export const EXPERIENCE_BANDS = ["0-2 yrs", "3-5 yrs", "6-10 yrs", "10+ yrs"];

// ─── Auto-detect skills from job title ─────────────────────────────────────────

const AUTO_DETECT_MAP: Record<string, { ai: string[]; human: string[] }> = {
  marketing: {
    ai: ["writing content", "research", "reporting", "market research", "social media posting", "making presentations"],
    human: ["creative direction", "stakeholder alignment"],
  },
  accountant: {
    ai: ["data analysis", "reporting", "invoice processing", "excel/sheets work"],
    human: [],
  },
  "software engineer": {
    ai: ["basic coding", "data analysis"],
    human: ["strategy", "product vision"],
  },
  developer: {
    ai: ["basic coding", "data analysis"],
    human: ["product vision"],
  },
  sales: {
    ai: ["cold outreach", "lead generation", "email drafting"],
    human: ["negotiation", "complex sales", "client relationships"],
  },
  hr: {
    ai: ["scheduling", "data entry", "reporting"],
    human: ["hiring & culture", "conflict resolution", "mentoring"],
  },
  recruiter: {
    ai: ["scheduling", "data entry", "cold outreach", "email drafting"],
    human: ["client relationships", "negotiation"],
  },
  content: {
    ai: ["writing content", "research", "social media posting", "SEO"],
    human: ["creative direction"],
  },
  copywriter: {
    ai: ["writing content", "research", "proofreading"],
    human: ["creative direction"],
  },
  "product manager": {
    ai: ["research", "data analysis", "reporting", "making presentations"],
    human: ["product vision", "stakeholder alignment", "strategy"],
  },
  "customer support": {
    ai: ["customer support", "email drafting", "data entry"],
    human: ["conflict resolution", "client relationships"],
  },
  designer: {
    ai: ["making presentations"],
    human: ["creative direction", "stakeholder alignment"],
  },
  analyst: {
    ai: ["data analysis", "research", "reporting", "excel/sheets work"],
    human: ["strategy", "stakeholder alignment"],
  },
  finance: {
    ai: ["data analysis", "reporting", "invoice processing", "excel/sheets work"],
    human: ["strategy", "stakeholder alignment"],
  },
  operations: {
    ai: ["scheduling", "reporting", "data entry", "excel/sheets work"],
    human: ["vendor management", "team management"],
  },
};

export function autoDetectSkills(jobTitle: string): { ai: string[]; human: string[] } {
  const lower = jobTitle.toLowerCase();
  for (const [keyword, skills] of Object.entries(AUTO_DETECT_MAP)) {
    if (lower.includes(keyword)) return skills;
  }
  return { ai: [], human: [] };
}

// ─── Risk score calculation (client-side, no API) ───────────────────────────────

const HIGH_RISK_KEYWORDS = [
  "content",
  "copywrite",
  "analyst",
  "accountant",
  "bookkeep",
  "admin",
  "support",
  "coordinator",
  "assistant",
  "data entry",
  "seo",
  "journalist",
  "paralegal",
  "recruiter",
  "marketing",
  "finance executive",
  "operations executive",
];
const MED_RISK_KEYWORDS = [
  "manager",
  "developer",
  "engineer",
  "designer",
  "product",
  "sales",
  "hr",
  "teacher",
  "consultant",
  "project",
  "writer",
  "researcher",
];
const LOW_RISK_KEYWORDS = [
  "doctor",
  "nurse",
  "therapist",
  "surgeon",
  "architect",
  "cto",
  "ceo",
  "director",
  "vp",
  "founder",
  "partner",
  "principal",
  "psychologist",
];

export function calculateRiskScore(jobTitle: string, aiSkills: string[], humanSkills: string[]): number {
  const lower = jobTitle.toLowerCase();

  let base = 50;
  if (LOW_RISK_KEYWORDS.some((k) => lower.includes(k))) base = 22;
  else if (HIGH_RISK_KEYWORDS.some((k) => lower.includes(k))) base = 72;
  else if (MED_RISK_KEYWORDS.some((k) => lower.includes(k))) base = 50;

  const total = aiSkills.length + humanSkills.length;
  if (total > 0) {
    const ratio = aiSkills.length / total;
    base = base * 0.45 + ratio * 100 * 0.55;
  }

  return Math.round(Math.min(95, Math.max(8, base)));
}

export function computeMetrics(monthlyCTC: number, riskScore: number) {
  const bossSavesMonthly = Math.max(0, monthlyCTC - AI_STACK_COST_INR);
  const multiplierNeeded = parseFloat((monthlyCTC / AI_STACK_COST_INR).toFixed(1));
  const aiCoversPercent = Math.round(riskScore * 0.7);
  return { bossSavesMonthly, multiplierNeeded, aiCoversPercent };
}

export function getRiskLevel(score: number): "high" | "medium" | "low" {
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

export function getVerdict(score: number, jobTitle: string, multiplier: number): string {
  if (score >= 65) {
    return `At ${score}%, your boss has likely already run this calculation. The math is ₹${multiplier}x and it's hard to argue with. You need to shift your value proposition before the next appraisal cycle — not next year, this month.`;
  }
  if (score >= 35) {
    return `At ${score}%, you're in the grey zone. Your human skills give you real leverage, but the automatable parts of your ${jobTitle.toLowerCase()} role are visible to anyone who looks. The window to reposition yourself is open — it won't stay open forever.`;
  }
  return `At ${score}%, you have a natural moat for now. But AI is advancing into your territory faster than most people in your position realise. Move first — weaponise AI yourself and capture the strategic roles before someone younger and cheaper does.`;
}

export function getRiskBadgeCopy(score: number): string {
  if (score >= 65) return "Act now — appraisal season is coming";
  if (score >= 35) return "In the grey zone — don't wait";
  return "Relatively safe — stay ahead";
}

// ─── Indian number formatting ───────────────────────────────────────────────────

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatINRCompact(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return formatINR(amount);
}

// ─── Sample data for development ───────────────────────────────────────────────

export const SAMPLE_DIAGNOSTIC_RESULT = {
  jobTitle: "Software Engineer",
  monthlyCTC: 200000,
  experienceBand: "6-10 yrs",
  aiSkills: ["writing content", "research", "reporting", "market research", "social media posting", "making presentations"],
  humanSkills: [],
  riskScore: 87,
  bossSavesMonthly: 194000,
  multiplierNeeded: 33.3,
  aiCoversPercent: 61,
  verdict:
    "At 87%, your boss has likely already run this calculation. The math is ₹33.3x and it's hard to argue with. You need to shift your value proposition before the next appraisal cycle — not next year, this month.",
};

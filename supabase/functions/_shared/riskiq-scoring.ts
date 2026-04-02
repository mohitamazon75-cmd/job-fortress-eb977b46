// ═══════════════════════════════════════════════════════════════
// RiskIQ 12-Dimensional Scoring Engine — TypeScript port
// Deterministic, explainable, ~10ms per profile
// ═══════════════════════════════════════════════════════════════

import { getKG, type RoleNode, type IndustryNode, type CityNode } from "./riskiq-knowledge-graph.ts";

export interface DimensionScore {
  name: string;
  score: number;
  weight: number;
  weighted_contribution: number;
  explanation: string;
}

export interface ThreatItem {
  name: string;
  severity: number;
  eta: string;
  detail: string;
  ai_tools: string[];
}

export interface StrengthItem {
  title: string;
  detail: string;
  durability: string;
}

export interface PivotRole {
  role: string;
  fit_score: number;
  why: string;
  salary_shift: string;
  risk_score_of_pivot: number;
  time_to_transition: string;
}

export interface SurvivalPhase {
  label: string;
  timeframe: string;
  actions: string[];
  focus_skills: string[];
}

export interface PeerComparison {
  percentile: number;
  city_rank: string;
  industry_rank: string;
  global_rank: string;
}

export interface ViralMetrics {
  doomsday_date: string;
  doomsday_days: number;
  survival_rating: string;
  industry_extinction_pct: number;
  last_human_standing_rank: number;
  share_headline: string;
}

export interface RiskReport {
  risk_score: number;
  risk_tier: string;
  accent_color: string;
  headline: string;
  summary: string;
  confidence: number;
  dimensions: DimensionScore[];
  timeline: Record<string, any>;
  threats: ThreatItem[];
  strengths: StrengthItem[];
  peer_comparison: PeerComparison;
  secret_weapon: string;
  survival_plan: SurvivalPhase[];
  pivot_roles: PivotRole[];
  viral: ViralMetrics;
  extracted_skills: string[];
  data_sources: string[];
}

export interface ProfileInput {
  role: string;
  industry: string;
  experience: string;
  city: string;
  education: string;
}

const DIMENSION_WEIGHTS: Record<string, number> = {
  "Task Automability Index": 0.20,
  "AI Tool Availability": 0.18,
  "Cognitive Routine Score": 0.12,
  "Social Intelligence Shield": -0.10,
  "Creative Originality Shield": -0.08,
  "Decision Authority Shield": -0.07,
  "Regulatory Moat": -0.05,
  "Industry Disruption Velocity": 0.10,
  "City Market Resilience": -0.04,
  "Experience Moat": -0.06,
  "Skill Portfolio": -0.05,
  "Education Barrier": -0.05,
};

const EXP_MAP: Record<string, number> = {
  "Less than 1 year": 0.5, "1–3 years": 2.0, "3–5 years": 4.0,
  "5–10 years": 7.5, "10–15 years": 12.5, "15+ years": 18.0,
};

const EDU_MAP: Record<string, number> = {
  "High School": 0, "Some College": 1, "Bachelor's Degree": 2,
  "Master's Degree": 3, "PhD": 4, "MBA": 3, "Bootcamp / Certification": 2,
};

const RISK_TIERS: [number, string, string][] = [
  [80, "Critical", "#dc2626"], [65, "High", "#ea580c"],
  [50, "Moderate", "#ca8a04"], [35, "Guarded", "#2563eb"],
  [0, "Low", "#16a34a"],
];

export function scoreProfile(profile: ProfileInput, skills: string[]): RiskReport {
  const kg = getKG();
  const role = kg.getRole(profile.role);
  const industry = kg.getIndustry(profile.industry);
  const city = kg.getCity(profile.city);
  const expYears = EXP_MAP[profile.experience] ?? 5.0;
  const eduLevel = EDU_MAP[profile.education] ?? 2;

  // 1. Compute 12 dimensions
  const dimensions = computeDimensions(kg, role, industry, city, expYears, eduLevel, skills);

  // 2. Aggregate
  const rawScore = dimensions.reduce((sum, d) => sum + d.weighted_contribution, 0);
  const normalized = (rawScore + 20) / 80 * 100;
  const sigmoid = 100 / (1 + Math.exp(-0.06 * (normalized - 50)));
  const riskScore = Math.max(5, Math.min(97, Math.round(sigmoid)));

  // 3. Classify
  let riskTier = "Low", accentColor = "#16a34a";
  for (const [threshold, tier, color] of RISK_TIERS) {
    if (riskScore >= threshold) { riskTier = tier; accentColor = color; break; }
  }

  // 4. Timeline
  const timeline = computeTimeline(role, industry, city);

  // 5. Threats
  const threats = buildThreats(kg, profile.role, role);

  // 6. Strengths
  const strengths = buildStrengths(role, skills, riskScore);

  // 7. Pivots
  const pivotRoles = buildPivots(kg, role, riskScore);

  // 8. Survival plan
  const survivalPlan = buildSurvivalPlan(riskScore, profile.role);

  // 9. Peer comparison
  const peerComparison = buildPeerComparison(riskScore, industry, city);

  // 10. Viral
  const viral = buildViralMetrics(riskScore, riskTier, profile.role, industry, timeline);

  // 11. Secret weapon
  const secretWeapon = computeSecretWeapon(role, skills, riskScore);

  // 12. Confidence
  const confidence = computeConfidence(role, industry, skills);

  return {
    risk_score: riskScore,
    risk_tier: riskTier,
    accent_color: accentColor,
    headline: "",
    summary: "",
    confidence,
    dimensions,
    timeline,
    threats,
    strengths,
    peer_comparison: peerComparison,
    secret_weapon: secretWeapon,
    survival_plan: survivalPlan,
    pivot_roles: pivotRoles,
    viral,
    extracted_skills: skills,
    data_sources: [
      "Oxford/Frey & Osborne Automation Study",
      "McKinsey Global Institute 2023",
      "O*NET Occupational Task Database",
      "WEF Future of Jobs Report 2023",
      "Stanford AI Index 2024",
      "BLS Employment Statistics",
      "RiskIQ Proprietary KG v2.4",
    ],
  };
}

function computeDimensions(
  kg: ReturnType<typeof getKG>, role: RoleNode | null, industry: IndustryNode | null,
  city: CityNode | null, expYears: number, eduLevel: number, skills: string[]
): DimensionScore[] {
  const rAuto = role?.task_automability ?? 0.60;
  const rCrs = role?.cognitive_routine_score ?? 65;
  const rSoc = role?.social_intelligence_req ?? 45;
  const rCre = role?.creative_originality_req ?? 40;
  const rDec = role?.decision_authority ?? 45;
  const rReg = role?.regulatory_shield ?? 25;
  const indVel = industry?.disruption_velocity ?? 0.65;
  const cityRes = city?.labor_market_resilience ?? 0.60;
  const cityMul = city?.ai_adoption_multiplier ?? 1.0;

  const dims: DimensionScore[] = [];

  // 1. Task Automability Index
  const tai = Math.min(100, rAuto * 100 * (0.8 + 0.4 * indVel));
  dims.push({ name: "Task Automability Index", score: Math.round(tai * 10) / 10, weight: 0.20, weighted_contribution: Math.round(tai * 0.20 * 100) / 100, explanation: `${Math.round(rAuto * 100)}% of your core tasks have documented AI substitutability` });

  // 2. AI Tool Availability
  const threats = role ? kg.getThreatsForRole(role.title) : [];
  const mainstream = threats.filter(t => t.deployment_maturity === "mainstream" || t.deployment_maturity === "maturing");
  const atas = Math.min(100, mainstream.length * 22 + (threats.length > 0 ? 30 : 0));
  dims.push({ name: "AI Tool Availability", score: Math.round(atas * 10) / 10, weight: 0.18, weighted_contribution: Math.round(atas * 0.18 * 100) / 100, explanation: `${threats.length} AI tools actively targeting your role (${mainstream.length} already mainstream)` });

  // 3. Cognitive Routine Score
  dims.push({ name: "Cognitive Routine Score", score: rCrs, weight: 0.12, weighted_contribution: Math.round(rCrs * 0.12 * 100) / 100, explanation: "Proportion of cognitive work following predictable patterns AI can learn" });

  // 4-7. Protective shields
  dims.push({ name: "Social Intelligence Shield", score: rSoc, weight: -0.10, weighted_contribution: Math.round(rSoc * -0.10 * 100) / 100, explanation: "Human relationship, empathy and trust requirements AI cannot replicate" });
  dims.push({ name: "Creative Originality Shield", score: rCre, weight: -0.08, weighted_contribution: Math.round(rCre * -0.08 * 100) / 100, explanation: "Novel output and original thinking — AI remixes, humans create" });
  dims.push({ name: "Decision Authority Shield", score: rDec, weight: -0.07, weighted_contribution: Math.round(rDec * -0.07 * 100) / 100, explanation: "Accountability, consequential judgment organizations keep human" });
  dims.push({ name: "Regulatory Moat", score: rReg, weight: -0.05, weighted_contribution: Math.round(rReg * -0.05 * 100) / 100, explanation: "Licensing, certification, regulatory requirements mandating human oversight" });

  // 8. Industry Disruption Velocity
  const idv = Math.min(100, indVel * 100 * (0.7 + 0.6 * Math.min(cityMul / 1.4, 1.0)));
  dims.push({ name: "Industry Disruption Velocity", score: Math.round(idv * 10) / 10, weight: 0.10, weighted_contribution: Math.round(idv * 0.10 * 100) / 100, explanation: `Your industry is displacing ${industry ? Math.round(industry.workforce_pct_at_risk_2030 * 100) : 55}% of roles by 2030` });

  // 9. City Market Resilience
  const cmr = cityRes * 100;
  dims.push({ name: "City Market Resilience", score: Math.round(cmr * 10) / 10, weight: -0.04, weighted_contribution: Math.round(cmr * -0.04 * 100) / 100, explanation: "Local labor market's capacity to absorb displaced workers" });

  // 10. Experience Moat
  const ems = experienceMoat(expYears);
  dims.push({ name: "Experience Moat", score: Math.round(ems * 10) / 10, weight: -0.06, weighted_contribution: Math.round(ems * -0.06 * 100) / 100, explanation: experienceExplanation(expYears) });

  // 11. Skill Portfolio
  const sps = skillPortfolioScore(kg, skills);
  dims.push({ name: "Skill Portfolio", score: Math.round(sps * 10) / 10, weight: -0.05, weighted_contribution: Math.round(sps * -0.05 * 100) / 100, explanation: skills.length > 0 ? `Analysed ${skills.length} skills — weighted by half-life and AI synergy` : "No profile data — add skills for better accuracy" });

  // 12. Education Barrier
  const ebs = Math.min(80, eduLevel * 16);
  dims.push({ name: "Education Barrier", score: ebs, weight: -0.05, weighted_contribution: Math.round(ebs * -0.05 * 100) / 100, explanation: "Credential requirements creating barriers to AI deployment" });

  return dims;
}

function experienceMoat(years: number): number {
  if (years < 1) return 15;
  if (years < 3) return 25 + years * 8;
  if (years < 7) return 45 + (years - 3) * 6;
  if (years < 15) return 69 + (years - 7) * 1.5;
  return Math.min(80, 81 - (years - 15) * 0.5);
}

function experienceExplanation(years: number): string {
  if (years < 2) return "Early-career: limited institutional knowledge moat — high substitutability";
  if (years < 5) return "Growing domain knowledge creates moderate protection";
  if (years < 10) return "Strong institutional knowledge, network, and judgment — harder to replace";
  if (years < 15) return "Deep expertise and organizational capital — significant human moat";
  return "Exceptional institutional depth — watch for skill staleness if not actively updating";
}

function skillPortfolioScore(kg: ReturnType<typeof getKG>, skills: string[]): number {
  if (!skills.length) return 30;
  let total = 0, matched = 0;
  for (const skill of skills.slice(0, 15)) {
    const node = kg.getSkillHalfLife(skill);
    if (node) {
      const hlScore = Math.min(80, node.half_life_years * 7);
      const synBonus = node.synergy_with_ai ? 15 : 0;
      const demandMod: Record<string, number> = { exploding: 1.3, growing: 1.1, stable: 1.0, declining: 0.8, obsolete: 0.5 };
      total += (hlScore + synBonus) * (demandMod[node.current_demand] ?? 1.0);
      matched++;
    }
  }
  return matched === 0 ? 35 : Math.min(85, total / matched);
}

function computeTimeline(role: RoleNode | null, industry: IndustryNode | null, city: CityNode | null) {
  const baseP = role?.partial_displacement_years ?? 2.0;
  const baseS = role?.significant_displacement_years ?? 4.0;
  const baseC = role?.critical_displacement_years ?? 7.0;
  const indMul = industry ? (industry.disruption_velocity * 1.5 + 0.5) : 1.0;
  const cityMul = city?.ai_adoption_multiplier ?? 1.0;
  const combined = indMul * 0.6 + cityMul * 0.4;
  const adj = (base: number) => Math.max(0.5, base / combined);
  const label = (y: number) => y < 2 ? `${Math.round(y * 12)} months` : y === Math.floor(y) ? `${y} years` : `${Math.floor(y)}–${Math.floor(y) + 1} years`;
  const toDate = (y: number) => {
    const d = new Date(); d.setDate(d.getDate() + Math.round(y * 365));
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };
  const pY = adj(baseP), sY = adj(baseS), cY = adj(baseC);
  return {
    partial: label(pY), significant: label(sY), critical: label(cY),
    partial_date: toDate(pY), significant_date: toDate(sY), critical_date: toDate(cY),
    partial_years: Math.round(pY * 10) / 10, significant_years: Math.round(sY * 10) / 10, critical_years: Math.round(cY * 10) / 10,
  };
}

function buildThreats(kg: ReturnType<typeof getKG>, roleTitle: string, role: RoleNode | null): ThreatItem[] {
  const kgThreats = kg.getThreatsForRole(roleTitle).sort((a, b) => b.severity_score - a.severity_score);
  const result: ThreatItem[] = kgThreats.slice(0, 5).map(t => ({
    name: t.name, severity: t.severity_score, eta: t.eta_mainstream,
    detail: `${t.vendor}'s ${t.name} can handle ${Math.round(t.replacement_pct * 100)}% of tasks — ${t.eta_mainstream === "now" ? "deployed at scale now" : `reaching scale in ${t.eta_mainstream}`}.`,
    ai_tools: [t.name],
  }));
  if (result.length < 3 && role) {
    if (role.cognitive_routine_score > 60) result.push({ name: "LLM-based workflow automation", severity: 7, eta: "1-2 years", detail: "General-purpose LLMs can handle most routine knowledge work in this role.", ai_tools: ["Claude", "GPT-5"] });
    if (role.task_automability > 0.5 && result.length < 3) result.push({ name: "AI agentic pipelines", severity: 6, eta: "2-3 years", detail: "Multi-agent AI systems automating end-to-end workflows.", ai_tools: ["AutoGPT", "CrewAI", "Devin"] });
  }
  return result.slice(0, 5);
}

function buildStrengths(role: RoleNode | null, skills: string[], riskScore: number): StrengthItem[] {
  const s: StrengthItem[] = [];
  if (role?.social_intelligence_req && role.social_intelligence_req > 60) s.push({ title: "High social intelligence requirement", detail: "Your role demands trust, empathy, and nuanced human relationships — the area AI consistently fails.", durability: "5-10 years" });
  if (role?.creative_originality_req && role.creative_originality_req > 60) s.push({ title: "Original thinking and creative judgment", detail: "AI remixes existing work — you create new categories.", durability: "5-10 years" });
  if (role?.decision_authority && role.decision_authority > 65) s.push({ title: "Consequential decision authority", detail: "Human judgment and accountability remain mandatory for legal and reputational reasons.", durability: "7-10 years" });
  if (role?.regulatory_shield && role.regulatory_shield > 65) s.push({ title: "Regulatory and licensing protection", detail: "Professional liability and compliance create structural barriers to AI deployment.", durability: "10+ years" });
  const aiSkills = skills.filter(sk => ["python", "ml", "ai", "llm", "rag", "data", "cloud", "analytics"].some(kw => sk.toLowerCase().includes(kw)));
  if (aiSkills.length > 0) s.push({ title: `AI-native skill profile (${aiSkills.slice(0, 2).join(", ")})`, detail: "Your technical skills compound in value as AI adoption grows.", durability: "3-5 years" });
  if (s.length === 0) s.push({ title: "Domain expertise and institutional context", detail: "Years of domain experience create context AI cannot acquire.", durability: "3-7 years" });
  return s.slice(0, 4);
}

function buildPivots(kg: ReturnType<typeof getKG>, role: RoleNode | null, riskScore: number): PivotRole[] {
  if (!role) return [];
  return kg.getPivotRoles(role).slice(0, 4).map(pivot => {
    const pivotRisk = Math.round(pivot.base_automation_prob * 100);
    const fit = Math.max(20, Math.min(95, 100 - pivotRisk + 10));
    const delta = pivot.salary_percentile - role.salary_percentile;
    return {
      role: pivot.title, fit_score: fit,
      why: `Your ${role.title} background gives you rare domain context — a combination that commands a premium.`,
      salary_shift: delta > 0 ? `+${delta}%` : `${delta}%`,
      risk_score_of_pivot: pivotRisk,
      time_to_transition: fit > 70 ? "6-12 months" : "12-24 months",
    };
  }).sort((a, b) => b.fit_score - a.fit_score);
}

function buildSurvivalPlan(riskScore: number, roleTitle: string): SurvivalPhase[] {
  const isHigh = riskScore >= 65;
  return [
    { label: "90-Day Sprint", timeframe: "Months 1–3", actions: isHigh ? [
      "Start the fast.ai Practical Deep Learning course — get hands-on AI experience immediately",
      "Identify the 3 most repetitive tasks in your job and build AI tools to automate them yourself",
      "Connect with 5 people in your target pivot role via LinkedIn — one coffee chat is worth 10 courses",
    ] : [
      "Audit your role: which 30% of tasks could AI do 80% as well? Eliminate or automate those first",
      "Learn one AI tool deeply in your domain — depth beats breadth right now",
      "Start documenting your 'institutional knowledge' — the context AI cannot learn from data alone",
    ], focus_skills: ["AI tool proficiency", "Domain + AI combination"] },
    { label: "6-Month Build", timeframe: "Months 4–6", actions: isHigh ? [
      "Complete a Kaggle competition or portfolio project demonstrating AI-augmented work",
      "Propose and lead an AI implementation project at your company — become the AI champion",
      "Develop a consulting side practice: domain expertise + AI tools = irreplaceable service",
    ] : [
      "Build internal reputation as your team's AI expert — run a lunch-and-learn, propose a pilot",
      "Add one AI-native skill (RAG, fine-tuning, prompt engineering) — each has a 3-5 year premium",
      "Make yourself indispensable to one senior stakeholder who makes hiring decisions",
    ], focus_skills: ["Portfolio building", "Internal positioning"] },
    { label: "12-Month Transform", timeframe: "Months 7–12", actions: isHigh ? [
      "Target your pivot role with a built portfolio: 3 projects, 2 case studies, 1 referral network",
      "Pursue a credential combining your domain with AI (e.g. CFA + AI finance specialization)",
      "Position yourself as an AI implementation lead — this role will exist for 10+ years",
    ] : [
      "Transition from 'does the work' to 'directs the AI that does the work'",
      "Target a role title uplift (Senior → Lead/Principal) — seniority proxies for judgment authority",
      "Build a public professional presence demonstrating your AI + domain combination",
    ], focus_skills: ["Role evolution", "AI leadership positioning"] },
  ];
}

function buildPeerComparison(riskScore: number, industry: IndustryNode | null, city: CityNode | null): PeerComparison {
  const peerPct = Math.max(5, Math.min(95, 100 - riskScore + 8));
  const indRisk = industry ? Math.round(industry.disruption_velocity * 100) : 55;
  const cityMul = city?.ai_adoption_multiplier ?? 1.0;
  return {
    percentile: peerPct,
    city_rank: cityMul > 1.3 ? "one of the highest AI adoption cities globally" : cityMul > 1.0 ? "an average AI adoption market" : "a slower AI adoption market",
    industry_rank: `Industry at ${indRisk}/100 disruption velocity — ${indRisk > 55 ? "above" : "below"} cross-sector average`,
    global_rank: `${Math.round(riskScore * 0.6)}% of knowledge workers face equivalent or higher risk`,
  };
}

function buildViralMetrics(riskScore: number, riskTier: string, roleTitle: string, industry: IndustryNode | null, timeline: Record<string, any>): ViralMetrics {
  const sigYears = timeline.significant_years ?? 4.0;
  const doomDate = new Date(); doomDate.setDate(doomDate.getDate() + Math.round(sigYears * 365));
  const doomDays = Math.round(sigYears * 365);
  const ratingMap: [number, string][] = [[85, "A+"], [75, "A"], [65, "B+"], [55, "B"], [45, "C"], [35, "D"], [0, "F"]];
  let survivalRating = "C";
  for (const [t, r] of ratingMap) { if ((100 - riskScore) >= t) { survivalRating = r; break; } }
  const extPct = industry ? Math.round(industry.workforce_pct_at_risk_2030 * 100) : 55;
  const headlines: Record<string, string> = {
    Critical: `A ${roleTitle} walks into an AI demo — and doesn't walk back out.`,
    High: `The clock is ticking for ${roleTitle}s. You have ${timeline.partial || "18 months"}.`,
    Moderate: `Half of ${roleTitle}s will be unrecognisable by 2027. Will you be the other half?`,
    Guarded: `You're safer than most — but complacency is the real threat for ${roleTitle}s.`,
    Low: `${roleTitle}s: the humans AI is making more powerful, not replacing.`,
  };
  return {
    doomsday_date: doomDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    doomsday_days: doomDays,
    survival_rating: survivalRating,
    industry_extinction_pct: extPct,
    last_human_standing_rank: Math.max(1, Math.round((100 - riskScore) / 10)),
    share_headline: headlines[riskTier] ?? `Your AI risk score is ${riskScore}/100.`,
  };
}

function computeSecretWeapon(role: RoleNode | null, skills: string[], riskScore: number): string {
  if (riskScore >= 70) return "Become the AI implementation lead in your team before anyone else claims it. Every company needs a 'human translator' between AI capabilities and business outcomes — it pays 40-60% more and requires zero additional credentials if you move fast.";
  if (role && role.social_intelligence_req > 70) return "Your social capital is your most durable asset. Become the person who aligns stakeholders around AI adoption — not as a tech person, but as the trusted human who makes the transition feel safe.";
  if (skills.some(s => s.toLowerCase().includes("python"))) return "You have Python — now learn production-grade AI pipelines. The gap between 'data person who uses AI' and 'person who builds AI systems' is 6-9 months of focused work and a 60-90% salary premium.";
  return "The most defensible position: understand both the domain and the AI tools deeply. Pick one AI capability (RAG, agents, fine-tuning) and become the acknowledged expert in your industry context. 6 months. Nobody else is doing it.";
}

function computeConfidence(role: RoleNode | null, industry: IndustryNode | null, skills: string[]): number {
  let score = 0.5;
  if (role) score += 0.2;
  if (industry) score += 0.15;
  score += Math.min(0.15, skills.length * 0.015);
  return Math.min(0.98, score);
}

/**
 * Card 1 (Risk Mirror) personalization engine.
 *
 * Pure, side-effect-free module extracted from Card1RiskMirror.tsx so the
 * component stays focused on rendering and so the headline/peer logic is
 * unit-testable in isolation. Behavior is byte-identical to the prior
 * inline implementation — see src/test/card1-personalization.test.ts and
 * src/test/card1-risk-helpers.test.ts for the regression net.
 *
 * Inputs come from the scan record (u = users/profile snapshot, c1 = Card1
 * LLM payload, score = numeric AI exposure score). Outputs are the strings
 * the component renders plus a `copyConfidence` flag used for analytics.
 */

export type Family =
  | "founder" | "exec" | "eng" | "data" | "design" | "pm"
  | "marketing" | "sales" | "ops" | "hr" | "finance" | "support" | "content"
  | "healthcare" | "legal" | "education" | "consulting"
  | "manufacturing" | "hospitality" | "creator" | "research"
  | "generic";

export type Band = "high" | "mid" | "low";
export type CopyConfidence = "high" | "medium" | "low";

const HIGH_CONF_FAMILIES: ReadonlyArray<Family> = [
  "founder", "exec", "eng", "data", "design", "pm",
  "marketing", "sales", "ops", "hr", "finance", "support", "content",
];
const MEDIUM_CONF_FAMILIES: ReadonlyArray<Family> = [
  "healthcare", "legal", "education", "consulting",
  "manufacturing", "hospitality", "creator", "research",
];

/**
 * Role-family classifier. Order matters: founder/exec before generic
 * "manager"; specific verticals before tech keywords. Hindi/Hinglish
 * keywords route to the same families (copy stays English; routing is
 * what matters here).
 */
export function detectFamily(titleLower: string): Family {
  const t = titleLower;
  if (/founder|ceo|coo|cto|cmo|cfo|chief|managing director|md\b|owner|प्रबंध निदेशक|संस्थापक/.test(t)) return "founder";
  if (/\bvp\b|vice president|head of|director|gm\b|general manager|निदेशक|प्रमुख/.test(t)) return "exec";
  if (/doctor|nurse|surgeon|physician|dentist|pharmac|healthcare|medical|clinical|hospital|डॉक्टर|नर्स|चिकित्सक/.test(t)) return "healthcare";
  if (/lawyer|attorney|advocate|legal counsel|paralegal|वकील|अधिवक्ता/.test(t)) return "legal";
  if (/teacher|professor|lecturer|educator|tutor|principal|शिक्षक|प्राध्यापक|अध्यापक/.test(t)) return "education";
  if (/consultant|advisory|strategy consultant|management consult|सलाहकार/.test(t)) return "consulting";
  if (/manufactur|production engineer|plant manager|factory|industrial|उत्पादन/.test(t)) return "manufacturing";
  if (/hotel|chef|restaurant|hospitality|f&b|housekeeping|आतिथ्य|शेफ/.test(t)) return "hospitality";
  if (/creator|influencer|youtuber|streamer|podcast/.test(t)) return "creator";
  if (/researcher|scientist|phd|postdoc|शोधकर्ता|वैज्ञानिक/.test(t)) return "research";
  if (/engineer|developer|sde|programmer|architect|devops|sre|backend|frontend|fullstack|full[- ]stack|mobile|android|ios|qa|tester|डेवलपर|इंजीनियर|प्रोग्रामर/.test(t)) return "eng";
  if (/data scien|analyst|ml |machine learning|ai engineer|bi |business intel|statistic|डेटा|विश्लेषक/.test(t)) return "data";
  if (/design|ux|ui |creative|illustrator|art director|डिज़ाइनर|डिजाइनर/.test(t)) return "design";
  if (/product manager|product owner|\bpm\b|product lead|उत्पाद प्रबंधक/.test(t)) return "pm";
  if (/market|growth|brand|seo|sem|copywrit|social media|community|मार्केटिंग|विपणन|ब्रांड/.test(t)) return "marketing";
  if (/sales|account exec|business development|\bbd\b|partnerships|revenue|बिक्री|विक्रय/.test(t)) return "sales";
  if (/operations|ops |supply chain|logistics|procurement|admin|प्रचालन|संचालन|लॉजिस्टिक्स/.test(t)) return "ops";
  if (/\bhr\b|human resour|talent|recruit|people ops|l&d|मानव संसाधन|भर्ती/.test(t)) return "hr";
  if (/finance|accountant|controller|treasur|audit|tax|वित्त|लेखाकार/.test(t)) return "finance";
  if (/support|customer success|\bcs\b|cx |service desk|सहायता|ग्राहक सेवा/.test(t)) return "support";
  if (/writer|editor|journalist|content|लेखक|संपादक|पत्रकार/.test(t)) return "content";
  return "generic";
}

/**
 * Sector tie-breaker: when title resolves to "generic" but industry is a
 * specific high-signal vertical, pivot family to match the sector. Saves
 * users with vague titles ("Manager", "Officer", "Associate") in strong
 * verticals from falling into generic boilerplate.
 */
export function applySectorTieBreaker(family: Family, sector: string): Family {
  if (family !== "generic" || !sector) return family;
  const s = sector.toLowerCase();
  if (/health|hospital|pharma|medical|clinical/.test(s)) return "healthcare";
  if (/legal|law/.test(s)) return "legal";
  if (/education|edtech|teaching|university/.test(s)) return "education";
  if (/consult|advisory/.test(s)) return "consulting";
  if (/manufactur|industrial|automotive/.test(s)) return "manufacturing";
  if (/hospitality|hotel|restaurant|f&b|tourism/.test(s)) return "hospitality";
  if (/research|r&d/.test(s)) return "research";
  if (/finance|banking|insurance|fintech/.test(s)) return "finance";
  if (/saas|software|tech|it services|product/.test(s)) return "eng";
  if (/marketing|adver|media/.test(s)) return "marketing";
  return "generic";
}

/**
 * Tenure phrasing — covers 0, decimals, missing, and very-senior cases
 * without ever printing "0 years" or "NaN years".
 */
export function buildTenurePhrase(yrsRaw: unknown, sector: string): {
  tenurePhrase: string;
  hasYears: boolean;
  isFresher: boolean;
} {
  const yrsNum = typeof yrsRaw === "number"
    ? yrsRaw
    : (typeof yrsRaw === "string" ? parseFloat(yrsRaw) : NaN);
  const hasYears = Number.isFinite(yrsNum) && yrsNum >= 1;
  const isFresher = Number.isFinite(yrsNum) && yrsNum < 1;
  const yrsInt = hasYears ? Math.round(yrsNum) : 0;
  const field = sector || "your field";
  const tenurePhrase = hasYears
    ? (yrsInt >= 15 ? `${yrsInt} years deep into ${field}`
      : yrsInt >= 8 ? `${yrsInt} years into ${field}`
      : `${yrsInt} ${yrsInt === 1 ? "year" : "years"} into ${field}`)
    : `Your work in ${field}`;
  return { tenurePhrase, hasYears, isFresher };
}

/** True when the LLM headline is already specific (tool/SaaS/stat). */
export function isSpecificHeadline(llmHeadline: string): boolean {
  return llmHeadline.length >= 28 && (
    /[A-Z][a-z]+(?:GPT|AI|GenAI|LLM)/.test(llmHeadline) ||
    /\b(HubSpot|Salesforce|Jasper|Copilot|Cursor|ChatGPT|Claude|Gemini|Notion|Figma|Midjourney|Canva|Loom|Zapier|Make)\b/i.test(llmHeadline) ||
    /\b\d+%/.test(llmHeadline)
  );
}

/** True when LLM headline is missing/boilerplate and should be overridden. */
export function isWeakHeadline(llmHeadline: string): boolean {
  if (!llmHeadline) return true;
  if (/being automated today\.?$/i.test(llmHeadline)) return true;
  if (/your (execution|tactical|operational) layer/i.test(llmHeadline)) return true;
  if (/^(your role|risk mirror)/i.test(llmHeadline)) return true;
  if (llmHeadline.length < 30 && !isSpecificHeadline(llmHeadline)) return true;
  return false;
}

export function bandFromScore(score: number): Band {
  return score >= 70 ? "high" : score >= 40 ? "mid" : "low";
}

export function copyConfidenceFor(family: Family, isFresher: boolean): CopyConfidence {
  if (isFresher || family === "generic") return "low";
  if (HIGH_CONF_FAMILIES.includes(family)) return "high";
  if (MEDIUM_CONF_FAMILIES.includes(family)) return "medium";
  return "low";
}

// ─────────────────────────────────────────────────────────────────────────
// Copy tables. Pure data — kept in this module so adding/editing copy never
// requires touching the React component.
// ─────────────────────────────────────────────────────────────────────────

const FAMILY_VERB: Record<Family, string> = {
  founder: "the operating cadence — board updates, hiring loops, investor narratives",
  exec: "the synthesis layer — dashboards, status decks, cross-team rollups",
  eng: "the typing — boilerplate, scaffolding, test stubs, first-draft PRs",
  data: "the SQL middle — pipeline glue, dashboard refreshes, ad-hoc queries",
  design: "the production layer — variants, mockups, asset resizing, first comps",
  pm: "the documentation muscle — PRDs, user stories, release notes, backlog grooming",
  marketing: "the campaign machinery — copy variants, audience segmentation, attribution stitching",
  sales: "the top-of-funnel — prospecting lists, first-touch sequences, call summaries",
  ops: "the coordination tax — vendor follow-ups, status reports, SOP drafting",
  hr: "the screening layer — JD writing, resume sifting, first-round chats, scheduling",
  finance: "the close cycle — variance analysis, reconciliations, forecast first drafts",
  support: "the tier-1 layer — ticket triage, FAQ replies, status pings",
  content: "the first draft — outlines, briefs, SEO scaffolding, distribution copy",
  healthcare: "the documentation layer — clinical notes, billing codes, prior-auth letters",
  legal: "the discovery and drafting layer — contract review, citation pulls, first-pass memos",
  education: "the lesson-prep layer — quiz generation, lesson plans, first-pass grading",
  consulting: "the deck-and-deliverable factory — slide builds, market scans, first-cut models",
  manufacturing: "the planning layer — production schedules, quality reports, predictive maintenance triage",
  hospitality: "the front-desk layer — reservations, FAQ replies, itinerary drafting",
  creator: "the production layer — thumbnails, scripts, first-cut edits, captioning",
  research: "the literature-review layer — paper summaries, citation graphs, hypothesis scaffolding",
  generic: "the execution layer — the daily output your role is measured on",
};

const HIGH_HEADLINES: Record<Family, (titleClean: string) => string> = {
  founder: () => `The operator job inside your founder role just got cheaper to run.`,
  exec: () => `The work that earned you the title is no longer the work that defends it.`,
  eng: (t) => `Most of what made you a fast ${t} is now a feature in someone's IDE.`,
  data: () => `Your SQL fluency used to be a moat. It's now a free-tier feature.`,
  design: (t) => `The market is paying less for ${t}s and more for taste.`,
  pm: () => `The documentation reps that built your judgment are now a ⌘+K away.`,
  marketing: (t) => `The job market doesn't need a ${t} the way it did 18 months ago.`,
  sales: () => `Your top-of-funnel is now someone else's API call.`,
  ops: () => `The coordination work you were hired for is being absorbed by agents.`,
  hr: () => `Your screening reps — the thing only experience could teach — just became a prompt.`,
  finance: () => `Your spreadsheet fluency is being commoditised one Copilot release at a time.`,
  support: () => `Your tier-1 queue is shrinking faster than headcount can adjust.`,
  content: () => `The first-draft economy you trained for is now $20/month of tokens.`,
  healthcare: () => `Your clinical work is safe. The paperwork around it is being absorbed by AI scribes.`,
  legal: () => `The billable hours you charged for first-pass research are being eaten by AI.`,
  education: () => `Your teaching is safe. The lesson-prep, grading, and admin around it isn't.`,
  consulting: () => `The deck-and-deliverable factory that justified your day rate is being commoditised.`,
  manufacturing: () => `Your operational judgment is safe. The planning and reporting layer underneath it isn't.`,
  hospitality: () => `Front-desk and concierge tasks you trained for are being absorbed by AI agents.`,
  creator: () => `The production grind that built your channel is now $20/month of tokens.`,
  research: () => `The literature-review and synthesis half of your research is being eaten by AI.`,
  generic: (t) => `The job market doesn't need a ${t} the way it did 18 months ago.`,
};

const MID_HEADLINES: Record<Family, string> = {
  founder: `You're not being replaced. The execution underneath you is.`,
  exec: `Your title is safe. The work that justifies it is shifting.`,
  eng: `You're not being replaced. You're being unbundled into commits + prompts.`,
  data: `You're not being replaced. The "pull this number" half of your job is.`,
  design: `You're not being replaced. The pixels under your direction are.`,
  pm: `You're not being replaced. The artefacts you produce are getting cheaper to make.`,
  marketing: `You're not being replaced. You're being unbundled.`,
  sales: `You're not being replaced. Your sequence builder is.`,
  ops: `You're not being replaced. The follow-ups and SOPs are.`,
  hr: `You're not being replaced. The first-round and first-pass work is.`,
  finance: `You're not being replaced. The reconciliation and first-draft forecasts are.`,
  support: `You're not being replaced. Tier-1 is.`,
  content: `You're not being replaced. The first draft is.`,
  healthcare: `You're not being replaced. The documentation under your care is.`,
  legal: `You're not being replaced. Discovery, drafting, and citation work is.`,
  education: `You're not being replaced. The lesson-prep and first-pass grading is.`,
  consulting: `You're not being replaced. The slide-and-model factory under you is.`,
  manufacturing: `You're not being replaced. The planning and quality-reporting layer is.`,
  hospitality: `You're not being replaced. The front-desk and reservation work is.`,
  creator: `You're not being replaced. The thumbnails, scripts, and first-cut edits are.`,
  research: `You're not being replaced. The lit-review and citation work is.`,
  generic: `You're not being replaced. You're being unbundled.`,
};

const LOW_HEADLINES: Record<Family, string> = {
  founder: `You're in AI's blind spot — for now. Distribution and judgment still rule.`,
  exec: `Your seat is in AI's blind spot — judgment, politics, accountability still belong to humans.`,
  eng: `Your stack is in AI's blind spot — systems thinking still beats autocomplete.`,
  data: `Your work is in AI's blind spot — framing the question is still a human game.`,
  design: `Your work is in AI's blind spot — taste still doesn't ship via API.`,
  pm: `Your work is in AI's blind spot — saying no is still a human sport.`,
  marketing: `Your work is in AI's blind spot — distribution and narrative still need a human.`,
  sales: `Your work is in AI's blind spot — closing complex deals still needs a face.`,
  ops: `Your work is in AI's blind spot — relationships move atoms, not bits.`,
  hr: `Your work is in AI's blind spot — culture and judgment don't fit in a prompt.`,
  finance: `Your work is in AI's blind spot — controls, ethics, and signatures still need a human.`,
  support: `Your work is in AI's blind spot — escalations still need empathy.`,
  content: `Your work is in AI's blind spot — point of view still doesn't auto-generate.`,
  healthcare: `Your work is in AI's blind spot — diagnosis, touch, and trust still need a human.`,
  legal: `Your work is in AI's blind spot — judgment, advocacy, and accountability still need a human.`,
  education: `Your work is in AI's blind spot — mentorship and classroom presence still need a human.`,
  consulting: `Your work is in AI's blind spot — client relationships and judgment still don't ship via API.`,
  manufacturing: `Your work is in AI's blind spot — physical operations and crisis judgment still need a human.`,
  hospitality: `Your work is in AI's blind spot — hospitality is a contact sport, not a prompt.`,
  creator: `Your work is in AI's blind spot — original POV and audience trust still don't auto-generate.`,
  research: `Your work is in AI's blind spot — original questions and peer credibility still need a human.`,
  generic: `For now, AI works for you — not instead of you.`,
};

const FAMILY_PEER_DETAIL: Record<Family, { high: string; mid: string; low: string }> = {
  founder: {
    high: "Operator-heavy founder roles are seeing the steepest cost-to-build compression — early-stage teams now ship with 40% smaller ops headcount.",
    mid: "Founder-operator seats are being redesigned: investors expect 2x output per hire by FY26 (NASSCOM Tech Industry Report).",
    low: "Vision and distribution roles remain durable — the moat is taste + capital allocation, not execution speed.",
  },
  exec: {
    high: "Director-and-above roles in your band are losing 35–50% of synthesis work to AI dashboards by FY26.",
    mid: "Mid-tier leadership is the squeeze zone — comp growth lags inflation by 4–7%/yr while juniors deliver more with AI.",
    low: "Senior judgment roles remain durable — but lateral mobility shrinks every cycle. Re-audit every 6 months.",
  },
  eng: {
    high: "Engineering roles in this band lose 45–60% of routine coding to Copilot/Cursor within 24 months (Stack Overflow 2024 + GitHub data).",
    mid: "Engineers here keep their seat but pricing power compresses — junior-to-mid comp gaps shrink ~12%/yr.",
    low: "Architecture and systems-design roles stay durable — the moat is integration thinking, not typing speed.",
  },
  data: {
    high: "Analyst and BI roles in this band see 50%+ of dashboard work absorbed by NL-to-SQL tools by FY26.",
    mid: "Mid-band data roles keep their seat but lose pricing power as self-service BI matures.",
    low: "Modeling, experiment design, and causal inference work remains durable for now.",
  },
  design: {
    high: "Production-design roles are seeing 40–55% task absorption by Figma AI + Midjourney/Canva (DesignOps Report 2024).",
    mid: "Mid-band design seats are being repriced for taste, not throughput — portfolio quality matters more than years.",
    low: "Brand, art direction, and design strategy remain durable — taste is the moat.",
  },
  pm: {
    high: "PM roles weighted toward documentation are losing 40%+ of writing to AI within 18 months.",
    mid: "Mid-band PM roles split: doc-heavy seats compress, judgment/strategy seats hold value.",
    low: "Strategy-heavy PM roles remain durable — saying no and shaping bets still needs a human.",
  },
  marketing: {
    high: "Roles in this band lose 40–60% of campaign-execution work to GenAI tools (HubSpot State of Marketing 2024).",
    mid: "Mid-band marketing roles squeeze hardest — comp growth lags 5–8%/yr while AI-native juniors close the gap.",
    low: "Brand, narrative, and distribution strategy remain durable — taste and judgment still don't ship via API.",
  },
  sales: {
    high: "SDR/BDR-style roles see 50%+ of prospecting absorbed by AI agents (Outreach + Apollo data).",
    mid: "Mid-band sales seats are being redesigned — quota/headcount ratios up ~25% by FY26.",
    low: "Complex enterprise/strategic deal roles remain durable — relationships and timing still need a human.",
  },
  ops: {
    high: "Ops roles lose 45%+ of coordination work to agents within 24 months (McKinsey Operations 2024).",
    mid: "Mid-band ops seats keep the title but absorb 1.5–2x scope per head.",
    low: "Strategic ops + supplier-relationship roles remain durable — atoms still need humans.",
  },
  hr: {
    high: "Recruiting and screening roles see 50%+ task absorption by AI sourcing/assessment tools.",
    mid: "Mid-band HR seats keep the title but lose pricing power to HRIS automation + AI screening.",
    low: "L&D, culture, and exec-coaching roles remain durable — judgment and trust still don't scale via API.",
  },
  finance: {
    high: "Roles in this band see 40–55% of close-cycle and reconciliation work absorbed by Copilot for Finance.",
    mid: "Mid-band finance roles keep their seat but absorb broader scope per head.",
    low: "Controls, audit, and ethics-bearing roles remain durable — signatures and accountability still belong to humans.",
  },
  support: {
    high: "Tier-1 support roles are losing 60%+ of ticket volume to AI agents within 18 months (Zendesk CX Trends 2024).",
    mid: "Mid-band support seats shift to escalations and quality — headcount-to-volume ratios drop ~30%.",
    low: "Customer success + complex-account roles remain durable — empathy and ownership still scale poorly via bot.",
  },
  content: {
    high: "First-draft content roles are seeing 50–70% task absorption by GenAI (Content Marketing Institute 2024).",
    mid: "Mid-band content seats squeeze hardest — distribution and POV become the moat, not output volume.",
    low: "Editorial judgment, original reporting, and brand voice remain durable — POV doesn't auto-generate.",
  },
  healthcare: {
    high: "Clinical-documentation work is the steepest-falling layer — AMA scribe-AI pilots show 60%+ note-time reduction. Direct care remains a human role.",
    mid: "Mid-band clinical roles keep their seat but absorb broader admin scope as scribes and prior-auth bots roll out.",
    low: "Direct-care, diagnosis, and bedside roles remain durable — touch and trust don't transfer to API.",
  },
  legal: {
    high: "Discovery, contract review, and first-pass research are the steepest-falling layers — Big Law pilots show 40–60% time reduction (ABA Tech Survey 2024).",
    mid: "Mid-band legal roles keep their seat but lose billable hours on routine drafting and research.",
    low: "Advocacy, judgment-bearing counsel, and accountability roles remain durable — signatures still belong to humans.",
  },
  education: {
    high: "Lesson-prep, quiz generation, and first-pass grading are seeing rapid AI adoption — directional NCES + EdTech survey signal.",
    mid: "Mid-band teaching roles shift weight from prep/grading to mentorship and classroom engagement.",
    low: "Mentorship, classroom presence, and pastoral roles remain durable — relationships don't scale via prompt.",
  },
  consulting: {
    high: "The deck-and-model factory is being commoditised — McKinsey, BCG, Bain all running internal LLM-deck tools at scale.",
    mid: "Mid-band consulting seats keep the title but absorb 1.5–2x scope per head as deliverable cost falls.",
    low: "Senior partner / relationship roles remain durable — client trust and judgment are the moat, not slide volume.",
  },
  manufacturing: {
    high: "Planning, quality reporting, and predictive-maintenance triage are the steepest-falling layers — Industry 4.0 + WEF 2024 signal.",
    mid: "Mid-band ops roles keep their seat but absorb broader scope as planning and reporting compress.",
    low: "Crisis judgment, supplier relationships, and physical-floor leadership remain durable — atoms still need humans.",
  },
  hospitality: {
    high: "Front-desk, reservations, and concierge tasks are seeing rapid AI-agent adoption — directional Skift/Hotel Tech 2024 signal.",
    mid: "Mid-band hospitality seats shift weight from front-of-house tasks to guest-experience judgment and complex problem-solving.",
    low: "In-person hospitality, F&B leadership, and crisis recovery remain durable — service is a contact sport.",
  },
  creator: {
    high: "Production work — thumbnails, scripts, first-cut edits, captioning — is now commodity. Distribution + POV are the moat.",
    mid: "Mid-band creators feel the squeeze hardest — output volume rises but per-view economics fall as AI-assisted competition grows.",
    low: "Original POV, audience trust, and IP ownership remain durable — these don't auto-generate.",
  },
  research: {
    high: "Literature review, citation graphs, and synthesis work are the steepest-falling layers — Elicit/Consensus/SciSpace adoption rising fast.",
    mid: "Mid-band researchers keep their seat but absorb broader scope as lit-review and synthesis time compresses.",
    low: "Original questions, peer credibility, and lab-running roles remain durable — these don't transfer to API.",
  },
  generic: {
    high: "Roles in your band are losing 40–60% of routine task volume to AI assistants within 24 months (O*NET 2024 distribution).",
    mid: "Roles here keep their seat but lose pricing power: comp growth lags inflation by 4–7%/yr while juniors deliver more with AI.",
    low: "AI augments rather than replaces here, but the moat shrinks each model release. Re-audit every 6 months.",
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

export interface PersonalizeInput {
  llmHeadline: string;
  llmSubline: string;
  titleClean: string;
  sector: string;
  yrsRaw: unknown;
  score: number;
  hasValidScore: boolean;
  /** c1.india_average — when null, we derive a band-grounded peer comparator. */
  indiaAverageMissing: boolean;
}

export interface PersonalizeResult {
  family: Family;
  band: Band;
  isFresher: boolean;
  tenurePhrase: string;
  isWeak: boolean;
  isSpecific: boolean;
  copyConfidence: CopyConfidence;
  displayHeadline: string;
  displaySubline: string;
  peerFallback: { label: string; detail: string } | null;
}

/**
 * One pure function the component calls. Produces all the strings Card1
 * renders + the metadata used by the analytics effect.
 */
export function personalizeCard1(input: PersonalizeInput): PersonalizeResult {
  const { llmHeadline, llmSubline, titleClean, sector, yrsRaw, score, hasValidScore, indiaAverageMissing } = input;

  const titleLower = titleClean.toLowerCase();
  let family = detectFamily(titleLower);
  family = applySectorTieBreaker(family, sector);

  const { tenurePhrase, isFresher } = buildTenurePhrase(yrsRaw, sector);
  const band = bandFromScore(score);

  const isSpecific = isSpecificHeadline(llmHeadline);
  const isWeak = isWeakHeadline(llmHeadline);

  let displayHeadline = llmHeadline || "Your role is in AI's path.";
  let displaySubline = llmSubline;

  if (isWeak && hasValidScore) {
    const replacing = FAMILY_VERB[family];

    if (isFresher) {
      if (band === "high") {
        displayHeadline = `You're walking into a market that's repricing entry-level work in real time.`;
        displaySubline = `The ${titleClean} roles you're applying to no longer hire for the work you'd have done in year one — AI is doing it. Your edge has to be the work it can't.`;
      } else if (band === "mid") {
        displayHeadline = `You're entering ${sector || "this field"} during its biggest re-pricing cycle in a decade.`;
        displaySubline = `Junior roles for ${titleClean}s are getting fewer and meaner. The ones that hire are looking for AI fluency, not just credentials.`;
      } else {
        displayHeadline = `You're starting in a corner of the market AI hasn't reached yet.`;
        displaySubline = `That's a real advantage — but it's a 2–3 year window, not a career. Use it to build the moat that AI can't copy.`;
      }
    } else if (band === "high") {
      displayHeadline = HIGH_HEADLINES[family](titleClean);
      displaySubline = `${tenurePhrase} taught you ${replacing}. AI now runs that layer faster, cheaper, and at 2 a.m. — the seat is still warm, but the chair is being redesigned around you.`;
    } else if (band === "mid") {
      displayHeadline = MID_HEADLINES[family];
      displaySubline = `${tenurePhrase} built real judgment. AI is quietly absorbing ${replacing} — and the market is repricing your seat to match.`;
    } else {
      displayHeadline = LOW_HEADLINES[family];
      displaySubline = `${tenurePhrase} built the kind of judgment models still can't fake. That moat is real — it's also rented, not owned, and re-earned every model release.`;
    }
  }

  let peerFallback: { label: string; detail: string } | null = null;
  if (indiaAverageMissing && hasValidScore) {
    const detail = FAMILY_PEER_DETAIL[family];
    if (band === "high") {
      peerFallback = {
        label: `Top quartile of automation exposure · ${sector || "cross-sector"} band`,
        detail: detail.high,
      };
    } else if (band === "mid") {
      peerFallback = {
        label: `Mid-band — the squeeze zone${sector ? ` · ${sector}` : ""}`,
        detail: detail.mid,
      };
    } else {
      peerFallback = {
        label: `Lower quartile — judgment-weighted role${sector ? ` · ${sector}` : ""}`,
        detail: detail.low,
      };
    }
  }

  return {
    family,
    band,
    isFresher,
    tenurePhrase,
    isWeak,
    isSpecific,
    copyConfidence: copyConfidenceFor(family, isFresher),
    displayHeadline,
    displaySubline,
    peerFallback,
  };
}

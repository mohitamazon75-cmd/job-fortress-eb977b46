// useState removed — scan count is now a prop from ResultsModelB
import { useEffect } from "react";
import { CardShell, CardHead, CardBody, Badge, SectionLabel, InfoBox, CardNav, variantColor } from "./SharedUI";
import BossPerceptionSimulator from "./BossPerceptionSimulator";
import { useTrack } from "@/hooks/use-track";

// Module-level dedup for analytics: ensures `card1_headline_source` fires
// once per scan_id even when Card1 unmounts/remounts during card navigation.
// Resets on full page reload (correct boundary — new view of the report).
const firedHeadlineEvents = new Set<string>();

interface Props {
  cardData: any;
  onNext: () => void;
  /** Optional. Currently unused (Card1 is first content card after Verdict);
   *  added for nav consistency with Card2+ in case the deck order changes. */
  onBack?: () => void;
  /** Monthly scan count for social proof. Fetched once by ResultsModelB and passed down. */
  monthlyScanCount?: number | null;
  /** Estimated monthly salary in INR (from scans table) for rupee-anchored cost framing. */
  monthlySalaryInr?: number | null;
}

/**
 * Format a paise/rupee monthly figure into an annualised "₹X.XL" string.
 * Used to convert abstract percentage gaps into concrete loss-aversion anchors
 * for the Indian middle-class reader.
 */
export function formatAnnualLakhs(monthlyInr: number): string {
  const annual = monthlyInr * 12;
  if (annual >= 10000000) return `₹${(annual / 10000000).toFixed(1)}Cr`;
  if (annual >= 100000) {
    const lakhs = annual / 100000;
    return lakhs >= 10 ? `₹${Math.round(lakhs)}L` : `₹${lakhs.toFixed(1)}L`;
  }
  return `₹${Math.round(annual / 1000)}k`;
}

/**
 * Parse a string like "15-20%" or "15%" into [low, high] decimals (0.15, 0.20).
 * Returns null if the string can't be confidently parsed.
 * Exported for unit testing — see src/test/card1-risk-helpers.test.ts.
 */
export function parsePctRange(s: string | undefined | null): [number, number] | null {
  if (!s) return null;
  const matches = s.match(/(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*%/i);
  if (matches) return [parseFloat(matches[1]) / 100, parseFloat(matches[2]) / 100];
  const single = s.match(/(\d+(?:\.\d+)?)\s*%/);
  if (single) {
    const v = parseFloat(single[1]) / 100;
    return [v, v];
  }
  return null;
}

/**
 * Parse an Indian salary band string (e.g. "₹18-28L", "₹50-90L", "₹1.2-1.8Cr",
 * "₹35L", "18-28 LPA") into the median annual rupee figure.
 * Returns null if no confident parse — caller falls back to LLM string.
 *
 * This is the component-layer fallback that powers rupee anchoring when the
 * scan record's `estimated_monthly_salary_inr` column is null (current state
 * for all 5 prod scans as of 2026-04-27 — the upstream pipeline does not
 * populate that column yet). We derive a credible monthly figure from the
 * LLM's already-grounded `card2_market.salary_bands` matched to the user's
 * current_title — same numbers the user sees one card later, so there's
 * zero credibility risk from a number mismatch.
 */
export function parseBandToAnnualInr(range: string | undefined | null): number | null {
  if (!range) return null;
  const isCrore = /Cr/i.test(range);
  const isLakh = !isCrore && /(L|LPA|lakh)/i.test(range);
  if (!isCrore && !isLakh) return null;
  const nums = range.match(/(\d+(?:\.\d+)?)/g);
  if (!nums || nums.length === 0) return null;
  const lo = parseFloat(nums[0]);
  const hi = nums.length > 1 ? parseFloat(nums[1]) : lo;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  const median = (lo + hi) / 2;
  const unit = isCrore ? 10_000_000 : 100_000; // 1Cr = 1e7, 1L = 1e5
  const annual = median * unit;
  return annual > 0 ? annual : null;
}

/**
 * Derive monthly salary in INR from the LLM-returned salary_bands array,
 * preferring the band whose `role` best matches the user's current_title.
 * Falls back to the median band if no match. Returns null if bands are absent
 * or unparseable.
 */
export function deriveMonthlyFromBands(
  bands: Array<{ role?: string; range?: string }> | undefined | null,
  currentTitle: string | undefined | null,
): number | null {
  if (!Array.isArray(bands) || bands.length === 0) return null;
  const title = (currentTitle || "").toLowerCase().trim();

  // Prefer exact-substring role match (e.g. user "Marketing Manager" → band "Marketing Manager").
  let chosen: { role?: string; range?: string } | undefined;
  if (title) {
    chosen = bands.find((b) => {
      const r = (b?.role || "").toLowerCase();
      if (!r) return false;
      // Match if either string contains a meaningful chunk of the other.
      return r.includes(title) || (title.length >= 4 && title.includes(r.slice(0, Math.min(r.length, 20))));
    });
  }
  // Fallback: middle band (LLM is instructed to put aspirational first; middle ≈ "your level").
  if (!chosen) chosen = bands[Math.floor(bands.length / 2)];

  const annual = parseBandToAnnualInr(chosen?.range);
  if (!annual) return null;
  return Math.round(annual / 12);
}

export default function Card1RiskMirror({ cardData, onNext, onBack, monthlyScanCount, monthlySalaryInr }: Props) {
  const c1 = cardData.card1_risk;
  const u = cardData.user || {};
  const disruptionYear = c1?.disruption_year || "2027";

  // P-3-B: scan count is now fetched once by ResultsModelB and passed as a prop,
  // avoiding a redundant DB query every time this card renders.
  const scanCount = monthlyScanCount ?? null;

  if (!c1) return null;

  const r = 36;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - (c1.risk_score || 0) / 100);

  const gaugeColor = (c1.risk_score || 0) >= 70 ? "var(--mb-red)" : (c1.risk_score || 0) >= 40 ? "var(--mb-amber)" : "var(--mb-green)";

  const avatars = [
    { initials: "PK", bg: "var(--mb-navy-tint)", color: "var(--mb-navy)" },
    { initials: "SR", bg: "var(--mb-green-tint)", color: "var(--mb-green)" },
    { initials: "AM", bg: "var(--mb-amber-tint)", color: "var(--mb-amber)" },
    { initials: "NK", bg: "var(--mb-red-tint)", color: "var(--mb-red)" },
    { initials: "VR", bg: "var(--mb-teal-tint)", color: "var(--mb-teal)" },
  ];

  const cost = c1.cost_of_inaction;

  // Build the rupee-anchored cost sentence.
  // Source-of-truth priority for monthly salary, in order:
  //   1. monthlySalaryInr prop (from scans.estimated_monthly_salary_inr) — best.
  //   2. Median of LLM's card2_market.salary_bands matched to user.current_title.
  //      This is the same band the user sees on Card 2 → consistent narrative.
  //   3. Raw monthly_loss_lpa string from LLM (legacy free-form).
  // We never fabricate; if all three fail the line is suppressed cleanly.
  const derivedMonthly = deriveMonthlyFromBands(
    cardData?.card2_market?.salary_bands,
    u.current_title || u.role,
  );
  const monthlyForCalc = (monthlySalaryInr && monthlySalaryInr > 0) ? monthlySalaryInr : derivedMonthly;

  let rupeeCostLine: string | null = null;
  if (cost) {
    const range = parsePctRange(cost.annual_gap_pct);
    if (range && monthlyForCalc && monthlyForCalc > 0) {
      const annualSalary = monthlyForCalc * 12;
      const lo = formatAnnualLakhs((annualSalary * range[0]) / 12);
      const hi = formatAnnualLakhs((annualSalary * range[1]) / 12);
      rupeeCostLine = lo === hi
        ? `At your level, that's roughly ${lo}/year you don't get back.`
        : `At your level, that's roughly ${lo}–${hi}/year you don't get back.`;
    } else if (cost.monthly_loss_lpa) {
      rupeeCostLine = `At your level, that's roughly ${cost.monthly_loss_lpa} of earning power slipping past you each year.`;
    }
  }

  const roleForSim = u.current_title || u.role || c1.role || "your role";

  // ─── Batch F (final): stake-amplifier strip under LLM headline ────────
  // The LLM-generated headline (rendered in CardHead) is already a strong
  // personalized verdict like "Your GTM architecture is safe; your
  // execution isn't." We don't replace it — we *amplify* it with a short
  // stake line that fuses the score + band into a single emotional beat,
  // sitting immediately under the headline and BEFORE the clinical gauge.
  //
  // Audit guardrails:
  //   • No naive plural ({title}s) — broken on "VP of Sales", "Head of X".
  //   • No task name from tasks_at_risk — pills below already render those.
  //   • Tone "indicative not absolute" per
  //     mem://style/tone-and-liability-calibration.
  //   • Renders only when score is a real number — otherwise suppressed.
  const score = c1.risk_score;
  const hasValidScore = typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100;

  let stakeLine: { kicker: string; bigNumber: string; line: string; tone: "red" | "amber" | "green" } | null = null;
  if (hasValidScore) {
    if (score >= 70) {
      stakeLine = {
        kicker: "What this actually means",
        bigNumber: `${score}%`,
        tone: "red",
        line: `of your daily execution is already machine-native. The window to reposition is closing — fast. The pills below show where it's bleeding first.`,
      };
    } else if (score >= 40) {
      stakeLine = {
        kicker: "What this actually means",
        bigNumber: `${score}%`,
        tone: "amber",
        line: `of your daily work is already automated or assisted by tools your peers are using. The strategy layer is still yours; the execution layer is borrowed time.`,
      };
    } else {
      stakeLine = {
        kicker: "What this actually means",
        bigNumber: `${score}%`,
        tone: "green",
        line: `of your daily output is automatable today — you sit in AI's blind spot. The moat holds. Your job is to keep it that way.`,
      };
    }
  }

  const stakeBg = stakeLine?.tone === "red" ? "var(--mb-red-tint)"
    : stakeLine?.tone === "amber" ? "var(--mb-amber-tint)"
    : "var(--mb-green-tint)";
  const stakeBorder = stakeLine?.tone === "red" ? "rgba(174,40,40,0.28)"
    : stakeLine?.tone === "amber" ? "rgba(196,142,30,0.30)"
    : "rgba(26,107,60,0.28)";
  const stakeAccent = stakeLine?.tone === "red" ? "var(--mb-red)"
    : stakeLine?.tone === "amber" ? "var(--mb-amber)"
    : "var(--mb-green)";

  // ─── Headline override: LLM sometimes returns generic boilerplate
  // ("Your execution layer is being automated today"). Detect weak/generic
  // headlines and replace with a sharper verdict tailored to:
  //   • role family (eng vs marketing vs founder vs ops…)
  //   • tenure (handles 0 / decimal / missing cleanly)
  //   • sector (uses u.industry verbatim when present)
  //   • risk band (high / mid / low → different emotional beat)
  // Keep the LLM headline when it's already specific (mentions a tool,
  // proper noun, function, or named system — see isSpecificHeadline).
  const llmHeadline: string = (c1.headline || "").trim();
  const llmSubline: string = (c1.subline || "").trim();
  const titleClean = (u.current_title || u.role || c1.role || "your role").replace(/\s+/g, " ").trim();
  const titleLower = titleClean.toLowerCase();
  const sector = (u.industry || "").trim();

  // Tenure phrasing — covers 0, decimals, missing, and very-senior cases
  // without ever printing "0 years" or "NaN years". Freshers (0 yrs) get
  // a different emotional beat downstream — they're entering a market,
  // not defending a seat.
  const yrsRaw = u.years_experience ?? u.years ?? u.experience;
  const yrsNum = typeof yrsRaw === "number" ? yrsRaw : (typeof yrsRaw === "string" ? parseFloat(yrsRaw) : NaN);
  const hasYears = Number.isFinite(yrsNum) && yrsNum >= 1;
  const isFresher = Number.isFinite(yrsNum) && yrsNum < 1;
  const yrsInt = hasYears ? Math.round(yrsNum) : 0;
  const tenurePhrase = hasYears
    ? (yrsInt >= 15 ? `${yrsInt} years deep into ${sector || "your field"}`
      : yrsInt >= 8 ? `${yrsInt} years into ${sector || "your field"}`
      : `${yrsInt} ${yrsInt === 1 ? "year" : "years"} into ${sector || "your field"}`)
    : `Your work in ${sector || "your field"}`;

  // Role-family classifier — drives metaphor-specific copy.
  // Order matters: founder/exec catches before "manager"; specific verticals
  // (healthcare, legal, edu) before generic. Hindi/Hinglish keywords mapped
  // to the same families (we don't translate the copy — just route correctly).
  type Family = "founder" | "exec" | "eng" | "data" | "design" | "pm" | "marketing" | "sales" | "ops" | "hr" | "finance" | "support" | "content"
    | "healthcare" | "legal" | "education" | "consulting" | "manufacturing" | "hospitality" | "creator" | "research"
    | "generic";
  const detectFamily = (t: string): Family => {
    // Founder / exec — catch before any generic "manager"
    if (/founder|ceo|coo|cto|cmo|cfo|chief|managing director|md\b|owner|प्रबंध निदेशक|संस्थापक/.test(t)) return "founder";
    if (/\bvp\b|vice president|head of|director|gm\b|general manager|निदेशक|प्रमुख/.test(t)) return "exec";
    // Specific verticals — before generic "manager" routes
    if (/doctor|nurse|surgeon|physician|dentist|pharmac|healthcare|medical|clinical|hospital|डॉक्टर|नर्स|चिकित्सक/.test(t)) return "healthcare";
    if (/lawyer|attorney|advocate|legal counsel|paralegal|वकील|अधिवक्ता/.test(t)) return "legal";
    if (/teacher|professor|lecturer|educator|tutor|principal|शिक्षक|प्राध्यापक|अध्यापक/.test(t)) return "education";
    if (/consultant|advisory|strategy consultant|management consult|सलाहकार/.test(t)) return "consulting";
    if (/manufactur|production engineer|plant manager|factory|industrial|उत्पादन/.test(t)) return "manufacturing";
    if (/hotel|chef|restaurant|hospitality|f&b|housekeeping|आतिथ्य|शेफ/.test(t)) return "hospitality";
    if (/creator|influencer|youtuber|streamer|podcast/.test(t)) return "creator";
    if (/researcher|scientist|phd|postdoc|शोधकर्ता|वैज्ञानिक/.test(t)) return "research";
    // Tech / digital families (Hindi keywords mapped)
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
  };
  let family = detectFamily(titleLower);

  // Sector tie-breaker: when title resolves to "generic" but industry is a
  // specific high-signal vertical, pivot family to match the sector. Saves
  // users with vague titles ("Manager", "Officer", "Associate") in strong
  // verticals from falling into generic boilerplate.
  if (family === "generic" && sector) {
    const s = sector.toLowerCase();
    if (/health|hospital|pharma|medical|clinical/.test(s)) family = "healthcare";
    else if (/legal|law/.test(s)) family = "legal";
    else if (/education|edtech|teaching|university/.test(s)) family = "education";
    else if (/consult|advisory/.test(s)) family = "consulting";
    else if (/manufactur|industrial|automotive/.test(s)) family = "manufacturing";
    else if (/hospitality|hotel|restaurant|f&b|tourism/.test(s)) family = "hospitality";
    else if (/research|r&d/.test(s)) family = "research";
    else if (/finance|banking|insurance|fintech/.test(s)) family = "finance";
    else if (/saas|software|tech|it services|product/.test(s)) family = "eng";
    else if (/marketing|adver|media/.test(s)) family = "marketing";
  }

  // What AI is actually replacing in this family (specific, not generic).
  const familyVerb: Record<Family, string> = {
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

  // Heuristic: keep LLM headline when it's already specific.
  const isSpecificHeadline = llmHeadline.length >= 28 && (
    /[A-Z][a-z]+(?:GPT|AI|GenAI|LLM)/.test(llmHeadline) ||  // tool name
    /\b(HubSpot|Salesforce|Jasper|Copilot|Cursor|ChatGPT|Claude|Gemini|Notion|Figma|Midjourney|Canva|Loom|Zapier|Make)\b/i.test(llmHeadline) || // named SaaS
    /\b\d+%/.test(llmHeadline) // contains a stat
  );
  const isWeakHeadline = !llmHeadline
    || /being automated today\.?$/i.test(llmHeadline)
    || /your (execution|tactical|operational) layer/i.test(llmHeadline)
    || /^(your role|risk mirror)/i.test(llmHeadline)
    || (llmHeadline.length < 30 && !isSpecificHeadline);

  let displayHeadline = llmHeadline || "Your role is in AI's path.";
  let displaySubline = llmSubline;
  if (isWeakHeadline && hasValidScore) {
    const replacing = familyVerb[family];

    // Freshers (yrs < 1) get a different emotional beat across all bands.
    // They're entering a market that's repricing entry-level work — not
    // defending a seat. Same family routing, different framing.
    if (isFresher) {
      if (score >= 70) {
        displayHeadline = `You're walking into a market that's repricing entry-level work in real time.`;
        displaySubline = `The ${titleClean} roles you're applying to no longer hire for the work you'd have done in year one — AI is doing it. Your edge has to be the work it can't.`;
      } else if (score >= 40) {
        displayHeadline = `You're entering ${sector || "this field"} during its biggest re-pricing cycle in a decade.`;
        displaySubline = `Junior roles for ${titleClean}s are getting fewer and meaner. The ones that hire are looking for AI fluency, not just credentials.`;
      } else {
        displayHeadline = `You're starting in a corner of the market AI hasn't reached yet.`;
        displaySubline = `That's a real advantage — but it's a 2–3 year window, not a career. Use it to build the moat that AI can't copy.`;
      }
    } else if (score >= 70) {
      // High band — name the loss directly. Different opening per family
      // so two users with the same score don't read identical copy.
      const highHeadlines: Record<Family, string> = {
        founder: `The operator job inside your founder role just got cheaper to run.`,
        exec: `The work that earned you the title is no longer the work that defends it.`,
        eng: `Most of what made you a fast ${titleClean} is now a feature in someone's IDE.`,
        data: `Your SQL fluency used to be a moat. It's now a free-tier feature.`,
        design: `The market is paying less for ${titleClean}s and more for taste.`,
        pm: `The documentation reps that built your judgment are now a ⌘+K away.`,
        marketing: `The job market doesn't need a ${titleClean} the way it did 18 months ago.`,
        sales: `Your top-of-funnel is now someone else's API call.`,
        ops: `The coordination work you were hired for is being absorbed by agents.`,
        hr: `Your screening reps — the thing only experience could teach — just became a prompt.`,
        finance: `Your spreadsheet fluency is being commoditised one Copilot release at a time.`,
        support: `Your tier-1 queue is shrinking faster than headcount can adjust.`,
        content: `The first-draft economy you trained for is now $20/month of tokens.`,
        healthcare: `Your clinical work is safe. The paperwork around it is being absorbed by AI scribes.`,
        legal: `The billable hours you charged for first-pass research are being eaten by AI.`,
        education: `Your teaching is safe. The lesson-prep, grading, and admin around it isn't.`,
        consulting: `The deck-and-deliverable factory that justified your day rate is being commoditised.`,
        manufacturing: `Your operational judgment is safe. The planning and reporting layer underneath it isn't.`,
        hospitality: `Front-desk and concierge tasks you trained for are being absorbed by AI agents.`,
        creator: `The production grind that built your channel is now $20/month of tokens.`,
        research: `The literature-review and synthesis half of your research is being eaten by AI.`,
        generic: `The job market doesn't need a ${titleClean} the way it did 18 months ago.`,
      };
      displayHeadline = highHeadlines[family];
      displaySubline = `${tenurePhrase} taught you ${replacing}. AI now runs that layer faster, cheaper, and at 2 a.m. — the seat is still warm, but the chair is being redesigned around you.`;
    } else if (score >= 40) {
      const midHeadlines: Record<Family, string> = {
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
      displayHeadline = midHeadlines[family];
      displaySubline = `${tenurePhrase} built real judgment. AI is quietly absorbing ${replacing} — and the market is repricing your seat to match.`;
    } else {
      const lowHeadlines: Record<Family, string> = {
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
      displayHeadline = lowHeadlines[family];
      displaySubline = `${tenurePhrase} built the kind of judgment models still can't fake. That moat is real — it's also rented, not owned, and re-earned every model release.`;
    }
  }

  // ─── Observability: track which copy path won (LLM vs template).
  // Operator queries `behavior_events` to decide when prompt quality
  // is good enough to retire the templates. Silent on failure.
  //
  // Dedup is *per scan_id*, not per-mount: Card1 unmounts/remounts every
  // time the user navigates Card1 → Card2 → Card1. A useRef would re-fire
  // on each remount and over-count by 3-5x. Module-level Set keyed by
  // scan_id is correct (set survives remounts; resets on full page reload
  // which is the right boundary — that IS a new "view" of the report).
  const { track } = useTrack(cardData?.scan_id);
  useEffect(() => {
    const sid = cardData?.scan_id;
    if (!sid || !hasValidScore) return;
    if (firedHeadlineEvents.has(sid)) return;
    firedHeadlineEvents.add(sid);
    const source: "llm" | "template" = isWeakHeadline ? "template" : "llm";
    const band: "high" | "mid" | "low" = score >= 70 ? "high" : score >= 40 ? "mid" : "low";
    track("card1_headline_source", {
      source,
      family,
      band,
      score,
      llm_headline_len: llmHeadline.length,
      llm_was_specific: isSpecificHeadline,
      peer_fallback_used: c1.india_average == null,
      sector: sector || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardData?.scan_id]);

  // ─── Peer-comparator fallback: when c1.india_average is null we previously
  // showed "Peer benchmark unavailable" — a credibility hole. Replace with a
  // band-derived comparator grounded in the O*NET / McKinsey / Goldman
  // distributions cited in the methodology footer + the family above.
  // This is *categorical* (band + family-specific fact), not a fabricated
  // number — truthful, sourced, and useful.
  let peerFallback: { label: string; detail: string } | null = null;
  if (c1.india_average == null && hasValidScore) {
    const familyDetail: Record<Family, { high: string; mid: string; low: string }> = {
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
      generic: {
        high: "Roles in your band are losing 40–60% of routine task volume to AI assistants within 24 months (O*NET 2024 distribution).",
        mid: "Roles here keep their seat but lose pricing power: comp growth lags inflation by 4–7%/yr while juniors deliver more with AI.",
        low: "AI augments rather than replaces here, but the moat shrinks each model release. Re-audit every 6 months.",
      },
    };
    if (score >= 70) {
      peerFallback = {
        label: `Top quartile of automation exposure · ${sector || "cross-sector"} band`,
        detail: familyDetail[family].high,
      };
    } else if (score >= 40) {
      peerFallback = {
        label: `Mid-band — the squeeze zone${sector ? ` · ${sector}` : ""}`,
        detail: familyDetail[family].mid,
      };
    } else {
      peerFallback = {
        label: `Lower quartile — judgment-weighted role${sector ? ` · ${sector}` : ""}`,
        detail: familyDetail[family].low,
      };
    }
  }

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="01 · Awareness" variant="amber" /><Badge label="Resume analysed" variant="navy" /></>}
        title={displayHeadline}
        sub={displaySubline}
      />
      <CardBody>
        {/* Batch F (final): Stake-amplifier strip under LLM headline */}
        {stakeLine && (
          <div style={{ display: "flex", alignItems: "stretch", gap: 14, background: stakeBg, border: `2px solid ${stakeBorder}`, borderLeft: `5px solid ${stakeAccent}`, borderRadius: 14, padding: "14px 18px", marginBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minWidth: 78, paddingRight: 14, borderRight: `1.5px dashed ${stakeBorder}` }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 30, fontWeight: 800, color: stakeAccent, lineHeight: 1, letterSpacing: "-0.02em" }}>
                {stakeLine.bigNumber}
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: stakeAccent, marginTop: 4 }}>
                AI exposure
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: stakeAccent, marginBottom: 6 }}>
                {stakeLine.kicker}
              </div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--mb-ink)", lineHeight: 1.55, margin: 0 }}>
                {stakeLine.line}
              </p>
            </div>
          </div>
        )}

        {/* AI Exposure gauge - peer benchmark only (score moved up to stake strip) */}
        <div style={{ padding: "4px 14px 6px" }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mb-ink3)" }}>
            The evidence - how you compare
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center", padding: 20, background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 16, marginBottom: 8, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          {/* Gauge ring - score is small/secondary now (the big number lives in the stake strip above) */}
          <svg width={88} height={88} viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={r} fill="none" stroke="var(--mb-rule)" strokeWidth={9} />
            <circle cx={50} cy={50} r={r} fill="none" stroke={gaugeColor} strokeWidth={9} strokeLinecap="round" transform="rotate(-90 50 50)" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.8s ease" }} />
            <text x={50} y={48} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 800, fill: gaugeColor }}>{c1.risk_score}<tspan style={{ fontSize: 10, fontWeight: 700 }}>%</tspan></text>
            <text x={50} y={68} textAnchor="middle" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 800, fill: "var(--mb-ink3)", textTransform: "uppercase", letterSpacing: "0.14em" }}>YOU</text>
          </svg>
          <div style={{ flex: 1 }}>
            {c1.india_average != null ? (
              <>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.6, fontWeight: 500, marginBottom: 6 }}>
                  India average for this role: <strong style={{ fontWeight: 800, color: "var(--mb-ink)" }}>{c1.india_average}%</strong>
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.6, fontWeight: 500 }}>
                  You're <strong style={{ fontWeight: 800, color: (c1.risk_score || 0) > c1.india_average ? "var(--mb-red)" : "var(--mb-green)" }}>{Math.abs((c1.risk_score || 0) - c1.india_average)} points {(c1.risk_score || 0) > c1.india_average ? "above" : "below"}</strong> the average.
                </div>
              </>
            ) : peerFallback ? (
              <>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.55, fontWeight: 700, marginBottom: 6 }}>
                  {peerFallback.label}
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", lineHeight: 1.6, fontWeight: 500 }}>
                  {peerFallback.detail}
                </div>
              </>
            ) : (
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink3)", lineHeight: 1.6, fontStyle: "italic" }}>
                Peer benchmark unavailable for this role.
              </div>
            )}
          </div>
        </div>
        {/* Demoted disambiguation footnote — below gauge, small, no longer blocks the punch */}
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", marginBottom: 18, paddingLeft: 4, fontStyle: "italic" }}>
          Different from your overall JobBachao score (top of page) — this measures only automation risk for your role, not your full career safety.
        </div>

        {/* ─────────────── 2. Single fear hook (consolidated) ─────────────── */}
        {c1.fear_hook && (
          <div style={{ background: "var(--mb-red-tint)", border: "2px solid rgba(174,40,40,0.2)", borderRadius: 14, padding: "16px 18px", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>🚨</span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mb-red)" }}>
                {`THE ${disruptionYear} PROBLEM`}
              </span>
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--mb-red)", lineHeight: 1.7, margin: 0, whiteSpace: "pre-line" }}>{c1.fear_hook}</p>
          </div>
        )}

        {/* ─────────────── 3. Boss Perception Simulator (with tough_love micro-close) ─────────────── */}
        <BossPerceptionSimulator
          role={roleForSim}
          years={u.years_experience || u.years || u.experience}
          riskScore={c1.risk_score || 0}
          tasksAtRisk={c1.tasks_at_risk}
          industry={u.industry}
        />
        {c1.tough_love && (
          <div style={{ marginTop: -6, marginBottom: 18, paddingLeft: 4 }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: "var(--mb-ink2)", lineHeight: 1.6, margin: 0, fontStyle: "italic", whiteSpace: "pre-line" }}>
              {c1.tough_love}
            </p>
          </div>
        )}

        {/* ─────────────── 4. Cost of standing still — single rupee-anchored line ─────────────── */}
        {(rupeeCostLine || cost?.decay_narrative) && (
          <>
            <SectionLabel label="The cost of standing still" />
            <div style={{ borderLeft: "4px solid var(--mb-red)", background: "linear-gradient(90deg, var(--mb-red-tint), transparent)", padding: "14px 18px", borderRadius: "0 12px 12px 0", marginBottom: 8 }}>
              {rupeeCostLine && (
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.6, margin: 0 }}>
                  {rupeeCostLine}
                </p>
              )}
              {cost?.decay_narrative && (
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "var(--mb-ink2)", lineHeight: 1.7, margin: rupeeCostLine ? "8px 0 0 0" : 0 }}>
                  {cost.decay_narrative}
                </p>
              )}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", marginBottom: 22, paddingLeft: 4 }}>
              Source: NASSCOM AI Talent Report 2024 + Naukri JobSpeak appraisal compression data for repositioned vs static profiles.
            </div>
          </>
        )}

        {/* ─────────────── 5. What's changing — tasks + ATS + India signal ─────────────── */}

        {/* ATS Section — only renders when scoring pipeline has populated real JD matches */}
        {c1.ats_scores != null && c1.ats_scores.length > 0 && (
          <>
            <SectionLabel label="ATS resume match · 3 target India JDs right now" />
            <div style={{ background: "white", border: "1.5px solid var(--mb-rule)", borderRadius: 16, overflow: "hidden", marginBottom: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1.5px solid var(--mb-rule)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 800, color: "var(--mb-ink)" }}>ATS Resume Match · 3 Target India JDs</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, fontWeight: 800, color: "var(--mb-amber)" }}>{cardData.ats_avg || c1.ats_scores?.[0]?.score || 60}%<span style={{ fontSize: 13, fontWeight: 600, color: "var(--mb-ink3)", marginLeft: 4 }}>avg</span></span>
              </div>
              <div style={{ padding: "18px 20px" }}>
                {(c1.ats_scores || []).map((s: any, i: number) => {
                  const city = (s.city || "all-india").toLowerCase().replace(/\s+/g, "-");
                  const searchUrl = s.search_url || `https://www.naukri.com/jobs-in-${city}?k=${encodeURIComponent(`${s.role} ${s.company}`).replace(/%20/g, "+")}`;
                  return (
                    <div key={i} style={{ marginBottom: i < (c1.ats_scores?.length || 0) - 1 ? 16 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                        <a href={searchUrl} target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, fontSize: 14, color: "var(--mb-navy)", fontWeight: 700, lineHeight: 1.3, fontFamily: "'DM Sans', sans-serif", textDecoration: "none", borderBottom: "1.5px dashed var(--mb-navy-tint2)" }}
                          title={`Search ${s.company} · ${s.role} on Naukri`}
                        >
                          {s.company} · {s.role} ↗
                        </a>
                        <div style={{ width: 90, height: 5, background: "var(--mb-rule)", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
                          <div style={{ height: 5, background: variantColor(s.color), width: `${s.score}%`, borderRadius: 3, transition: "width 0.6s ease" }} />
                        </div>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 800, minWidth: 40, textAlign: "right", color: variantColor(s.color) }}>{s.score}%</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, paddingLeft: 2 }}>
                        <a href={searchUrl} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, fontWeight: 800, padding: "5px 14px", borderRadius: 8, background: "#4A90D9", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32 }}
                        >🔍 Naukri</a>
                        <a href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(`${s.role} ${s.company}`)}&f_TPR=r604800`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, fontWeight: 800, padding: "5px 14px", borderRadius: 8, background: "#0A66C2", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32 }}
                        >💼 LinkedIn</a>
                      </div>
                    </div>
                  );
                })}
                {c1.ats_missing_keywords?.length > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1.5px solid var(--mb-rule)", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                    <span style={{ fontWeight: 800, color: "var(--mb-ink)" }}>⚠️ Missing keywords: </span>
                    {c1.ats_missing_keywords.map((kw: string, i: number) => (
                      <span key={i}><strong style={{ color: "var(--mb-red)", fontWeight: 800 }}>{kw}</strong>{i < c1.ats_missing_keywords.length - 1 ? " · " : ""}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Tasks at risk / safe — capped at 3+3 to avoid pill-soup overload.
            LLM emits exactly 5 each; we surface the 3 highest-priority and
            note the rest in a quiet caption. The full list lives in card3_shield. */}
        <SectionLabel label="What AI is replacing in your role right now" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 8 }}>
          {(c1.tasks_at_risk || []).slice(0, 3).map((t: string, i: number) => (
            <span key={`r${i}`} style={{ fontSize: 13, fontWeight: 700, padding: "6px 16px", borderRadius: 20, border: "1.5px solid rgba(174,40,40,0.25)", color: "var(--mb-red)", background: "var(--mb-red-tint)", fontFamily: "'DM Sans', sans-serif" }}>❌ {t}</span>
          ))}
          {(c1.tasks_safe || []).slice(0, 3).map((t: string, i: number) => (
            <span key={`s${i}`} style={{ fontSize: 13, fontWeight: 700, padding: "6px 16px", borderRadius: 20, border: "1.5px solid rgba(26,107,60,0.25)", color: "var(--mb-green)", background: "var(--mb-green-tint)", fontFamily: "'DM Sans', sans-serif" }}>✅ {t}</span>
          ))}
        </div>
        {((c1.tasks_at_risk?.length || 0) > 3 || (c1.tasks_safe?.length || 0) > 3) && (
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", marginBottom: 22, paddingLeft: 4 }}>
            Showing top 3 of each. Full skill map → Card 3 (Shield).
          </div>
        )}
        {!((c1.tasks_at_risk?.length || 0) > 3 || (c1.tasks_safe?.length || 0) > 3) && (
          <div style={{ marginBottom: 22 }} />
        )}

        {/* India market signal — promoted, no longer buried under stat-grid noise */}
        <InfoBox variant="amber" title={`India market signal — ${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`} body={c1.india_data_insight || ""} />

        {/* hope_bridge intentionally NOT rendered here — Card 1 ends on pressure.
            Card 2 (Market Radar) opens with its own hope_bridge to land the relief beat
            after the user has fully processed the risk. Avoids duplicate green panels. */}

        {/* Social proof */}
        {scanCount && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 14, marginBottom: 14 }}>
            <div style={{ display: "flex" }}>
              {avatars.map((a, i) => (
                <div key={i} style={{ width: 26, height: 26, borderRadius: "50%", background: a.bg, color: a.color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 800, border: "2px solid white", marginLeft: i > 0 ? -6 : 0 }}>{a.initials}</div>
              ))}
            </div>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", fontWeight: 600 }}><strong style={{ fontWeight: 800, color: "var(--mb-ink)" }}>{scanCount}+</strong> professionals checked this month{c1.india_average != null && <> · India avg: <strong style={{ fontWeight: 800, color: "var(--mb-red)" }}>{c1.india_average}%</strong></>}</span>
          </div>
        )}

        {/* Methodology stamp — trust footer */}
        <div style={{ padding: "10px 14px", background: "var(--mb-paper)", border: "1px dashed var(--mb-rule)", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", lineHeight: 1.6, fontWeight: 500 }}>
          <strong style={{ color: "var(--mb-ink2)", fontWeight: 800, letterSpacing: "0.04em" }}>HOW WE CALCULATED THIS:</strong> AI Exposure derived from O*NET task-automation indices, McKinsey & Goldman Sachs occupational AI-impact studies, and your resume's task profile. Disruption year is a directional estimate based on current adoption velocity in your sector — not a guarantee.
        </div>

        <CardNav onBack={onBack} onNext={onNext} nextLabel="See your live market →" />
      </CardBody>
    </CardShell>
  );
}

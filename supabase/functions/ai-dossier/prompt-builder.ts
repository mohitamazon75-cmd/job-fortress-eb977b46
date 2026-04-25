// ═══════════════════════════════════════════════════════════════
// AI Impact Dossier — Prompt Builder
// Separated for clarity and maintainability.
// ═══════════════════════════════════════════════════════════════

export function buildDossierPrompt(): string {
  const currentDate = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return `You are the world's most incisive AI Job Impact Analyst, specialising in the Indian professional market. You write with the authority of a McKinsey partner and the bluntness of a war correspondent. Your objective: produce a deeply personalized "AI Impact Dossier" that reads like it was written by someone who spent a week studying this person's career.

## INDIA MARKET CONTEXT (${currentDate})
You have deep, current knowledge of:
- AI tool adoption in India: ChatGPT Advanced Data Analysis, GitHub Copilot, Julius AI, Gemini in Google Workspace, Microsoft Copilot (Power BI/Excel), Perplexity, Claude, Cursor — reference these by exact product name when relevant to the role.
- Indian job market realities: Naukri, LinkedIn India, Glassdoor India hiring trends. Indian IT sector dynamics (TCS, Infosys, Wipro, HCL, Accenture India), BFSI, D2C/e-commerce, SaaS, edtech, fintech hiring patterns.
- India-specific salary benchmarks in ₹ (INR). Metro tier dynamics: Bengaluru, Hyderabad, Pune, Mumbai, Delhi-NCR.
- NSDC skill demand reports, RBI/SEBI regulatory context for finance roles, MeitY digital India initiatives for tech roles.
- The 2024-2025 AI displacement curve in India: which roles are seeing real restructuring now vs. which are overhyped.

When writing the SURVIVAL ROADMAP, reference India-specific resources: NPTEL, Coursera with financial aid (available to Indian students), IIM/IIT executive programs, LinkedIn Learning (free with many Indian employer plans), specific Indian communities (HasGeek, PyData India, iSPIRT, NASSCOM forums).

## ABSOLUTE RULES

1. **No preamble.** Output ONLY the dossier using the exact Markdown template below. Never say "Here is the analysis" or "Sure, I can help."
2. **No hallucinations.** Every claim must reference a SPECIFIC fact from the structured input fields. If a fact is missing, say less — never invent.
3. **Direct address.** Speak to the candidate as "You" and "Your."
4. **Banned words:** synergy, passionate, detail-oriented, results-driven, leverage (as a verb), cutting-edge, game-changer.
5. **Required vocabulary:** moat, pivot, automation, execution, velocity, commercial outcome, token-efficiency, agentic, defensible.
6. **SURVIVAL ROADMAP must be a numbered action plan** — minimum 4 numbered steps, each ≤ 20 words, each starting with a strong verb (Build, Master, Apply, Publish, Pitch, Complete, Join, Reach). Steps must be specific to the role — not generic. Where possible name the exact tool/platform/community the person should use.
6. **EVIDENCE QUALITY OVER DRAMA.** Each paragraph must include concrete facts from provided data (role, company, named skills, verified metrics). Do not fabricate numbers to make copy punchier.
7. **CURRENT ROLE PRIMACY.** The candidate's identity is defined by their CURRENT ROLE and CURRENT COMPANY (provided in the "CURRENT ROLE" and "COMPANY" fields). Past positions are context only and must never overwrite current identity.
8. **SPARSE DATA PROTOCOL.** If data is thin, explicitly stay conservative. Use role/industry-level framing, but avoid specific claims (revenue, team size, deal size, company history) unless present in structured fields.
9. **NUMERIC ANCHOR POLICY.** Use percentages, rupee values, dollar values, team sizes, and timelines ONLY from structured metric sections (Automation Risk, Survivability, Score Breakdown, Executive Impact, Skill-Level Analysis). Ignore unverified numbers from raw web snippets.

## DYNAMIC PROFILING ENGINE

Before generating, silently classify the candidate:

**CATEGORY 1: THE APEX** (Low Risk / Strategic / Executive)
- Profile: Founders, C-suite, VPs, Directors. Work is highly ambiguous, cross-functional, requires complex human/market alignment.
- Stance: **Motivational Validation.** Frame them as the "Human API." Validate their strategic moat. Emphasize that in a market flooded with AI tools, their ability to drive actual revenue, navigate regulations, and secure human alignment is deeply prized. Reference their SPECIFIC revenue figures, partnerships, and scale achievements.

**CATEGORY 2: THE CO-PILOT** (Medium Risk / Mid-Level)  
- Profile: Mid-level Engineers, Senior Designers, Content Strategists. Deep work that AI assists but can't fully replace.
- Stance: **Pragmatic Push.** Acknowledge base execution skills are commoditizing. Push from "doers" to "taste-makers" and "system-editors." Reference their specific tools and projects.

**CATEGORY 3: THE VULNERABLE** (High Risk / Junior / Task-Based)
- Profile: Junior Devs, Basic QA, Data Entry, Tier 1 Support, Junior Copywriters.  
- Stance: **Brutal Wake-Up Call + Tough Love.** State what AI automates right now. Pivot to constructive tough love with specific escape paths.

## OUTPUT TEMPLATE

CRITICAL: Use the EXACT role title from "CURRENT ROLE" field below. NEVER upgrade, rename, or inflate titles. If the input says "Digital Marketing Manager", write "Digital Marketing Manager" — NOT "Marketing Director" or "Head of Marketing". The user's trust depends on seeing THEIR title reflected back accurately.

# ⚡ THE AI IMPACT DOSSIER: [CATEGORY NAME — e.g., "PROFESSIONAL" or "EXECUTIVE"]

**Profile Analysis:** As a [EXACT ROLE FROM INPUT] with [X] years of experience in the [INDUSTRY] sector, [one powerful sentence using specific facts]. Use the VERBATIM role title — never substitute or "upgrade" it.

**Market Status:** [Cat 1: "Highly Disruptive. Un-Automatable." | Cat 2: "High Augmentation Potential." | Cat 3: "High Automation Risk. Pivot Required."]

---

## THE ALGORITHM'S VERDICT
> [Write 3-5 punchy sentences as a blockquote. This is the HERO paragraph.
> Cat 1: Name their SPECIFIC hidden human moat using EXACT achievements from their resume — dollar amounts, company names, scale numbers. Example: "AI cannot close a $20M international sales commitment or convince 70+ subsidiary companies to adopt a unified shared services model."
> Cat 2: Name EXACTLY what AI commoditizes in their daily work, and what strategic taste remains defensible.
> Cat 3: Bluntly name the SPECIFIC tasks AI will eat, with tool names. Then state the pivot path.]

---

## 📊 THE JOB SURVIVAL MATRIX

### 🛡️ AUTOMATION RESISTANCE: [XX]%
**The Reality Check:** [2-3 sentences. Name SPECIFIC tasks from their resume that AI can/cannot do. Reference actual AI tools by name (Cursor, Copilot, Claude, Gemini). For executives, emphasize what algorithms categorically cannot do in their specific context — name the companies, the deals, the stakeholders.]

### 🧠 THE HUMAN MOAT (OR: THE PIVOT POINT): [XX]%
**Where your true value lies:** [2-3 sentences referencing SPECIFIC achievements. For Cat 1: cite their revenue figures, team scale, named partnerships. For Cat 2: cite their specific creative/technical judgment. For Cat 3: explain how their domain knowledge enables them to manage AI workflows.]

### 📈 MARKET DEMAND (MACRO-ECONOMIC TRAJECTORY): [XX]%
**What the current market demands from you:** [2-3 sentences. Frame their background against harsh current macro realities — VC funding shifts, AI infrastructure demands, industry-specific trends. Reference their specific industry and role.]

---

## 🥊 [FIRST NAME] vs. THE ALGORITHM: Head-to-Head

| The AI Can... | But [First Name] Does / Must Do... | The Outcome |
|---|---|---|
| [Specific AI capability relevant to their role] | [Their specific human capability with named examples] | [Concrete outcome] |
| [Specific AI capability 2] | [Their specific human capability 2] | [Concrete outcome 2] |
| [Specific AI capability 3] | [Their specific human capability 3] | [Concrete outcome 3] |
| [Specific AI capability 4] | [Their specific human capability 4] | [Concrete outcome 4] |

---

## 🎯 THE SURVIVAL ROADMAP

*"[One punchy italicised opening line — a mandate, not a suggestion. Use their specific role and one concrete fact from their data.]*"

**Your 90-day action plan — specific to your role:**

1. [Strong verb + exactly what to do + where/how, ≤20 words. Name a specific tool or platform.]
2. [Strong verb + exactly what to do + where/how, ≤20 words. India-specific resource where relevant.]
3. [Strong verb + exactly what to do + where/how, ≤20 words. Public proof or community angle.]
4. [Strong verb + exactly what to do + where/how, ≤20 words. Career positioning or salary outcome.]

**Verdict:** [2-3 word punchy verdict. Examples: "Apex Leader. Un-Automatable." | "AI-Enhanced Architect." | "Evolve or Expire."]

## SCORING RULES
- Scores MUST be grounded in actual input data. Do not inflate.
- CATEGORY 3: scores below 40% are expected and honest.
- CATEGORY 1 with strong evidence: scores above 80% are appropriate.
- Use the provided AUTOMATION RISK percentage as a baseline anchor.
- SENIORITY level must inform category: PROFESSIONAL/JUNIOR = Cat 2-3. DIRECTOR/VP/C-SUITE = Cat 1.`;
}

function sanitizeProfileEvidence(rawProfileText: string, currentCompany: string, currentRole: string): string {
  if (!rawProfileText) return "";

  const leadershipRegex = /(founder|ceo|cto|cfo|coo|cmo|vp|vice president|director|head|principal|consultant|manager|business|strategy)/i;
  const companyLower = (currentCompany || "").toLowerCase();
  const roleLower = (currentRole || "").toLowerCase();

  const roleTokens = roleLower
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 5)
    .slice(0, 6);

  let inExperienceBlock = false;
  const keptLines: string[] = [];

  for (const line of rawProfileText.split("\n")) {
    const trimmed = line.trim();

    if (/^experience:/i.test(trimmed)) {
      inExperienceBlock = true;
      keptLines.push(line);
      continue;
    }

    if (/^(skill risk matches:|resolved inputs:|---)/i.test(trimmed)) {
      inExperienceBlock = false;
      keptLines.push(line);
      continue;
    }

    if (inExperienceBlock && trimmed.startsWith("-")) {
      const lower = trimmed.toLowerCase();
      const mentionsCurrentCompany = !!companyLower && lower.includes(` at ${companyLower}`);
      const roleOverlap = roleTokens.filter((token) => lower.includes(token)).length;
      const isLikelyCurrentOrStrategic = mentionsCurrentCompany || leadershipRegex.test(trimmed) || roleOverlap >= 2;
      if (isLikelyCurrentOrStrategic) keptLines.push(line);
      continue;
    }

    if (!inExperienceBlock) keptLines.push(line);
  }

  const sanitized = keptLines.join("\n").trim();
  const filtered = sanitized
    .split("\n")
    .filter((line) => !/(scribd|uploaded by|0 ratings|views\d|career summary:|open navigation menu)/i.test(line))
    .join("\n")
    .trim();

  return filtered || sanitized || rawProfileText;
}

export function buildProfileContext(report: any): string {
  const name = report.linkedin_name || "Professional";
  const role = report.role_detected || report.role || "Unknown Role";
  const industry = report.industry || "Technology";
  const seniority = report.seniority_tier || "PROFESSIONAL";
  const allSkills = report.all_skills || [];
  const executionSkills = report.execution_skills || [];
  const strategicSkills = report.strategic_skills || [];
  const moatSkills = report.moat_skills || report.moat_indicators || [];
  const company = report.linkedin_company || "";
  const experience = report.years_experience || "";
  const automationRisk = report.automation_risk ?? report.determinism_index ?? 50;
  const monthsRemaining = report.months_remaining ?? 36;
  const salaryBleed = report.salary_bleed_monthly ?? 0;
  const cognitiveEdge = report.cognitive_moat || "";
  const deadEndNarrative = report.dead_end_narrative || "";
  const freeAdvice = [report.free_advice_1, report.free_advice_2, report.free_advice_3].filter(Boolean);
  const tools = (report.ai_tools_replacing || []).map((t: any) => typeof t === 'string' ? t : t.tool_name).filter(Boolean);
  const marketPosition = report.market_position_model || {};
  const survivability = report.survivability || {};
  const executiveImpact = report.executive_impact || {};
  const skillAdjustments = report.score_breakdown?.skill_adjustments || [];
  const rawProfileText = report.raw_profile_text || "";
  const extractionConfidence = report.extraction_confidence || report.rawExtractionQuality || "medium";
  const sanitizedProfileText = sanitizeProfileEvidence(rawProfileText, company, role);
  // Agent2A displacement data (from Fix 2 — urgency_horizon + threat_timeline)
  // BL-031: tolerate legacy string form by extracting any 4-digit years.
  const urgencyHorizon = report.urgency_horizon || null;
  const rawThreatTimeline = report.threat_timeline;
  type NormalizedTT = {
    partial_displacement_year: number | null;
    significant_displacement_year: number | null;
    critical_displacement_year: number | null;
    primary_threat_tool: string | null;
    at_risk_task: string | null;
  };
  let threatTimeline: NormalizedTT | null = null;
  if (rawThreatTimeline && typeof rawThreatTimeline === "object" && !Array.isArray(rawThreatTimeline)) {
    threatTimeline = rawThreatTimeline as NormalizedTT;
  } else if (typeof rawThreatTimeline === "string") {
    const years = Array.from(rawThreatTimeline.matchAll(/(20\d{2})/g)).map((m) => Number(m[1]));
    if (years.length > 0) {
      years.sort((a, b) => a - b);
      threatTimeline = {
        partial_displacement_year: years[0] ?? null,
        significant_displacement_year: years[1] ?? years[0] ?? null,
        critical_displacement_year: years[2] ?? null,
        primary_threat_tool: null,
        at_risk_task: null,
      };
    }
  }

  // Build evidence quality directive based on extraction confidence
  const evidenceDirective = extractionConfidence === "low"
    ? `\n\n🚨 EVIDENCE QUALITY: LOW — Profile data was extracted from search snippets, NOT a verified LinkedIn page.
MANDATORY RULES FOR LOW-CONFIDENCE DATA:
- Do NOT mention specific past companies unless they appear in the EXPERIENCE section AND in structured fields above
- Do NOT quote revenue figures, team sizes, investment amounts, or any numbers from raw profile text
- Do NOT attribute specific achievements or projects unless they appear in structured metrics
- Frame the dossier around ROLE + INDUSTRY + SKILLS, not biographical details
- Use phrases like "In your role as..." instead of "At [Company], you..."
- If company name is empty or "Not specified", do NOT guess or invent one
- Better to be VAGUE and CORRECT than SPECIFIC and WRONG`
    : extractionConfidence === "high"
      ? `\n\nEVIDENCE QUALITY: HIGH — Profile data from direct LinkedIn scrape. You may reference specific companies, roles, and achievements from the profile text with confidence.`
      : `\n\nEVIDENCE QUALITY: MEDIUM — Profile data has reasonable confidence. Reference specific details only when clearly stated in structured fields. Avoid quoting numbers from raw text.`;

  let context = `GENERATE THE AI IMPACT DOSSIER NOW.

Every paragraph must include concrete facts from the structured data below (role, company, named skills, verified metrics). If facts are missing, be conservative and do not invent.

CRITICAL IDENTITY ANCHOR: The candidate is currently "${role}" at "${company || 'Not specified'}". Historical roles are context only. Never frame the identity as a transition from an old title.
${evidenceDirective}

═══════════════════════════════════════════
CANDIDATE PROFILE DATA
═══════════════════════════════════════════

NAME: ${name}
CURRENT ROLE: ${role}
COMPANY: ${company || 'Not specified'}
INDUSTRY: ${industry}
SENIORITY TIER: ${seniority}
YEARS OF EXPERIENCE: ${experience}

ALL SKILLS: ${allSkills.join(', ') || 'Not provided'}
EXECUTION SKILLS: ${executionSkills.join(', ') || 'Not provided'}
STRATEGIC SKILLS: ${strategicSkills.join(', ') || 'Not provided'}
HARD-TO-AUTOMATE SKILLS: ${moatSkills.join(', ') || 'None identified'}
COGNITIVE EDGE: ${cognitiveEdge}

AUTOMATION RISK (from deterministic engine): ${automationRisk}%
MONTHS BEFORE MAJOR DISRUPTION: ${monthsRemaining}
MONTHLY SALARY EROSION ESTIMATE: ₹${salaryBleed.toLocaleString()}

AI TOOLS ALREADY DOING PARTS OF THIS JOB: ${tools.join(', ') || 'None mapped'}

MARKET POSITION:
- Market Percentile: ${marketPosition.market_percentile ?? 'N/A'}
- Competitive Tier: ${marketPosition.competitive_tier ?? 'N/A'}
- Talent Density: ${marketPosition.talent_density ?? 'N/A'}
- Demand Trend: ${marketPosition.demand_trend ?? 'N/A'}

SURVIVABILITY SCORE: ${survivability.score ?? 'N/A'}/100
PRIMARY VULNERABILITY: ${survivability.primary_vulnerability ?? 'N/A'}

SKILL-LEVEL ANALYSIS:
${skillAdjustments.map((s: any) => `- ${s.skill_name}: ${s.automation_risk}% automatable`).join('\n') || 'No skill-level data'}

CAREER NARRATIVE: ${deadEndNarrative || 'Not provided'}
KEY ADVICE POINTS: ${freeAdvice.join(' | ') || 'Not provided'}
${urgencyHorizon ? `
DISPLACEMENT URGENCY (from Knowledge Graph — use these exact figures in your analysis):
${urgencyHorizon}${threatTimeline ? `
- Partial displacement begins: ${threatTimeline.partial_displacement_year ?? 'N/A'} (20-30% tasks automatable)
- Significant displacement: ${threatTimeline.significant_displacement_year ?? 'N/A'} (50%+ tasks automatable)
- Critical displacement: ${threatTimeline.critical_displacement_year ?? 'N/A'} (role restructuring/elimination)
- Primary threat tool (LIVE TODAY): ${threatTimeline.primary_threat_tool ?? 'N/A'}
- At-risk task (most immediate): ${threatTimeline.at_risk_task ?? 'N/A'}
INSTRUCTION: Reference these specific years in "THE ALGORITHM'S VERDICT" section. Quote the primary_threat_tool by name. Name the at_risk_task explicitly.` : ''}` : ''}

STRICT NUMERIC EVIDENCE POLICY:
- Use numeric claims ONLY from structured metrics above (AUTOMATION RISK, SURVIVABILITY SCORE, SKILL-LEVEL ANALYSIS, EXECUTIVE IMPACT SIGNALS).
- Do NOT quote money, percentages, team sizes, or timelines from RAW RESUME / LINKEDIN PROFILE section.
- If COMPANY is "Not specified", do NOT invent or guess a company name.`;

  if (executiveImpact.revenue_scope_usd) {
    context += `\n\nEXECUTIVE IMPACT SIGNALS (USE THESE NUMBERS IN YOUR ANALYSIS):
- Revenue/P&L Scope: $${executiveImpact.revenue_scope_usd?.toLocaleString()}
- Team Size: ${executiveImpact.team_size_direct ?? 'N/A'} direct reports / ${executiveImpact.team_size_org ?? 'N/A'} org
- Board Exposure: ${executiveImpact.board_exposure ? 'Yes' : 'No'}
- Regulatory Domains: ${(executiveImpact.regulatory_domains || []).join(', ') || 'None'}
- Moat Type: ${executiveImpact.moat_type ?? 'N/A'}
- Moat Evidence: ${executiveImpact.moat_evidence ?? 'N/A'}`;
  }

  if (sanitizedProfileText && extractionConfidence !== "low") {
    // Only include raw profile text for high/medium confidence extractions
    context += `\n\n═══════════════════════════════════════════
RAW RESUME / LINKEDIN PROFILE (CLEANED EVIDENCE — prioritize CURRENT role/company; treat older roles as historical only)
═══════════════════════════════════════════
${sanitizedProfileText}`;
  } else if (sanitizedProfileText && extractionConfidence === "low") {
    // For low confidence, include a heavily truncated version with explicit warning
    const truncated = sanitizedProfileText.slice(0, 500);
    context += `\n\n═══════════════════════════════════════════
RAW PROFILE (LOW CONFIDENCE — DO NOT QUOTE SPECIFIC FACTS FROM THIS SECTION)
═══════════════════════════════════════════
${truncated}
[...truncated — low confidence data, do not reference specific details from above]`;
  }

  return context;
}

import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { checkDailySpending, buildSpendingBlockedResponse } from "../_shared/spending-guard.ts";
import { callAgent, PRO_MODEL, FLASH_MODEL } from "../_shared/ai-agent-caller.ts";
import { requirePro } from "../_shared/subscription-guard.ts";

// ═══════════════════════════════════════════════════════════════
// Side Hustle Intelligence Engine v2 — 2026 Edition
//
// Pipeline:
//   Stage 1: LateralScout (Flash ~10s) → 8 opportunity vectors
//   Stage 2: THREE parallel calls:
//     - Slot A (Pro): 2 scalable/product ideas
//     - Slot B (Pro): 1 service/community idea
//   Stage 3: Merge + select best 3 with deepened details
// ═══════════════════════════════════════════════════════════════

const IDEA_SCHEMA = `{
  "ideaName": "Clear, simple name anyone can understand (e.g. 'AI-Powered Contract Review for SaaS Startups' NOT 'ContractForge Pro'). NO made-up brand names, NO compound words, NO jargon.",
  "emoji": "relevant emoji",
  "oneLineThesis": "One punchy sentence making value instantly clear — conversational, zero jargon",
  "businessModel": "productized_service|micro_agency|template|tooling|marketplace|local_service|content_plus_service|community|ai_wrapper|data_arbitrage",
  "whyThisFits": "Reference SPECIFIC skills from profile — explain the non-obvious connection",
  "whyNow": "Cite specific 2025-2026 trend, regulatory shift, platform launch, or market gap. Must be CURRENT.",
  "targetBuyer": "SPECIFIC buyer persona with trigger event (e.g. 'Series A founders who just closed funding and need to hire 10 people in 60 days')",
  "target_client": "More specific India-relevant description (e.g. 'Mid-size Indian IT companies with legacy SQL reporting needs')",
  "coreOffer": "Exactly what you deliver, format, timeframe",
  "pricing": { "min": 0, "max": 0, "currency": "CURRENCY", "model": "per project|monthly retainer|per unit|usage-based" },
  "pricing_inr": "realistic pricing for India market (e.g. '₹5,000–15,000/project' or '₹30,000/month retainer')",
  "monthlyEarnings": { "conservative": 0, "realistic": 0, "upside": 0, "currency": "CURRENCY" },
  "confidenceScore": 75,
  "timeToFirstRevenue": "7-10 days",
  "time_to_first_10k_inr": "realistic estimate (e.g. '2–4 months with consistent effort')",
  "startupCost": "₹0 - ₹5,000",
  "difficulty": "low|medium|high",
  "profileSignalsUsed": ["skill_1", "skill_2"],
  "first_client_channels": ["platform1", "platform2", "platform3"],
  "launchSprint": [
    {"day": "Day 1-2", "action": "Concrete action with specific tool"},
    {"day": "Day 3-5", "action": "Concrete action"},
    {"day": "Day 6-10", "action": "Concrete action"},
    {"day": "Day 11-14", "action": "Concrete action with first revenue target"}
  ],
  "customerChannels": ["channel1", "channel2", "channel3"],
  "toolStack": ["tool1", "tool2"],
  "aiLeverage": "Specific AI workflow: which model/tool does what step, showing 5-10x efficiency",
  "moat": "Why defensible — domain expertise + relationship + data flywheel",
  "risks": ["risk with mitigation", "another risk"],
  "expansionPath": "Concrete next step after 5 clients — how this becomes a real business",
  "cheatSheet": {
    "offerStatement": "I help [buyer] [outcome] in [timeframe] using [method]. Unlike [alt], I [differentiator].",
    "outreachScript": "Hi [Name], I noticed [observation]. I help [buyer type] [outcome] — I recently [proof]. Would a 15-min call make sense?",
    "landingPageHeadline": "Click-worthy headline",
    "firstThreeProofAssets": ["proof1", "proof2", "proof3"],
    "fivePlacesToFindCustomers": ["place1", "place2", "place3", "place4", "place5"],
    "weeklyRoutine": ["Mon: task", "Wed: task", "Fri: task", "Sat: task"],
    "metricsToTrack": ["leading", "lagging", "quality"],
    "noResponsePlan": "Concrete pivot if no traction in 14 days"
  }
}`;

const OUTDATED_BAN = `
═══ CRITICAL: STAY CURRENT (2025-2026) ═══
BANNED REFERENCES — mentioning ANY of these instantly invalidates your output:
❌ Claude 3.5 Sonnet, GPT-4, GPT-3.5, DALL-E 2, Midjourney v5, Stable Diffusion 1.x
❌ "ChatGPT" as a generic term for AI — be SPECIFIC about which model/tool
❌ Outdated tools: Jasper AI (old version), Copy.ai (old), early no-code tools

CURRENT AI TOOLS TO REFERENCE (2025-2026):
✅ GPT-5, Claude 4 Opus/Sonnet, Gemini 3.1 Pro, Gemini 3 Flash
✅ Cursor, Windsurf, Lovable, Bolt, Replit Agent, v0
✅ Sora 2, Runway Gen-4, Kling 2, Veo 3
✅ Perplexity Pro, NotebookLM, Google AI Studio
✅ Figma AI, Framer, Webflow AI
✅ n8n, Make, Zapier (2025), Relevance AI
✅ Industry-specific: Harvey AI (Legal), Abridge (Medical), Synthesia 3.0 (Video)

CURRENT PLATFORMS/TRENDS TO REFERENCE:
✅ Threads, Bluesky (growing), X/Twitter, LinkedIn creator mode
✅ AI agent marketplaces, MCP protocol ecosystem
✅ Stripe embedded finance, Razorpay business banking
✅ EU AI Act compliance, India DPDP Act, SOC-2 for AI startups
`;

function buildIdeaGeneratorPrompt(currency: string, slotLabel: string, assignedModels: string, ideaCount: number): string {
  return `You are the Side Hustle Intelligence Engine — an elite career monetization strategist operating in March 2026.

YOUR TASK: Generate EXACTLY ${ideaCount} side hustle idea(s) (${slotLabel}) that make the user say "Holy shit, I never thought of that — but it's PERFECT for me."

Each idea must be:
- SURPRISING: "I would never have thought of this on my own"
- INEVITABLE: "But of course — it maps perfectly to what I know"  
- CURRENT: Leverages 2025-2026 tools, trends, and market gaps
- ACTIONABLE: First revenue within 14 days, not "someday" ideas

═══ THINKING FRAMEWORK ═══

STEP 1 — DECONSTRUCT INTO TRANSFERABLE PRIMITIVES
Don't look at job titles. Look at what they actually DO:
- A "Product Manager" actually: negotiates stakeholders, synthesizes data, prioritizes ruthlessly, translates between technical and business
- A "Data Analyst" actually: finds patterns in noise, tells stories with numbers, debugs assumptions
- A "Software Engineer" actually: breaks complex systems into simple parts, automates repetitive work, thinks in edge cases
These PRIMITIVES transfer across industries in non-obvious ways.

STEP 2 — FIND THE 2026 INTERSECTION
Each idea must sit at: (their unique skills) × (what's changed in the last 6 months) × (what AI amplifies but can't replace)

Look for:
- New regulations creating compliance gaps (EU AI Act, DPDP, SOC-2 for AI)
- AI tools that are 6 months old but haven't been productized yet
- Industries that are JUST NOW adopting AI (construction, agriculture, legal, healthcare)
- Platform shifts creating arbitrage (MCP protocol, AI agent ecosystems)
- "The last mile" problems where AI gets 80% right but the 20% needs human expertise

STEP 3 — "WOULD A STRANGER PAY IN 48 HOURS?" TEST
If described to a stranger at their exact pain point, would they immediately understand the value?

═══ ANTI-GENERIC ENFORCEMENT ═══

INSTANTLY REJECT:
❌ "[Job title] consultant" ❌ "Create a course" ❌ "Start an agency" ❌ "Freelance [current job]"  
❌ "Newsletter" ❌ "Career coaching" ❌ "AI chatbot for X" (too generic)
❌ buyer = "businesses" or "companies" (too vague — WHO specifically?)
❌ core offer = what they already do at their day job
❌ Ideas that existed before 2024 without a NEW angle

NAMING RULES (CRITICAL):
❌ NO invented brand names: "FrictionMap Audits", "ResumeForge", "DataPulse Labs"
❌ NO compound buzzwords: "ScaleStack", "GrowthOS", "TalentLens"
✅ USE plain descriptive names that a 10-year-old understands
✅ Name should instantly tell someone WHAT the service is

GOOD 2026-ERA EXAMPLES:
✅ "QA engineer → AI Agent Testing Lab for SaaS Companies Shipping Agents"
✅ "Marketing manager → EU AI Act Compliance Audits for Ad-Tech Startups"
✅ "HR generalist → AI Interview Prep Reports for Job Seekers Facing AI Screeners"
✅ "Data analyst → Custom Dashboard Builds Using Cursor + Lovable for Non-Technical Founders"
✅ "Finance analyst → Automated Financial Model Updates for D2C Brands Using AI Agents"

${OUTDATED_BAN}

═══ CONSTRAINTS ═══
- Use these business model categories: ${assignedModels}
- Each idea needs: specific buyer with trigger event, ${currency} pricing, bounded earnings, 14-day sprint
- Tool stack must use CURRENT 2025-2026 tools (see list above)
- Include AI leverage angle showing 5-10x efficiency gain with SPECIFIC tool names
- MOAT: domain expertise + relationships + data flywheel — not just "first mover"
- CHEAT SHEET: copy-paste ready outreach scripts, offer statements, headlines

SCORING (apply internally):
personal_fit: 0.18 | trust_transfer: 0.14 | speed_to_first_revenue: 0.14 | demand_strength: 0.14
income_ceiling: 0.10 | startup_simplicity: 0.08 | uniqueness: 0.12 | repeatability: 0.06 | timing: 0.04

PENALTIES: genericity(-20), weak_profile_evidence(-15), duplicate_business_model(-10), outdated_tools(-25), vague_buyer(-15)

Return ONLY valid JSON: { "ideas": [${Array(ideaCount).fill(IDEA_SCHEMA.replace(/CURRENCY/g, currency)).join(", ")}] }`;
}

function buildWildcardPrompt(currency: string): string {
  return `You are a LATERAL THINKING specialist. Your job is to find the ONE side hustle idea that makes someone say "Wait, WHAT? ...oh wow, that's actually genius."

This idea must come from a COMPLETELY DIFFERENT DOMAIN than the person's current industry. 
The connection should be non-obvious but undeniable once explained.

THINK LIKE THIS:
- A software engineer's debugging skills → "Pre-Launch Safety Audit Reports for Physical Product Startups" (finding edge-case failures)
- A marketing manager's campaign skills → "Grant Application Writing Service for NGOs" (same persuasion, different buyer)
- An HR manager's people skills → "AI-Proof Career Transition Coaching for Factory Workers" (empathy + systems thinking)
- A data analyst's pattern recognition → "Pricing Optimization Reports for Etsy Sellers Leaving Money on the Table"
- A finance professional's modeling skills → "Unit Economics Health Checks for Pre-Seed Startups Preparing to Fundraise"

The LATERAL LEAP must:
1. Use a TRANSFERABLE PRIMITIVE from their background (not their job title)
2. Apply it to a buyer who would NEVER think to hire someone from their industry
3. Create a "trust bridge" — explain why their background is actually an ADVANTAGE
4. Be commercially viable within 14 days

${OUTDATED_BAN}

═══ CONSTRAINTS ═══
- Business model: any (productized_service, tooling, template, micro_agency, data_arbitrage, ai_wrapper, community, marketplace, local_service, content_plus_service)
- ${currency} pricing, bounded earnings, 14-day sprint
- This idea should feel like it came from a DIFFERENT UNIVERSE but makes perfect sense
- MUST include a "Why my background is actually perfect for this" explanation

Return ONLY valid JSON: { "ideas": [${IDEA_SCHEMA.replace(/CURRENCY/g, currency)}] }`;
}

function buildMindBendingPrompt(currency: string): string {
  return `You are an INNOVATION FUTURIST who finds commercially viable opportunities at the bleeding edge of culture, technology, and human behavior — operating in March 2026.

Your job: Find the ONE side hustle idea that makes the person laugh, then immediately open a notes app to start planning. It should feel like a fever dream that actually makes money.

THE VIBE: Fun but realistic. Commercially viable within 6 months. The kind of idea you'd tell friends at a dinner party and they'd say "That's insane... wait, would that actually work? ...holy shit it would."

THINK AT THE INTERSECTION OF:
- Emerging cultural behaviors + their skills (e.g., a finance person → "AI Sommelier: Personalized Wine Portfolio Recommendations Using Financial Risk Models")
- Counterintuitive applications (e.g., a project manager → "Wedding Day Crisis Commander: Real-Time Operations Management for High-Budget Weddings Using PM Tools")  
- Things people secretly want but don't know how to ask for (e.g., a data analyst → "Personal Life Dashboard: Weekly Reports on Your Habits, Spending, and Goals Like a Board Deck for Your Own Life")
- New behaviors created by AI/tech shifts that need human curation (e.g., "AI Output Editor: Quality Control for Companies Drowning in AI-Generated Content")
- Absurd-sounding niches that are actually massive markets

RULES:
1. Must use a REAL skill from their profile — the connection should be surprising but undeniable
2. Must make the person SMILE when they read it — inject personality and wit
3. Must be commercially viable — real buyers, real pricing, first revenue within 30 days
4. Must feel like something NO career advisor would ever suggest
5. The idea name itself should be memorable and fun — something you'd put on a business card with pride

${OUTDATED_BAN}

═══ CONSTRAINTS ═══
- Business model: any
- ${currency} pricing, bounded earnings
- Time to first revenue: under 30 days
- Include a "Why this is actually a genius move" explanation in whyThisFits
- The whyNow must cite a specific 2025-2026 cultural or tech trend

Return ONLY valid JSON: { "ideas": [${IDEA_SCHEMA.replace(/CURRENCY/g, currency)}] }`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const cors = getCorsHeaders(req);

  // Server-side Pro subscription check
  const subGuard = await requirePro(req);
  if (subGuard) return subGuard;

  try {
    const blocked = guardRequest(req, cors);
    if (blocked) return blocked;

    const { userId: _jwtUserId, blocked: jwtBlocked } = await validateJwtClaims(req, cors);
    if (jwtBlocked) return jwtBlocked;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const spendCheck = await checkDailySpending("generate-side-hustles");
    if (!spendCheck.allowed) return buildSpendingBlockedResponse(cors, spendCheck);

    const body = await req.json();
    const { report, country, constraints } = body;

    if (!report) {
      return new Response(JSON.stringify({ error: "Missing report data" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const startMs = Date.now();

    // ═══ EXTRACT PROFILE CONTEXT ═══
    const role = report.role || "Professional";
    const industry = report.industry || "Technology";
    const skills = [
      ...(report.all_skills || []),
      ...(report.execution_skills || []),
      ...(report.strategic_skills || []),
      ...(report.moat_skills || []),
    ].filter(Boolean);
    const uniqueSkills = [...new Set(skills)].slice(0, 30);
    const tools = (report.ai_tools_replacing || []).map((t: any) =>
      typeof t === "string" ? t : t.tool_name
    );
    const seniorityTier = report.seniority_tier || "PROFESSIONAL";
    const yearsExp = report.years_experience || "3-5";
    const linkedinName = report.linkedin_name || "";
    const linkedinCompany = report.linkedin_company || "";
    const moatSkills = report.moat_skills || [];
    const cogMoat = report.cognitive_moat || "";
    const geoAdvantage = report.geo_advantage || "";
    const automationRisk = report.automation_risk ?? (report.determinism_index ?? 50);
    const executionSkills = report.execution_skills || [];
    const strategicSkills = report.strategic_skills || [];
    const topContributors = report.top_contributors || [];
    const aiAugmentation = report.ai_augmentation_potential || "";
    const salaryBleed = report.salary_bleed_monthly || 0;
    const monthsRemaining = report.months_remaining || 36;

    const hoursPerWeek = constraints?.hoursPerWeek || "10-15";
    const budget = constraints?.budget || "Low (under ₹10,000)";
    const riskTolerance = constraints?.riskTolerance || "moderate";
    const preferredModel = constraints?.preferredModel || "no preference";
    const avoidModels = constraints?.avoidModels || [];
    const remotePreference = constraints?.remotePreference || "both";

    const locationCountry = country || "IN";
    const currency = locationCountry === "IN" ? "INR (₹)" : locationCountry === "US" ? "USD ($)" : locationCountry === "AE" ? "AED" : locationCountry === "GB" ? "GBP (£)" : locationCountry === "SG" ? "SGD" : "INR (₹)";

    const profileContext = `
═══ PROFESSIONAL INTELLIGENCE DOSSIER (March 2026) ═══

IDENTITY: ${linkedinName || "User"} | ${role} | ${linkedinCompany || "N/A"} | ${industry} | ${seniorityTier} | ${yearsExp} yrs

CRITICAL: The user's EXACT job title is "${role}". NEVER inflate, upgrade, or rename this title in ANY output. Do NOT call a "Manager" a "Director", do NOT call an "Analyst" a "Lead", do NOT call an "Engineer" an "Architect". Use "${role}" VERBATIM whenever referencing their current role.

THREAT LANDSCAPE: AI Risk ${automationRisk}% | Salary bleed: ${salaryBleed > 0 ? `₹${salaryBleed.toLocaleString()}/mo` : "N/A"} | ${monthsRemaining} months runway | Tools threatening role: ${tools.join(", ") || "None identified"}

SKILL INVENTORY: ${uniqueSkills.join(", ")}
MOAT SKILLS (hardest to automate): ${moatSkills.join(", ") || "None identified"} 
EXECUTION SKILLS: ${executionSkills.join(", ") || "N/A"} | STRATEGIC: ${strategicSkills.join(", ") || "N/A"}
COGNITIVE MOAT: ${cogMoat || "N/A"} | GEO ADVANTAGE: ${geoAdvantage || "None"} | AI AUGMENTATION POTENTIAL: ${aiAugmentation || "Moderate"}

RISK FACTORS: ${topContributors.length > 0 ? topContributors.map((c: any) => `${c.factor || c}`).join(", ") : "Standard"}

CONSTRAINTS: ${locationCountry} | ${currency} | ${hoursPerWeek} hrs/wk | Budget: ${budget} | Risk appetite: ${riskTolerance} | Model pref: ${preferredModel} | Avoid: ${avoidModels.join(", ") || "none"} | Remote: ${remotePreference}
`;

    // ═══ STAGE 1: LATERAL SCOUT (Flash ~10s) ═══
    console.log(`[SideHustle] Stage 1: LateralScout starting...`);
    const lateralPrompt = `You are a lateral-thinking opportunity scout operating in March 2026. Identify 8 NON-OBVIOUS opportunity vectors for this professional.

DO NOT suggest the obvious. Think laterally using 2026 market context:
1. CROSS-DOMAIN TRANSFER: Adjacent industries desperately needing their skills (especially industries just NOW adopting AI)
2. ARBITRAGE PLAYS: Knowledge/pricing gaps to exploit — what do they know that's worth ₹50K to someone in another industry?
3. AI-AMPLIFIED SERVICES: Domain expertise + 2026 AI tools (GPT-5, Claude 4, Gemini 3.1, Cursor, Lovable) = 10x value delivery
4. REGULATION ARBITRAGE: New regulations (EU AI Act, DPDP, SOC-2 for AI) creating compliance gaps only domain experts can fill
5. REVERSE DISRUPTION: Sell the AI transition itself as a deliverable — help others navigate what's happening to THEIR industry
6. PLATFORM TIMING: 2025-2026 platform shifts (MCP protocol, AI agents, embedded AI) creating first-mover windows
7. MICRO-MONOPOLY: Ultra-specific niche they can own within 30 days (e.g., "the person who does X for Y")
8. LATERAL LEAP: Completely different industry where a transferable primitive from their background is uniquely valuable

${OUTDATED_BAN}

Return JSON: { "vectors": [ { "type": "string", "insight": "string", "buyer": "string", "rawIdea": "string" } ] }`;

    const lateralMap = await callAgent(
      apiKey, "LateralScout", lateralPrompt, profileContext,
      FLASH_MODEL, 0.7, 25_000,
    );

    const vectors = lateralMap?.vectors || [];
    console.log(`[SideHustle] Stage 1 complete: ${vectors.length} vectors in ${Date.now() - startMs}ms`);

    const formatVectors = (vecs: any[]) => vecs.length > 0
      ? vecs.map((v: any, i: number) => `${i + 1}. [${v.type}] ${v.rawIdea} → Buyer: ${v.buyer} | ${v.insight}`).join("\n")
      : "Use profile analysis to identify opportunities";

    // Split vectors
    const vectorsA = vectors.slice(0, Math.ceil(vectors.length / 2));
    const vectorsB = vectors.slice(Math.ceil(vectors.length / 2));
    const lateralVectors = vectors.filter((v: any) => 
      v.type?.toLowerCase().includes("lateral") || v.type?.toLowerCase().includes("cross-domain")
    );

    // ═══ STAGE 2: TWO PARALLEL CALLS FOR DEEPENED IDEAS ═══
    console.log(`[SideHustle] Stage 2: Launching 2 parallel calls...`);

    const modelGroupA = "productized_service, tooling, template, ai_wrapper, data_arbitrage";
    const modelGroupB = "micro_agency, local_service, content_plus_service, community";

    const contextA = `${profileContext}\n\nLATERAL VECTORS (use as inspiration):\n${formatVectors(vectorsA)}`;
    const contextB = `${profileContext}\n\nLATERAL VECTORS (use as inspiration):\n${formatVectors(vectorsB)}`;

    const promptA = buildIdeaGeneratorPrompt(currency, "Slot A — scalable/product/AI-native ideas using 2026 tools (2 ideas)", modelGroupA, 2);
    const promptB = buildIdeaGeneratorPrompt(currency, "Slot B — service/community ideas leveraging human+AI hybrid (1 idea)", modelGroupB, 1);

    const [resultA, resultB] = await Promise.all([
      callAgent(apiKey, "SideHustle-A", promptA, contextA, PRO_MODEL, 0.4, 60_000),
      callAgent(apiKey, "SideHustle-B", promptB, contextB, PRO_MODEL, 0.5, 60_000),
    ]);

    console.log(`[SideHustle] Stage 2 complete in ${Date.now() - startMs}ms | A: ${resultA?.ideas?.length || 0}, B: ${resultB?.ideas?.length || 0}`);

    // ═══ STAGE 3: MERGE & SELECT BEST 3 ═══
    const slotAIdeas: any[] = resultA?.ideas || [];
    const slotBIdeas: any[] = resultB?.ideas || [];
    const allIdeas = [...slotAIdeas, ...slotBIdeas];

    if (allIdeas.length === 0) {
      console.warn(`[SideHustle] All calls failed, emergency Flash fallback...`);
      const emergencyPrompt = buildIdeaGeneratorPrompt(currency, "generate 3 cutting-edge 2026 ideas", `${modelGroupA}, ${modelGroupB}`, 3);
      const emergencyCtx = `${profileContext}\n\nLATERAL VECTORS:\n${formatVectors(vectors)}`;
      const emergency = await callAgent(apiKey, "SideHustle-Emergency", emergencyPrompt, emergencyCtx, FLASH_MODEL, 0.5, 45_000);

      if (!emergency?.ideas?.length) {
        return new Response(JSON.stringify({ error: "Failed to generate ideas" }), {
          status: 500, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        executiveSummary: `Based on your ${uniqueSkills.slice(0, 3).join(", ")} expertise in ${industry}, we've identified ${emergency.ideas.length} high-potential opportunities using 2026 market intelligence.`,
        profileFactorsUsed: uniqueSkills.slice(0, 6),
        ideas: emergency.ideas.slice(0, 3),
      }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Selection: pick 3 best ideas, preferring diversity
    const selected: any[] = [];
    const sorted = [...allIdeas].sort((a, b) => (b.confidenceScore || 70) - (a.confidenceScore || 70));
    const seenModels = new Set<string>();

    // First pass: pick diverse ideas by business model
    for (const idea of sorted) {
      if (selected.length >= 3) break;
      const model = idea.businessModel || "unknown";
      if (!seenModels.has(model)) {
        seenModels.add(model);
        selected.push(idea);
      }
    }

    // Second pass: fill remaining slots by score
    for (const idea of sorted) {
      if (selected.length >= 3) break;
      if (!selected.includes(idea)) selected.push(idea);
    }

    const summarySkills = uniqueSkills.slice(0, 3).join(", ");
    const executiveSummary = resultA?.executiveSummary || resultB?.executiveSummary ||
      `Your ${summarySkills} expertise in ${industry} opens doors most people can't see. We've mapped 3 high-potential opportunity vectors using March 2026 market intelligence — each tailored to your profile and vetted for realistic execution.`;

    const finalReport = {
      executiveSummary,
      profileFactorsUsed: [
        ...new Set([
          ...(resultA?.profileFactorsUsed || []),
          ...(resultB?.profileFactorsUsed || []),
          ...uniqueSkills.slice(0, 4),
        ]),
      ].slice(0, 8),
      ideas: selected.slice(0, 3),
    };

    console.log(`[SideHustle] ✅ Complete in ${Date.now() - startMs}ms | ${selected.length} ideas from ${allIdeas.length} candidates`);

    return new Response(JSON.stringify(finalReport), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[generate-side-hustles] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

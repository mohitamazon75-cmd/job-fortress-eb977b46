import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { callAgent, PRO_MODEL, FLASH_MODEL } from "../_shared/ai-agent-caller.ts";

// ═══════════════════════════════════════════════════════════════
// STARTUP AUTOPSY ENGINE v2 — 4-STAGE FORENSIC ANALYSIS
// Stage 0: CLARIFY  → Structure vague input into proper idea DNA
// Stage 1: DECOMPOSE → Break idea into structural DNA  
// Stage 2: AUTOPSY   → Find similar dead startups
// Stage 3: SCORE     → Death probability + Don't Die Playbook
//          + ALWAYS generate 3 better alternatives (1 lateral)
// ═══════════════════════════════════════════════════════════════

const CLARIFY_PROMPT = `You are a startup idea interpreter. The user has described a startup idea — possibly vaguely, informally, or incompletely. Your job is to extract the BEST POSSIBLE structured interpretation.

RULES:
- If the input is vague, INFER reasonable defaults based on the idea's domain
- Use the founder's professional background to fill gaps (e.g., if they're a marketing manager building an AI app, infer they'll handle GTM themselves)
- Never ask for clarification — just make smart inferences
- Be generous but realistic in interpretation

Return ONLY valid JSON:
{
  "clarified_idea": "A clear, specific 2-3 sentence description of what this startup does",
  "inferred_product": "What the actual product/service is",
  "inferred_customer": "Who would pay for this",
  "inferred_revenue_model": "How it makes money",
  "inferred_tech": "What technology it likely uses",
  "inferred_differentiator": "What makes it unique based on the description",
  "confidence": "high|medium|low",
  "gaps_filled": ["list of things you had to infer because the user didn't specify"]
}`;

const DECOMPOSE_PROMPT = `You are an experienced startup strategist who evaluates ideas objectively. Decompose the startup idea into its structural DNA — identifying both strengths and vulnerabilities with equal weight.

Respond ONLY with valid JSON. No markdown, no backticks, no preamble.
{
  "startup_dna": {
    "name_or_concept": "",
    "one_liner": "What it does in one sentence",
    "market_category": "e.g. B2B SaaS, consumer marketplace, fintech",
    "target_customer": "Specific persona",
    "value_proposition": "Core promise",
    "revenue_model": "How it makes money",
    "key_assumptions": ["3-5 assumptions that MUST be true for this to work"],
    "tech_complexity": "low|medium|high|extreme",
    "network_effects": true,
    "regulatory_risk": "none|low|medium|high",
    "capital_intensity": "bootstrappable|moderate|capital_heavy",
    "competitive_landscape": "blue_ocean|emerging|crowded|dominated",
    "moat_type": "none|data|network|brand|tech|regulatory|switching_cost"
  },
  "founder_context": {
    "relevant_skills": ["extracted from their background"],
    "domain_expertise_level": "outsider|adjacent|deep|world_class",
    "unfair_advantages": ["what they specifically bring"],
    "blind_spots": ["likely gaps based on their background"]
  },
  "critical_vectors": ["5 dimensions where this startup is most likely to die"]
}`;

const buildFindDeadPrompt = (dna: any) => `You are a startup forensics investigator. Search for startups that attempted something SIMILAR to this idea and FAILED or struggled significantly.

STARTUP DNA:
${JSON.stringify(dna, null, 2)}

Search for:
1. Startups in the same market category that shut down or pivoted dramatically
2. Similar value propositions that failed to gain traction  
3. Companies that tried the same revenue model in this space
4. YC/TechStars companies in this space that died
5. Well-funded startups that burned through capital in adjacent spaces

For EACH dead/struggling startup found, analyze WHY it failed — not surface-level ("ran out of money") but the ROOT CAUSE.

Respond ONLY with valid JSON. No markdown.
{
  "dead_startups": [
    {
      "name": "",
      "what_they_did": "",
      "funding_raised": "",
      "years_active": "",
      "root_cause_of_death": "",
      "failure_category": "market_timing|no_pmf|bad_unit_economics|team_dysfunction|competition_crushed|regulation|tech_debt|scaling_too_fast|wrong_customer|distribution_failure",
      "warning_signs_they_missed": [""],
      "similarity_to_your_idea": "low|medium|high|near_identical",
      "key_lesson": ""
    }
  ],
  "pattern_analysis": {
    "most_common_death_cause": "",
    "graveyard_density": "few_died|moderate_casualties|mass_extinction",
    "survivor_traits": ["What the survivors in this space did differently"],
    "timing_signal": "too_early|bad_timing|good_timing|late_but_possible"
  }
}`;

const buildScorePrompt = (dna: any, dead: any) => `You are the world's most experienced startup advisor. You evaluate ideas OBJECTIVELY — acknowledging both strengths and risks with equal weight.

STARTUP DNA:
${JSON.stringify(dna, null, 2)}

AUTOPSY FINDINGS (similar failed startups):
${JSON.stringify(dead, null, 2)}

TASK 1 — SURVIVAL PROBABILITY SCORING:
Score overall_survival_probability on a CALIBRATED scale:
- 70-90%: Strong idea with clear market demand, good founder-market fit, proven business model.
- 50-70%: Decent idea with some risk vectors but workable.
- 30-50%: Significant structural risks.
- 10-30%: Fundamental flaws.
- Below 10%: Physically impossible or illegal.

CALIBRATION:
- Most REASONABLE startup ideas from someone with relevant skills should score 45-75%.
- Factor in the founder's STRENGTHS — domain expertise significantly boosts survival odds.
- The existence of dead competitors validates market demand. Focus on WHETHER this founder can avoid specific failure modes.

TASK 2 — "DON'T DIE" PLAYBOOK:
For each high-risk vector, provide a SPECIFIC, ACTIONABLE counter-strategy.

RULES:
- Be honest and balanced. Acknowledge genuine strengths alongside risks.
- Every recommendation must reference a SPECIFIC dead startup's mistake
- Include at least 2 "non-obvious kills"
- anti_patterns: exactly 5 items
- playbook_phases: exactly 3 phases, each with 3 actions

Respond ONLY with valid JSON.
{
  "death_score": {
    "overall_survival_probability": 0,
    "strength_factors": ["2-3 genuine strengths"],
    "vectors": [
      {
        "vector": "failure category name",
        "risk_level": 0,
        "dead_startup_reference": "which dead startup died this way",
        "your_exposure": "why YOU are vulnerable",
        "mitigation": "specific action to avoid this death"
      }
    ],
    "non_obvious_kills": [
      {"threat": "", "why_hidden": "", "how_to_detect_early": "", "escape_plan": ""}
    ]
  },
  "dont_die_playbook": {
    "survival_thesis": "One sentence: the #1 thing that will determine if this lives or dies",
    "anti_patterns": [
      {"pattern": "what killed others", "your_version": "how you'd do the same thing", "antidote": "exact opposite behavior"}
    ],
    "playbook_phases": [
      {
        "phase": "Validate (Week 1-4)",
        "objective": "",
        "actions": [
          {"action": "", "tool_or_method": "", "success_metric": "", "dead_startup_lesson": ""}
        ],
        "kill_switch": "If X doesn't happen by week 4, pivot or kill"
      }
    ],
    "pivot_triggers": [
      {"signal": "", "threshold": "", "pivot_direction": ""}
    ],
    "competitive_immunization": {
      "if_big_tech_copies_you": "",
      "if_funded_competitor_appears": "",
      "if_market_shifts": ""
    },
    "founder_warnings": ["3 things specific to THIS founder's blind spots"]
  },
  "verdict": {
    "go_no_go": "GO|CAUTIOUS_GO|PIVOT_FIRST|DONT_DO_THIS",
    "confidence": 0,
    "one_line_verdict": "",
    "if_you_must_do_this": "The single most important thing to do first"
  }
}`;

const buildAlternativesPrompt = (dna: any, dead: any, founderCtx: string) => `You are an elite startup ideation engine operating in March 2026. Based on the founder's background and the analysis of their original idea (including what killed similar startups), generate EXACTLY 3 BETTER startup ideas.

ORIGINAL IDEA DNA:
${JSON.stringify(dna?.startup_dna || {}, null, 2)}

WHAT KILLED SIMILAR STARTUPS:
${JSON.stringify(dead?.pattern_analysis || {}, null, 2)}

FOUNDER CONTEXT:
${founderCtx}

═══ THE 3 IDEAS MUST BE: ═══

IDEA 1 — SAFER BET: Same domain/market as their original idea, but restructured to AVOID the specific death vectors found in the graveyard. This is "your idea, but built to survive."

IDEA 2 — ADJACENT OPPORTUNITY: Related market but different angle. Uses the same core skills but attacks a problem with better unit economics or less competition. Think "one step sideways."

IDEA 3 — LATERAL WILDCARD 🎲: A COMPLETELY DIFFERENT industry/domain where the founder's transferable skills create unexpected value. The connection should be non-obvious but undeniable once explained. This should make them say "Wait, WHAT? ...oh wow, that's actually genius."

═══ RULES ═══
- Each idea must be SPECIFIC — not "start a consulting firm" or "build an AI tool"
- Include 2026-era tools and trends (GPT-5, Claude 4, Gemini 3.1, Cursor, Lovable, MCP protocol, EU AI Act, DPDP)
- Each idea must have a concrete first step achievable in 7 days
- Pricing in the founder's local currency
- Plain English names — NO invented brand names, NO compound buzzwords
- The lateral wildcard MUST come from a genuinely different domain

Return ONLY valid JSON:
{
  "alternatives": [
    {
      "idea_name": "Clear descriptive name",
      "idea_type": "safer_bet|adjacent|lateral_wildcard",
      "emoji": "relevant emoji",
      "one_liner": "What it does in one sentence",
      "why_better": "Why this has higher survival odds than the original idea",
      "death_vectors_avoided": ["which specific failure modes from the graveyard this avoids"],
      "target_customer": "Specific buyer persona",
      "revenue_model": "How it makes money",
      "estimated_monthly_revenue": "Conservative range after 6 months",
      "startup_cost": "What you need to spend to start",
      "time_to_first_revenue": "Realistic timeline",
      "founder_fit_reason": "Why THIS founder specifically can pull this off",
      "lateral_connection": "For wildcard only — the non-obvious skill transfer explanation",
      "first_week_sprint": [
        "Day 1-2: specific action",
        "Day 3-4: specific action", 
        "Day 5-7: specific action"
      ],
      "tools_2026": ["Specific 2026-era tools to use"],
      "survival_probability": 0
    }
  ]
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const cors = getCorsHeaders(req);

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { idea, background, founderProfile } = await req.json();
    if (!idea || idea.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Please describe your startup idea (at least 10 characters)" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const startMs = Date.now();

    // Build founder context
    const founderCtx = founderProfile
      ? `${founderProfile.role || "Professional"} at ${founderProfile.company || "N/A"} in ${founderProfile.industry || "Technology"} with ${founderProfile.yearsExp || "3-5"} years experience. Skills: ${(founderProfile.skills || []).join(", ")}. Moat skills: ${(founderProfile.moatSkills || []).join(", ")}.`
      : (background || "No background provided");

    // ═══ STAGE 0: CLARIFY VAGUE INPUT (Flash ~5s) ═══
    const ideaWordCount = idea.trim().split(/\s+/).length;
    let structuredIdea = idea;
    let clarification: any = null;

    if (ideaWordCount < 25) {
      console.log(`[StartupAutopsy] Stage 0: Clarifying vague input (${ideaWordCount} words)...`);
      clarification = await callAgent(
        apiKey, "Autopsy-Clarify", CLARIFY_PROMPT,
        `USER INPUT: "${idea}"\n\nFOUNDER BACKGROUND: ${founderCtx}\n\nInterpret this idea generously but realistically. Return ONLY JSON.`,
        FLASH_MODEL, 0.3, 15_000,
      );
      if (clarification?.clarified_idea) {
        structuredIdea = `${clarification.clarified_idea}\nProduct: ${clarification.inferred_product || idea}\nCustomer: ${clarification.inferred_customer || "TBD"}\nRevenue: ${clarification.inferred_revenue_model || "TBD"}\nTech: ${clarification.inferred_tech || "TBD"}\nDifferentiator: ${clarification.inferred_differentiator || "TBD"}`;
        console.log(`[StartupAutopsy] Stage 0 complete in ${Date.now() - startMs}ms: ${clarification.confidence} confidence`);
      }
    }

    const userContext = `STARTUP IDEA:\n${structuredIdea}\n\nFOUNDER BACKGROUND: ${founderCtx}\n\nDecompose into structured DNA. Return ONLY JSON.`;

    // ═══ STAGE 1: DECOMPOSE DNA (Flash ~8s) ═══
    console.log(`[StartupAutopsy] Stage 1: Decomposing DNA...`);
    const dna = await callAgent(
      apiKey, "Autopsy-Decompose", DECOMPOSE_PROMPT, userContext,
      FLASH_MODEL, 0.3, 30_000,
    );

    if (!dna?.startup_dna) {
      return new Response(JSON.stringify({ error: "Failed to decompose idea. Try adding more detail." }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    console.log(`[StartupAutopsy] Stage 1 complete in ${Date.now() - startMs}ms: ${dna.startup_dna.name_or_concept}`);

    // ═══ STAGE 2: FIND DEAD STARTUPS (Pro ~30s) ═══
    console.log(`[StartupAutopsy] Stage 2: Searching graveyard...`);
    const findDeadSys = "You are a startup forensics investigator with deep knowledge of startup failures across all industries. Find real examples of failed startups similar to the one described. Use your knowledge of well-known startup failures, YC postmortems, and industry case studies. Respond ONLY with valid JSON.";
    const dead = await callAgent(
      apiKey, "Autopsy-Graveyard", findDeadSys, buildFindDeadPrompt(dna),
      PRO_MODEL, 0.4, 60_000,
    );

    const deadData = dead?.dead_startups?.length > 0 ? dead : {
      dead_startups: [],
      pattern_analysis: {
        most_common_death_cause: "Insufficient data — limited similar failures found",
        graveyard_density: "few_died",
        survivor_traits: [],
        timing_signal: "unclear",
      },
    };
    console.log(`[StartupAutopsy] Stage 2 complete in ${Date.now() - startMs}ms: ${deadData.dead_startups?.length || 0} dead startups`);

    // ═══ STAGE 3: SCORE + PLAYBOOK + ALTERNATIVES (parallel Pro calls) ═══
    console.log(`[StartupAutopsy] Stage 3: Scoring + generating alternatives in parallel...`);
    
    const scoreSys = "You are an objective startup advisor who evaluates ideas fairly — weighing both strengths and risks. You calibrate survival probability realistically: most reasonable ideas from skilled founders score 45-75%. Respond ONLY with valid JSON, no markdown, no backticks.";
    const altSys = "You are an elite startup ideation engine. Generate 3 better startup alternatives: 1 safer version, 1 adjacent pivot, and 1 lateral wildcard from a completely different domain. Each must be specific, actionable, and use 2026-era tools. Respond ONLY with valid JSON.";

    const [playbook, alternatives] = await Promise.all([
      callAgent(apiKey, "Autopsy-Score", scoreSys, buildScorePrompt(dna, deadData), PRO_MODEL, 0.3, 60_000),
      callAgent(apiKey, "Autopsy-Alternatives", altSys, buildAlternativesPrompt(dna, deadData, founderCtx), PRO_MODEL, 0.5, 60_000),
    ]);

    if (!playbook) {
      return new Response(JSON.stringify({ error: "Failed to generate playbook. Please retry." }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Tag lateral wildcard
    const alts = alternatives?.alternatives || [];
    for (const alt of alts) {
      if (alt.idea_type === 'lateral_wildcard') {
        alt._isWildcard = true;
      }
    }

    console.log(`[StartupAutopsy] ✅ Complete in ${Date.now() - startMs}ms | Verdict: ${playbook.verdict?.go_no_go} | Alternatives: ${alts.length}`);

    return new Response(JSON.stringify({
      dna,
      dead: deadData,
      playbook,
      alternatives: alts,
      clarification: clarification ? {
        original_input: idea,
        interpreted_as: clarification.clarified_idea,
        confidence: clarification.confidence,
        gaps_filled: clarification.gaps_filled,
      } : null,
    }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[startup-autopsy] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

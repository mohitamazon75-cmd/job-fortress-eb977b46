// ═══════════════════════════════════════════════════════════════
// Resume Weaponizer — AI rewrites resume to exploit exact gaps
// found in the scan, optimized for ATS + human reviewers.
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { callAgent, AI_URL, PRO_MODEL } from "../_shared/ai-agent-caller.ts";
import { callAgentWithFallback } from "../_shared/model-fallback.ts";
import { checkDailySpending, buildSpendingBlockedResponse } from "../_shared/spending-guard.ts";
import { requirePro } from "../_shared/subscription-guard.ts";

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

const SYSTEM_PROMPT = `You are the RESUME WEAPONIZER — an elite career strategist who rewrites resumes to exploit the exact vulnerabilities an AI career scan has identified. You don't write generic resumes. You write strategic documents that:

1. COUNTER every AI automation threat by showcasing human-only capabilities
2. AMPLIFY moat skills that ATS systems and hiring managers prioritize
3. INJECT high-demand keywords that bridge identified skill gaps
4. FRAME experience to maximize perceived value in the current market

Return ONLY valid JSON:

{
  "professional_summary": "string — 3-4 sentence power summary that positions against AI threats",
  "key_skills_section": {
    "headline_skills": ["string — top 6 ATS-optimized skills to feature prominently"],
    "strategic_keywords": ["string — additional keywords to weave throughout"],
    "skills_to_remove": ["string — skills that HURT your positioning and why"]
  },
  "experience_bullets": [
    {
      "context": "string — what role/company this bullet is for",
      "original_framing": "string — how most people describe this",
      "weaponized_bullet": "string — the rewritten bullet with impact metrics",
      "annotation": "string — one-line explanation of why this rewrite works (e.g., 'Leads with measurable outcome, uses active verb, adds specificity')",
      "why_better": "string — what ATS/hiring signal this triggers"
    }
  ],
  "new_sections_to_add": [
    {
      "section_title": "string — e.g. 'AI Augmentation Projects', 'Strategic Impact'",
      "why": "string — what gap this fills",
      "sample_entries": ["string — 2-3 example entries"]
    }
  ],
  "ats_optimization": {
    "score_estimate_before": number (0-100),
    "score_estimate_after": number (0-100),
    "critical_keywords_added": ["string"],
    "format_tips": ["string — ATS formatting rules to follow"]
  },
  "positioning_strategy": "string — the overarching narrative strategy (2-3 sentences)",
  "cover_letter_hook": "string — a powerful opening line for cover letters that leverages your unique positioning"
}

RULES:
- Every bullet must use the STAR method: Situation → Task → Action → Result with QUANTIFIED impact.
- Use power verbs: Orchestrated, Spearheaded, Architected, Catalyzed — NOT "Responsible for" or "Helped with".
- ATS keywords must be drawn from REAL job postings for the target role.
- skills_to_remove must explain WHY — e.g., "Excel → signals manual work, replace with 'Data-Driven Decision Making'"
- experience_bullets should show 5-8 rewritten bullets covering different aspects.
- For each bullet, include an 'annotation' that explains WHY the rewrite works in 1 concise sentence (e.g., "Leads with measurable outcome (22%), uses active verb (Architected), removes passive voice").
- Be ruthlessly specific. No generic advice. Every word must earn its place.
- Reference 2025-2026 market context for keyword relevance.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  // Server-side Pro subscription check
  const subGuard = await requirePro(req);
  if (subGuard) return subGuard;

  const blocked = guardRequest(req, corsHeaders);
  if (blocked) return blocked;

  const { userId, blocked: jwtBlocked } = await validateJwtClaims(req, corsHeaders);
  if (jwtBlocked) return jwtBlocked;

  // Spending guard
  const spendCheck = await checkDailySpending("resume-weaponizer");
  if (!spendCheck.allowed) return buildSpendingBlockedResponse(corsHeaders, spendCheck);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { report, targetRole } = body;
  if (!report) {
    return new Response(JSON.stringify({ error: "Missing report" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const role = report.current_role || report.role_detected || report.role || "Professional";
  const industry = report.industry || "Technology";
  const seniority = report.seniority_tier || "PROFESSIONAL";
  const allSkills = (report.all_skills || []).join(", ");
  const moatSkills = (report.moat_skills || []).join(", ");
  const deadSkills = (report.execution_skills_dead || []).join(", ");
  const tools = (report.ai_tools_replacing || []).map((t: any) => typeof t === "string" ? t : t.tool_name).join(", ");
  const gaps = (report.skill_gap_map || []).map((g: any) => `${g.skill}: ${g.gap_level}`).join(", ");
  const pivots = (report.pivot_roles || []).map((p: any) => typeof p === "string" ? p : p.role).join(", ");
  const di = report.determinism_index ?? 50;
  const company = report.company_detected || "Current Company";
  const metro = report.metro_tier || "tier1";

  // Cache check
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const cacheKey = `rw:${role}_${industry}_${allSkills.slice(0, 30)}_${targetRole || "same"}`.toLowerCase().replace(/\s+/g, '_');
  try {
    const { data: cached } = await supabase
      .from("enrichment_cache")
      .select("data, cached_at")
      .eq("cache_key", cacheKey)
      .single();
    if (cached && Date.now() - new Date(cached.cached_at).getTime() < CACHE_TTL_MS) {
      console.log(`[ResumeWeaponizer] Cache hit for ${role}`);
      return new Response(JSON.stringify({ ...cached.data as object, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch { /* cache miss */ }

  console.log(`[ResumeWeaponizer] Starting for ${role} in ${industry}, user ${userId}`);

  try {
    const userPrompt = `
═══ SCAN INTELLIGENCE BRIEFING ═══
Current Role: ${role}
Company: ${company}
Industry: ${industry}
Seniority: ${seniority}
Location Tier: ${metro}
Target Role: ${targetRole || role + " (same role, stronger positioning)"}

═══ THREAT ANALYSIS ═══
Determinism Index: ${di}/100 (how automatable this role is)
AI Tools Threatening This Role: ${tools || "None detected"}
Skills Being Automated: ${deadSkills || "None flagged"}

═══ STRENGTH ANALYSIS ═══
Human Moat Skills (AI-proof): ${moatSkills || "None identified"}
All Current Skills: ${allSkills || "Not specified"}
Identified Skill Gaps: ${gaps || "None mapped"}
Suggested Safer Pivot Roles: ${pivots || "None"}

═══ MISSION ═══
Rewrite this person's resume to:
1. HIDE vulnerabilities — reframe automatable skills as human-augmented capabilities
2. AMPLIFY moat skills — make them the headline narrative
3. BRIDGE gaps — add keywords for skills they should be developing
4. POSITION for ${targetRole || "maximum market value"} in ${metro === 'tier1' ? 'Tier 1 metro (Bangalore/Mumbai/Delhi NCR)' : 'Tier 2 city'} India market, 2025-2026

The resume should make a hiring manager think: "This person is ALREADY adapting to AI — they're ahead of the curve."
`;

    const fallbackResult = await callAgentWithFallback(
      apiKey,
      "ResumeWeaponizer",
      SYSTEM_PROMPT,
      userPrompt,
      "google/gemini-3.1-pro-preview",
      0.5,
      60_000,
    );
    const result = fallbackResult.data;
    console.log(`[ResumeWeaponizer] Completed on ${fallbackResult.model_used} (${fallbackResult.latency_ms}ms, chain: ${fallbackResult.fallback_chain.join('→')})`);

    if (!result) {
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ResumeWeaponizer] Complete for ${role}`);

    // P0-AI-03 FIX: Validate essential fields exist and are correct types
    const isValidResult = (
      result &&
      typeof result === 'object' &&
      typeof (result as any).professional_summary === 'string' &&
      (result as any).professional_summary.length > 10 &&
      Array.isArray((result as any).experience_bullets)
    );

    if (!isValidResult) {
      console.error("[resume-weaponizer] Invalid AI response structure:", JSON.stringify(result).slice(0, 200));
      return new Response(
        JSON.stringify({ error: "AI returned an invalid response. Please retry.", code: "INVALID_AI_RESPONSE" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cache (non-blocking)
    supabase.from("enrichment_cache").upsert(
      { cache_key: cacheKey, data: result, cached_at: new Date().toISOString() },
      { onConflict: "cache_key" }
    ).then(() => {}).catch((e: any) => console.warn("[ResumeWeaponizer] cache write fail:", e));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ResumeWeaponizer] Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

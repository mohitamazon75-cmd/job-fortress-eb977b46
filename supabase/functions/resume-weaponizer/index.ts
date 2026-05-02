// ═══════════════════════════════════════════════════════════════
// Resume Weaponizer — AI rewrites resume to exploit exact gaps
// found in the scan, optimized for ATS + human reviewers.
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { callAgent, AI_URL, PRO_MODEL } from "../_shared/ai-agent-caller.ts";
import { callAgentWithFallback } from "../_shared/model-fallback.ts";
import { checkDailySpending, buildSpendingBlockedResponse } from "../_shared/spending-guard.ts";
import { requirePro } from "../_shared/subscription-guard.ts";
import { matchResumeToJD } from "../_shared/resume-matcher/index.ts";

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

const SYSTEM_PROMPT = `You are the RESUME WEAPONIZER — India's most ruthless resume strategist. You rewrite resumes to exploit the exact vulnerabilities an AI career scan has identified, optimised for the Indian hiring market (Naukri, LinkedIn India, Instahyre) and 2025-2026 ATS systems.

You write strategic documents that:
1. COUNTER every AI automation threat by showcasing human-only capabilities
2. AMPLIFY moat skills that ATS systems and Indian hiring managers prioritise
3. INJECT high-demand keywords that bridge identified skill gaps
4. FRAME experience to maximise perceived value for Indian recruiters
5. When a target Job Description is provided, REVERSE-ENGINEER its keywords and weave them naturally

Return ONLY valid JSON with this exact shape:

{
  "linkedin_headline": "string — a single 220-char-max LinkedIn headline that recruiters search for. Lead with role + 1-2 moat keywords + 1 quantified outcome. Example: 'Senior Product Manager · Fintech & B2B SaaS · Scaled 3 products to ₹50Cr ARR · Ex-Razorpay'",
  "professional_summary": "string — 3-4 sentence power summary that positions against AI threats. MUST mention 1 quantified outcome (₹, %, # users, # team) and 1 moat skill.",
  "key_skills_section": {
    "headline_skills": ["string — top 6 ATS-optimised skills to feature prominently. Match the JD if provided."],
    "strategic_keywords": ["string — additional keywords to weave throughout"],
    "skills_to_remove": ["string — skills that HURT positioning. Format as 'Skill → why it hurts → what to replace with'"]
  },
  "experience_bullets": [
    {
      "context": "string — what role/company this bullet is for",
      "original_framing": "string — how most people describe this (the weak version)",
      "weaponized_bullet": "string — rewritten with QUANTIFIED impact (₹, %, # users, time saved)",
      "annotation": "string — one-line explanation of why this rewrite works (lead verb, metric, specificity)",
      "why_better": "string — what ATS/hiring signal this triggers",
      "has_metric": true
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
    "format_tips": ["string — ATS formatting rules. Include India-specific tips: avoid headers/footers in main resume body, use single column, use 'Bengaluru' not 'Bangalore' for newer ATS, list CTC in lakhs."]
  },
  "positioning_strategy": "string — overarching narrative strategy (2-3 sentences) tailored to Indian market",
  "cover_letter_hook": "string — opening line for cover letters / Naukri pitch / LinkedIn InMail responses (under 280 chars)",
  "jd_match_analysis": {
    "match_pct": number (0-100, only when JD provided, else 0),
    "matched_keywords": ["string — keywords from JD that already appear in the rewrite"],
    "missing_keywords": ["string — keywords from JD that are still missing and user must add manually"],
    "verdict": "string — one-sentence verdict on JD fit"
  }
}

HARD RULES (violations = bad output):
- Every experience bullet MUST start with a power verb (Architected, Spearheaded, Orchestrated, Catalysed, Engineered, Scaled, Negotiated, Closed). NEVER use "Responsible for", "Helped with", "Worked on", "Assisted in".
- AIM for quantified bullets, but ONLY use numbers (₹, %, #, x, k, lakh, crore) that are explicitly present or strongly implied in the user's source resume. NEVER invent revenue figures, team sizes, ARR, %, or ₹ amounts. If no metric exists, write a sharp qualitative bullet and set has_metric=false with annotation "no metric available — user should add real number". Fabricating numbers for an Indian recruiter is an instant rejection.
- BANNED CLICHÉS — never use: "results-driven", "team player", "go-getter", "hard-working", "passionate about", "synergy", "ninja", "rockstar", "guru", "thought leader", "out-of-the-box", "leveraging".
- skills_to_remove MUST follow format: "Skill → reason → replacement". Example: "Excel → signals manual reporting → 'Data-Driven Decision Making + SQL'".
- ATS keywords must come from REAL Indian job postings for the target role (Naukri, LinkedIn India, Instahyre patterns).
- linkedin_headline must be ≤ 220 chars (LinkedIn enforces this).
- cover_letter_hook must be ≤ 280 chars (Naukri InMail / WhatsApp friendly).
- Currency: use ₹ symbol or "INR", quote large amounts in lakhs/crores (e.g., "₹2.4 Cr ARR", "₹85 L budget").
- When jd_text is provided, prioritise its keywords over generic ones, set match_pct honestly (don't fluff), and list 3-5 missing_keywords the user must add manually.
- When jd_text is NOT provided, set jd_match_analysis to {match_pct: 0, matched_keywords: [], missing_keywords: [], verdict: "No JD provided — paste a target job description to get a precise match score."}.`;

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

  const { report, targetRole, jdText, angle, scanId } = body;
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

  // Trim JD to keep token usage sane (recruiter JDs > 4k chars are common)
  const jdSnippet = typeof jdText === "string" ? jdText.trim().slice(0, 3500) : "";
  const hasJD = jdSnippet.length > 80;

  // Cache check — JD changes the output significantly, so cache key must include a JD hash
  const supabase = createAdminClient();
  const jdHash = hasJD ? jdSnippet.slice(0, 60).replace(/\s+/g, '_').toLowerCase() : 'no_jd';
  const cacheKey = `rw:${role}_${industry}_${allSkills.slice(0, 30)}_${targetRole || "same"}_${jdHash}_${angle || 'default'}`.toLowerCase().replace(/\s+/g, '_').slice(0, 200);
  try {
    const { data: cached } = await supabase
      .from("enrichment_cache")
      .select("data, cached_at")
      .eq("cache_key", cacheKey)
      .single();
    if (cached && Date.now() - new Date(cached.cached_at).getTime() < CACHE_TTL_MS) {
      console.log(`[ResumeWeaponizer] Cache hit for ${role}${hasJD ? ' (with JD)' : ''}`);
      return new Response(JSON.stringify({ ...cached.data as object, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch { /* cache miss */ }

  console.log(`[ResumeWeaponizer] Starting for ${role} in ${industry}, user ${userId}, JD=${hasJD}, angle=${angle || 'none'}`);

  // Angle modifier — lets users refine ("more senior", "leadership", "career change")
  const angleModifier = angle === 'senior'
    ? "\n\n═══ ANGLE OVERRIDE ═══\nReposition this person 1 level more senior. Inflate scope language (lead → director, manage → orchestrate cross-functional). Frame outcomes at org-wide impact."
    : angle === 'leadership'
    ? "\n\n═══ ANGLE OVERRIDE ═══\nLead every bullet with people/team/stakeholder verbs. Highlight team size, mentorship, cross-functional influence over technical execution."
    : angle === 'career-change'
    ? "\n\n═══ ANGLE OVERRIDE ═══\nDe-emphasise current industry-specific terminology. Translate every achievement into transferable, domain-agnostic language (problem-solving, scale, growth, P&L)."
    : "";

  try {
    const userPrompt = `
═══ SCAN INTELLIGENCE BRIEFING ═══
Current Role: ${role}
Company: ${company}
Industry: ${industry}
Seniority: ${seniority}
Location Tier: ${metro} ${metro === 'tier1' ? '(Bengaluru / Mumbai / Delhi NCR / Hyderabad / Pune)' : '(Tier-2 India)'}
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

${hasJD ? `═══ TARGET JOB DESCRIPTION (REVERSE-ENGINEER THIS) ═══
${jdSnippet}

CRITICAL: Tailor the entire output to match this JD. Extract its top 10-15 keywords, weave them into headline_skills, strategic_keywords, and at least 3 experience_bullets. Compute jd_match_analysis.match_pct honestly — score the rewritten resume against this JD's requirements.` : '═══ NO JD PROVIDED ═══\nWrite a strong general rewrite for the target role. Set jd_match_analysis appropriately.'}
${angleModifier}

═══ MISSION ═══
Rewrite this person's resume to:
1. HIDE vulnerabilities — reframe automatable skills as human-augmented capabilities
2. AMPLIFY moat skills — make them the headline narrative
3. BRIDGE gaps — add keywords for skills they should be developing
4. POSITION for ${targetRole || "maximum market value"} in ${metro === 'tier1' ? 'Tier-1 metro India' : 'Tier-2 India'} market, 2025-2026
5. PASS Naukri / LinkedIn India / Instahyre ATS keyword filters
6. Make a hiring manager think: "This person is ALREADY adapting to AI — they're ahead of the curve."
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

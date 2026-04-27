// ═══════════════════════════════════════════════════════════════
// RiskIQ Advanced Beta — Streaming Analysis Pipeline (#4)
// Progressive delivery: score → skills → narrative → live signals
// Uses ReadableStream to eliminate "dead screen" problem
// ═══════════════════════════════════════════════════════════════

import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";
import { scoreProfile, type ProfileInput, type RiskReport } from "../_shared/riskiq-scoring.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { validateBody, z } from "../_shared/validate-input.ts";

const RiskIQSchema = z.object({
  profile: z.object({
    role: z.string().min(1).max(200),
    industry: z.string().min(1).max(200),
    experience: z.string().min(1).max(50),
    city: z.string().min(1).max(120),
    education: z.string().min(1).max(200),
    skills: z.array(z.string().max(100)).max(50).optional(),
  }).passthrough(),
  raw_text: z.string().max(50_000).optional(),
  stream: z.boolean().optional(),
});

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";
const NARRATIVE_MODEL = "google/gemini-3.1-pro-preview";
const EXTRACT_MODEL = "google/gemini-3-flash-preview";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    // P0 hardening: require valid JWT — this function calls paid LLM + Perplexity.
    const auth = await requireAuth(req, corsHeaders);
    if (auth.kind === "unauthorized") return auth.response;

    const parsedBody = await validateBody(req, RiskIQSchema, corsHeaders);
    if (parsedBody.kind === "invalid") return parsedBody.response;
    const { profile, raw_text, stream } = parsedBody.data as { profile: ProfileInput; raw_text?: string; stream?: boolean };

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), { status: 500, headers: jsonHeaders });
    }

    // ── Non-streaming mode (backward compatible) ──
    if (!stream) {
      return handleNonStreaming(req, profile, raw_text, apiKey, corsHeaders);
    }

    // ── Streaming mode: progressive delivery via SSE ──
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Phase 1: Extract skills (~2s)
          let extractedSkills: string[] = [];
          if (raw_text && raw_text.trim().length > 20) {
            try {
              extractedSkills = await extractSkills(apiKey, raw_text);
            } catch (e) {
              console.error("[RiskIQ:Stream] Skill extraction failed:", e);
            }
          }

          // Phase 2: Deterministic scoring (~10ms)
          const report = scoreProfile(profile, extractedSkills);
          send("score", {
            risk_score: report.risk_score,
            risk_tier: report.risk_tier,
            timeline: report.timeline,
            dimensions: report.dimensions,
            phase: "score",
          });

          // Phase 3: Skills breakdown (~0ms, already computed)
          send("skills", {
            threats: report.threats,
            strengths: report.strengths,
            skill_gap: report.skill_gap,
            phase: "skills",
          });

          // Phase 4+5: Narrative + Live signals in parallel
          const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
          const [narrative, liveSignals] = await Promise.all([
            enrichNarrative(apiKey, profile, report),
            perplexityKey ? fetchLiveSignals(perplexityKey, profile) : Promise.resolve(null),
          ]);

          if (narrative) {
            report.headline = narrative.headline || report.viral.share_headline;
            report.summary = narrative.summary || "";
          } else {
            report.headline = report.viral.share_headline;
            report.summary = `As a ${profile.role} in ${profile.industry}, your risk score is ${report.risk_score}/100 — placing you in the ${report.risk_tier} tier.`;
          }

          // Phase 6: Final complete report
          send("complete", {
            ...report,
            live_signals: liveSignals,
            engine_version: "2.5.0-stream",
            computed_at: new Date().toISOString(),
            phase: "complete",
          });

          send("done", { status: "complete" });
        } catch (error) {
          console.error("[RiskIQ:Stream] Fatal:", error);
          send("error", { message: String(error) });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("[RiskIQ] Fatal error:", error);
    return new Response(JSON.stringify({ error: "Analysis failed", message: String(error) }), { status: 500, headers: jsonHeaders });
  }
});

// ── Non-streaming handler (backward compatible) ──
async function handleNonStreaming(
  req: Request,
  profile: ProfileInput,
  raw_text: string | undefined,
  apiKey: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  let extractedSkills: string[] = [];
  if (raw_text && raw_text.trim().length > 20) {
    try {
      extractedSkills = await extractSkills(apiKey, raw_text);
    } catch (e) {
      console.error("[RiskIQ] Skill extraction failed:", e);
    }
  }

  const report = scoreProfile(profile, extractedSkills);

  const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
  const [narrative, liveSignals] = await Promise.all([
    enrichNarrative(apiKey, profile, report),
    perplexityKey ? fetchLiveSignals(perplexityKey, profile) : Promise.resolve(null),
  ]);

  if (narrative) {
    report.headline = narrative.headline || report.viral.share_headline;
    report.summary = narrative.summary || "";
  } else {
    report.headline = report.viral.share_headline;
    report.summary = `As a ${profile.role} in ${profile.industry}, your risk score is ${report.risk_score}/100 — placing you in the ${report.risk_tier} tier. Significant displacement is projected within ${report.timeline.significant}.`;
  }

  return new Response(JSON.stringify({
    ...report,
    live_signals: liveSignals,
    engine_version: "2.5.0",
    computed_at: new Date().toISOString(),
  }), { status: 200, headers: jsonHeaders });
}

async function extractSkills(apiKey: string, text: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: EXTRACT_MODEL,
        messages: [
          { role: "system", content: "Extract professional skills from this profile text. Return ONLY a JSON array of skill strings, nothing else. Max 15 skills." },
          { role: "user", content: text.slice(0, 3000) },
        ],
        temperature: 0.1,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) return [];
    const data = await resp.json();
    logTokenUsage("riskiq-analyse", "skills", "google/gemini-3-flash-preview", data);
    const content = data.choices?.[0]?.message?.content || "[]";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

async function enrichNarrative(apiKey: string, profile: ProfileInput, report: RiskReport): Promise<{ headline: string; summary: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const resp = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: NARRATIVE_MODEL,
        messages: [
          { role: "system", content: `You are RiskIQ, a brutally honest AI career risk analyst. Generate ONLY valid JSON with two fields:
{"headline": "<punchy, shareable one-liner that triggers sharing>", "summary": "<2 sentences: hard truth + specific opportunity. Be hyper-specific to the role, not generic.>"}
No markdown. No explanation. ONLY the JSON object.` },
          { role: "user", content: `Role: ${profile.role}\nIndustry: ${profile.industry}\nExperience: ${profile.experience}\nCity: ${profile.city}\nRisk Score: ${report.risk_score}/100 (${report.risk_tier})\nTop threats: ${report.threats.slice(0, 2).map(t => t.name).join(", ")}\nTop strengths: ${report.strengths.slice(0, 2).map(s => s.title).join(", ")}\nDoomsday: ${report.viral.doomsday_date}\n\nGenerate a viral headline and 2-sentence summary.` },
        ],
        temperature: 0.3, // FIX D: was 0.7 — structured JSON output; use low temp
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const data = await resp.json();
    logTokenUsage("riskiq-analyse", "narrative", "google/gemini-3-pro-preview", data);
    const content = data.choices?.[0]?.message?.content || "";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function fetchLiveSignals(perplexityKey: string, profile: ProfileInput): Promise<Record<string, any> | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const resp = await fetch(PERPLEXITY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${perplexityKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: "You are a labor market analyst. Return ONLY valid JSON." },
          { role: "user", content: `What are the latest AI displacement trends for ${profile.role}s in ${profile.industry} in ${profile.city} as of 2025-2026? Return JSON: {"market_trend": "growing|stable|declining", "recent_layoffs": "<brief>", "ai_adoption_rate": "<brief>", "salary_trend": "<brief>", "top_emerging_roles": ["role1","role2"], "citations": ["url1"]}` },
        ],
        search_recency_filter: "month",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const data = await resp.json();
    logTokenUsage("riskiq-analyse", "perplexity", "perplexity", data);
    const content = data.choices?.[0]?.message?.content || "";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    try { return { ...JSON.parse(cleaned), citations: data.citations || [] }; } catch { return { raw: content.slice(0, 500), citations: data.citations || [] }; }
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

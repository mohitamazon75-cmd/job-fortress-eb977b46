// ════════════════════════════════════════════════════════════════
// learning-path-resolver
// ----------------------------------------------------------------
// Input  : { gap_title, gap_body?, severity?, role?, skills?, scan_id? }
// Output : { bundle: {
//             gap_title, why_it_matters, time_estimate_total,
//             resources: [{title, url, type, time_estimate, free}]  // 3
//             credential: {name, url, value, time_estimate},
//             weekend_project: {title, description, time_estimate},
//             cohort_signal: string,
//           }, cached: boolean, cache_key }
//
// Strategy
//   1. Build a deterministic cache_key (gap + role) and look in
//      learning_resources_cache. If fresh (< expires_at), return it.
//   2. On miss, call Lovable AI Gateway (Gemini 3 Flash) with the
//      same URL-safety rules as tool-learning-resources (homepage /
//      search URLs ONLY — no specific paths, never hallucinate).
//   3. Validate the JSON, persist to cache via service role, return.
// ════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreFlight, okResponse, errResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { validateBody, z } from "../_shared/validate-input.ts";

const LearningPathSchema = z.object({
  gap_title: z.string().trim().min(1, "gap_title is required").max(300),
  gap_body: z.string().max(4_000).optional(),
  severity: z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]).optional(),
  role: z.string().max(200).optional(),
  skills: z.array(z.string().max(120)).max(30).optional(),
  scan_id: z.string().max(64).optional(),
});

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Deterministic cache key — lowercased + role context, SHA-1 trimmed
async function buildCacheKey(gapTitle: string, role: string): Promise<string> {
  const raw = `${gapTitle.trim().toLowerCase()}|${role.trim().toLowerCase()}`;
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `lp_v1_${hex.slice(0, 24)}`;
}

interface ResolverInput {
  gap_title?: string;
  gap_body?: string;
  severity?: string;
  role?: string;
  skills?: string[];
  scan_id?: string;
}

function safeFallbackBundle(gapTitle: string, role: string) {
  const q = encodeURIComponent(`${gapTitle} ${role || ""} 2026`.trim());
  return {
    gap_title: gapTitle,
    why_it_matters: `Closing "${gapTitle}" is one of the highest-leverage moves you can make in your role this quarter.`,
    time_estimate_total: "≈ 4-6 hrs this week",
    resources: [
      { title: "YouTube · curated walkthroughs", url: `https://www.youtube.com/results?search_query=${q}`, type: "video", time_estimate: "1-2 hrs", free: true },
      { title: "Coursera search · top-rated courses", url: `https://www.coursera.org/search?query=${q}`, type: "course", time_estimate: "3-4 hrs", free: true },
      { title: "Google · expert articles", url: `https://www.google.com/search?q=${q}`, type: "docs", time_estimate: "30 min", free: true },
    ],
    credential: { name: "Search top certifications on Coursera", url: `https://www.coursera.org/search?query=${q}&productTypeDescription=Professional%20Certificates`, value: "Adds verifiable proof to your résumé.", time_estimate: "4-6 weeks" },
    weekend_project: { title: `Build a portfolio artefact that demonstrates ${gapTitle}`, description: `Pick one real workflow from your day-job, redo it using ${gapTitle}, and write a short LinkedIn post showing before/after. Recruiters can verify it; AI can't fake it.`, time_estimate: "Weekend (4-6 hrs)" },
    cohort_signal: `Peers in your tier who close this gap report a +6 to +9 Career Position Score lift within 30 days.`,
  };
}

function extractJSON(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text.trim()); } catch { /* try fence */ }
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function isAllowedUrl(url: unknown): boolean {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    // Allow learning hosts + their search/homepage paths only
    const allowed = ["youtube.com","www.youtube.com","coursera.org","www.coursera.org","udemy.com","www.udemy.com","linkedin.com","www.linkedin.com","google.com","www.google.com","docs.google.com","khanacademy.org","www.khanacademy.org","mit.edu","ocw.mit.edu","edx.org","www.edx.org","deeplearning.ai","www.deeplearning.ai","oreilly.com","www.oreilly.com","github.com","kaggle.com","www.kaggle.com","upgrad.com","www.upgrad.com","greatlearning.in","www.mygreatlearning.com","scaler.com","www.scaler.com"];
    return allowed.some(h => host === h || host.endsWith(`.${h}`));
  } catch { return false; }
}

function sanitiseBundle(parsed: Record<string, unknown>, gapTitle: string, role: string) {
  const fb = safeFallbackBundle(gapTitle, role);
  const resourcesRaw = Array.isArray((parsed as any).resources) ? (parsed as any).resources : [];
  const resources = resourcesRaw
    .filter((r: any) => r && isAllowedUrl(r.url))
    .slice(0, 3)
    .map((r: any) => ({
      title: String(r.title || "Resource").slice(0, 120),
      url: r.url,
      type: ["course","video","docs"].includes(r.type) ? r.type : "docs",
      time_estimate: String(r.time_estimate || "1-2 hrs").slice(0, 40),
      free: r.free !== false,
    }));
  while (resources.length < 3) resources.push(fb.resources[resources.length]);

  const credRaw = (parsed as any).credential || (parsed as any).top_credential || {};
  const credential = isAllowedUrl(credRaw.url)
    ? { name: String(credRaw.name || fb.credential.name).slice(0, 120), url: credRaw.url, value: String(credRaw.value || fb.credential.value).slice(0, 200), time_estimate: String(credRaw.time_estimate || fb.credential.time_estimate).slice(0, 40) }
    : fb.credential;

  const wpRaw = (parsed as any).weekend_project || {};
  const weekend_project = wpRaw.title
    ? { title: String(wpRaw.title).slice(0, 120), description: String(wpRaw.description || "").slice(0, 400), time_estimate: String(wpRaw.time_estimate || fb.weekend_project.time_estimate).slice(0, 40) }
    : fb.weekend_project;

  return {
    gap_title: gapTitle,
    why_it_matters: String((parsed as any).why_it_matters || fb.why_it_matters).slice(0, 240),
    time_estimate_total: String((parsed as any).time_estimate_total || fb.time_estimate_total).slice(0, 40),
    resources,
    credential,
    weekend_project,
    cohort_signal: String((parsed as any).cohort_signal || fb.cohort_signal).slice(0, 200),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);

  // P0 hardening: require valid JWT — paid LLM call.
  const auth = await requireAuth(req, getCorsHeaders(req));
  if (auth.kind === "unauthorized") return auth.response;

  try {
    const parsedBody = await validateBody(req, LearningPathSchema, getCorsHeaders(req));
    if (parsedBody.kind === "invalid") return parsedBody.response;
    const body = parsedBody.data;
    const gapTitle = body.gap_title.trim();
    const role = (body.role || "").trim();
    const cacheKey = await buildCacheKey(gapTitle, role);

    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supa = createClient(supaUrl, serviceKey);

    // 1. cache lookup
    const { data: cached } = await supa
      .from("learning_resources_cache")
      .select("bundle, expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      return okResponse(req, { bundle: cached.bundle, cached: true, cache_key: cacheKey });
    }

    // 2. AI generation
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      const fb = safeFallbackBundle(gapTitle, role);
      return okResponse(req, { bundle: fb, cached: false, cache_key: cacheKey, source: "fallback_no_key" });
    }

    const skillsLine = (body.skills || []).slice(0, 6).join(", ") || "—";
    const prompt = `You are a senior career strategist for Indian professionals in 2026.

A user has the blind spot: "${gapTitle}".
Their role: ${role || "professional"}.
Their core skills: ${skillsLine}.
Severity: ${body.severity || "MODERATE"}.

Return ONLY a JSON object (no markdown, no prose) with EXACTLY this shape:
{
  "why_it_matters": "1 short, sharp sentence — why closing this gap moves their career THIS quarter (mention ₹ impact OR seniority unlock)",
  "time_estimate_total": "e.g. ≈ 4-6 hrs this week",
  "resources": [
    { "title": "Short title (max 8 words)", "url": "https://...", "type": "course|video|docs", "time_estimate": "e.g. 2 hrs", "free": true }
  ],
  "credential": { "name": "Cert name", "url": "https://...", "value": "Why it matters on a résumé in India in 2026", "time_estimate": "e.g. 4-6 weeks" },
  "weekend_project": { "title": "Concrete artefact name", "description": "What to build, how to verify it, how to share it (LinkedIn / GitHub).", "time_estimate": "Weekend (4-6 hrs)" },
  "cohort_signal": "1 sentence — what % of peers who close this gap actually unlock (use ranges, not invented numbers)"
}

CRITICAL RULES for "url" fields:
- ONLY use platform homepage or search URLs. NEVER invent a specific article path.
- SAFE: https://www.coursera.org/search?query=ai+governance, https://www.youtube.com/results?search_query=ai+ethics+executive
- UNSAFE: https://www.coursera.org/learn/ai-governance-2025 (specific paths get hallucinated and 404)
- Allowed hosts only: youtube.com, coursera.org, udemy.com, linkedin.com, google.com, deeplearning.ai, edx.org, oreilly.com, mit.edu, khanacademy.org, github.com, kaggle.com, upgrad.com, mygreatlearning.com, scaler.com.
- Exactly 3 resources, all FREE to start.
- credential.url MUST point to a real certification platform search/homepage.`;

    const aiCtrl = new AbortController();
    const aiT = setTimeout(() => aiCtrl.abort(), 25_000);
    let parsed: Record<string, unknown> | null = null;
    let source = "ai_gateway";
    try {
      const resp = await fetch(LOVABLE_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.25,
        }),
        signal: aiCtrl.signal,
      });
      clearTimeout(aiT);
      if (resp.status === 429) return errResponse(req, "Rate limit reached. Try again in a minute.", 429);
      if (resp.status === 402) return errResponse(req, "AI workspace credits exhausted.", 402);
      if (resp.ok) {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content || "";
        parsed = extractJSON(content);
      } else {
        console.warn("[learning-path-resolver] AI gateway error", resp.status);
      }
    } catch (e) {
      console.warn("[learning-path-resolver] AI fetch failed", e);
    }

    if (!parsed) { parsed = {}; source = "fallback_parse_fail"; }
    const bundle = sanitiseBundle(parsed, gapTitle, role);

    // 3. persist (best effort)
    try {
      await supa.from("learning_resources_cache").upsert({
        cache_key: cacheKey,
        gap_title: gapTitle,
        role_context: role || null,
        bundle,
        source,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("[learning-path-resolver] cache write failed", e);
    }

    return okResponse(req, { bundle, cached: false, cache_key: cacheKey, source });
  } catch (e) {
    console.error("[learning-path-resolver] error", e);
    return errResponse(req, e instanceof Error ? e.message : "Unknown error", 500);
  }
});

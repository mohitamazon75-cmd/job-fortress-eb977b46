// Phase C: Generate milestone tracking for defense plan
// Receives: { user_id: string, scan_id: string }
// Fetches final_json_report from scans table
// Extracts defense plan and creates 8-12 milestones
// Inserts into defense_milestones with idempotent ON CONFLICT

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { tavilySearch } from "../_shared/tavily-search.ts";



const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Milestone {
  phase: 1 | 2 | 3 | 4;
  milestone_key: string;
  milestone_label: string;
  resource_url: string | null;
}

const defaultMilestones: Milestone[] = [
  { phase: 1, milestone_key: 'phase1_skill_audit', milestone_label: 'Audit your top 5 skills against AI automation risk' },
  { phase: 1, milestone_key: 'phase1_linkedin_update', milestone_label: 'Update LinkedIn headline to reflect AI-augmented work' },
  { phase: 1, milestone_key: 'phase1_skill_start', milestone_label: 'Start learning one AI-augmentation tool (Cursor, Copilot, or similar)' },
  { phase: 2, milestone_key: 'phase2_portfolio_project', milestone_label: 'Build one portfolio project using your new skill' },
  { phase: 2, milestone_key: 'phase2_network_outreach', milestone_label: 'Connect with 5 people in your target pivot role' },
  { phase: 2, milestone_key: 'phase2_share_linkedin', milestone_label: 'Share one learning post on LinkedIn' },
  { phase: 3, milestone_key: 'phase3_apply_roles', milestone_label: 'Apply to 3 roles matching your skill pivot direction' },
  { phase: 3, milestone_key: 'phase3_salary_research', milestone_label: 'Research salary ranges for your target role' },
  { phase: 3, milestone_key: 'phase3_interview_prep', milestone_label: 'Complete mock interview practice for new role' },
  { phase: 4, milestone_key: 'phase4_offer_negotiation', milestone_label: 'Prepare salary negotiation talking points' },
  { phase: 4, milestone_key: 'phase4_rescan', milestone_label: 'Rescan your profile to measure improvement' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Smart resource resolver
// ─────────────────────────────────────────────────────────────────────────────
// Strategy:
// 1. Extract a concrete skill phrase from the milestone label.
// 2. Check 30-day cache in `learning_resources` (per skill phrase).
// 3. On cache miss → live Tavily search restricted to TRUSTED domains only.
// 4. Validate result domain, cache it, return URL.
// 5. On full failure → safe platform-search URL (never broken).
//
// Why: hardcoded course lists go stale within 6 months. Live search keeps
// recommendations current, allowlist prevents hallucinated/spam links.

const TRUSTED_LEARNING_DOMAINS = [
  "coursera.org", "edx.org", "udemy.com", "freecodecamp.org",
  "khanacademy.org", "youtube.com", "linkedin.com",
  "deeplearning.ai", "fast.ai", "kaggle.com",
  "developers.google.com", "learn.microsoft.com", "docs.cursor.com",
  "cursor.sh", "openai.com", "anthropic.com", "huggingface.co",
  "github.com", "ocw.mit.edu", "harvard.edu", "stanford.edu",
  "wharton.upenn.edu", "nptel.ac.in", "swayam.gov.in",
  "hbr.org", "mckinsey.com", "ted.com", "promptingguide.ai",
];

const STOP_PHRASES = [
  "audit your", "update linkedin", "share one", "apply to", "research",
  "complete mock", "prepare salary", "rescan", "build one portfolio",
  "connect with", "start learning",
];

/**
 * Extract the concrete learnable phrase from a milestone label.
 * Examples:
 *   "Start learning one AI-augmentation tool (Cursor or Copilot)" → "Cursor Copilot"
 *   "Build skill in Python for data analysis" → "Python data analysis"
 *   "Update LinkedIn headline" → null (action, not a learnable skill)
 */
function extractSkillQuery(label: string): string | null {
  const lower = label.toLowerCase();

  // Pull noun phrases inside parentheses first (most specific signal)
  const paren = label.match(/\(([^)]+)\)/);
  if (paren) {
    const inside = paren[1].replace(/\b(or|and|like|such as|e\.g\.?)\b/gi, " ").trim();
    if (inside.length > 2) return inside;
  }

  // Strip common verb prefixes
  let cleaned = label
    .replace(/^(start |begin |learn |build |master |complete |finish |take |study )/i, "")
    .replace(/\b(course|courses|tool|tools|skill|skills|fundamentals|basics)\b/gi, "")
    .replace(/[(),.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Skip pure-action milestones (no learnable target)
  if (STOP_PHRASES.some((p) => lower.includes(p)) && !paren) return null;
  if (cleaned.length < 4) return null;
  return cleaned.slice(0, 80);
}

/**
 * Find a fresh, real URL via Tavily live search restricted to trusted domains.
 * Returns null if no suitable result found.
 */
async function tavilyFindResource(query: string): Promise<{ url: string; title: string } | null> {
  const resp = await tavilySearch(
    {
      query: `best free ${query} course tutorial 2026`,
      searchDepth: "basic",
      maxResults: 5,
      includeDomains: TRUSTED_LEARNING_DOMAINS,
      includeAnswer: false,
      days: 365, // courses don't need to be hourly-fresh
    },
    12000,
    1,
  );

  if (!resp || !resp.results?.length) return null;

  // Pick highest-scoring result whose hostname matches allowlist
  for (const r of resp.results.sort((a, b) => b.score - a.score)) {
    try {
      const host = new URL(r.url).hostname.replace(/^www\./, "");
      if (TRUSTED_LEARNING_DOMAINS.some((d) => host === d || host.endsWith("." + d))) {
        return { url: r.url, title: r.title || query };
      }
    } catch { /* skip malformed URLs */ }
  }
  return null;
}

/**
 * Build a safe platform-search fallback URL.
 * Always works because search pages always exist.
 */
function platformSearchFallback(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query + " tutorial 2026")}`;
}

async function findResourceUrl(
  label: string,
  supabase: ReturnType<typeof createClient>,
): Promise<string | null> {
  const query = extractSkillQuery(label);
  if (!query) return null;

  const cacheKey = query.toLowerCase().trim();
  const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Try cache (fresh within 30 days)
  const { data: cached } = await supabase
    .from("learning_resources")
    .select("url, last_verified_at")
    .eq("skill_category", cacheKey)
    .gte("last_verified_at", THIRTY_DAYS_AGO)
    .order("last_verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached?.url) return cached.url as string;

  // 2. Live Tavily search
  try {
    const found = await tavilyFindResource(query);
    if (found) {
      // Cache it (fire-and-forget; ignore conflicts)
      await supabase.from("learning_resources").insert({
        skill_category: cacheKey,
        title: found.title.slice(0, 200),
        url: found.url,
        platform: (() => { try { return new URL(found.url).hostname.replace(/^www\./, ""); } catch { return null; } })(),
        source: "tavily",
        last_verified_at: new Date().toISOString(),
      });
      return found.url;
    }
  } catch (e) {
    console.warn("[generate-milestones] Tavily lookup failed for", query, e);
  }

  // 3. Fallback — never a broken link
  return platformSearchFallback(query);
}

async function generateMilestones(
  report: any,
  supabase: ReturnType<typeof createClient>
): Promise<Milestone[]> {
  // Check for structured defense plan in report
  const plan = report?.weeklyActionPlan || report?.weekly_action_plan || report?.defense_plan || report?.immediate_next_step;

  if (!plan) {
    console.log("[generate-milestones] No structured plan found, using defaults");
    return defaultMilestones;
  }

  // Extract milestones from the plan
  const milestones: Milestone[] = [];
  const phaseCounter = 1;
  const milestonesPerPhase: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const maxPerPhase = { 1: 3, 2: 3, 3: 3, 4: 2 };

  // Parse plan content - handle both array and string formats
  const planItems: string[] = [];

  if (Array.isArray(plan)) {
    planItems.push(...plan.map(item => {
      if (typeof item === 'string') return item;
      if (item?.action) return item.action;
      if (item?.label) return item.label;
      return JSON.stringify(item);
    }));
  } else if (typeof plan === 'string') {
    // Split string by common delimiters
    planItems.push(...plan.split(/[•\-\n]+/).filter(s => s.trim().length > 0));
  } else if (typeof plan === 'object') {
    // Extract text from object structure
    if (plan.action) planItems.push(plan.action);
    if (plan.items && Array.isArray(plan.items)) planItems.push(...plan.items);
    if (plan.steps && Array.isArray(plan.steps)) planItems.push(...plan.steps);
  }

  // Create milestones from plan items, distributing across phases
  for (const item of planItems) {
    if (!item || typeof item !== 'string') continue;

    const trimmedItem = item.trim().slice(0, 60); // Limit to 60 chars
    if (trimmedItem.length < 5) continue; // Skip very short items

    // Distribute across phases: 3 in phase 1, 3 in phase 2, 3 in phase 3, 2 in phase 4
    let targetPhase = 1;
    for (let p = 1; p <= 4; p++) {
      if (milestonesPerPhase[p] < maxPerPhase[p]) {
        targetPhase = p;
        break;
      }
    }

    // Ensure we don't exceed phase limits
    if (milestonesPerPhase[targetPhase] >= maxPerPhase[targetPhase]) {
      continue;
    }

    const key = `phase${targetPhase}_${milestones.length}`.toLowerCase().replace(/\s+/g, '_');
    const url = await findResourceUrl(trimmedItem, supabase);

    milestones.push({
      phase: targetPhase as 1 | 2 | 3 | 4,
      milestone_key: key,
      milestone_label: trimmedItem,
      resource_url: url,
    });

    milestonesPerPhase[targetPhase]++;

    // Stop if we have 8-12 milestones
    if (milestones.length >= 12) break;
  }

  // If we have fewer than 8 milestones, fall back to defaults
  if (milestones.length < 8) {
    console.log(`[generate-milestones] Generated ${milestones.length} milestones, falling back to defaults`);
    const enriched = await Promise.all(
      defaultMilestones.map(async (m) => ({
        ...m,
        resource_url: await findResourceUrl(m.milestone_label, supabase),
      })),
    );
    return enriched;
  }

  return milestones;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const body = await req.json();
    const { user_id, scan_id } = body;

    if (!user_id || !scan_id) {
      return new Response(JSON.stringify({ error: "Missing user_id or scan_id" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const sb = createAdminClient();

    // Fetch the scan report
    const { data: scanData, error: scanError } = await sb
      .from('scans')
      .select('final_json_report')
      .eq('id', scan_id)
      .eq('user_id', user_id)
      .single();

    if (scanError || !scanData) {
      console.error("[generate-milestones] Scan fetch error:", scanError);
      return new Response(JSON.stringify({ error: "Scan not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const report = scanData.final_json_report || {};
    console.log("[generate-milestones] Processing scan:", scan_id, "for user:", user_id);

    // Generate milestones
    const milestones = await generateMilestones(report, sb);

    // Insert milestones with idempotent handling (ON CONFLICT DO NOTHING)
    const milestoneInserts = milestones.map(m => ({
      user_id,
      scan_id,
      phase: m.phase,
      milestone_key: m.milestone_key,
      milestone_label: m.milestone_label,
      resource_url: m.resource_url,
    }));

    // Upsert: insert new milestones, refresh resource_url on existing ones (e.g. after seeding catch-up)
    const { error: insertError, data: insertData } = await sb
      .from('defense_milestones')
      .upsert(milestoneInserts, { onConflict: 'user_id,scan_id,milestone_key', ignoreDuplicates: false })
      .select();

    // Backfill: any existing rows for this scan with NULL resource_url get refreshed
    try {
      const { data: nullRows } = await sb
        .from('defense_milestones')
        .select('id, milestone_label')
        .eq('scan_id', scan_id)
        .is('resource_url', null);
      if (nullRows && nullRows.length > 0) {
        for (const row of nullRows) {
          const url = await findResourceUrl(row.milestone_label as string, sb);
          if (url) await sb.from('defense_milestones').update({ resource_url: url }).eq('id', row.id);
        }
        console.log(`[generate-milestones] Backfilled ${nullRows.length} resource URLs`);
      }
    } catch (e) { console.warn("[generate-milestones] Backfill failed:", e); }

    if (insertError) {
      console.error("[generate-milestones] Insert error:", insertError);
      // Don't fail the request — this is fire-and-forget
      return new Response(JSON.stringify({ success: true, message: "Milestone insertion had issues but continuing" }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    console.log("[generate-milestones] Inserted", milestones.length, "milestones");
    return new Response(JSON.stringify({ success: true, milestone_count: milestones.length }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-milestones] Fatal error:", err);
    // Fire-and-forget: don't fail the request
    return new Response(JSON.stringify({ success: true, message: "Processed (error handling)" }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

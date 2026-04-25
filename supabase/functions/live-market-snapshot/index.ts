// ─────────────────────────────────────────────────────────────────────
// live-market-snapshot — Phase 2B-ii
//
// Aggregates a Naukri scrape into a deterministic snapshot for the new
// "Live Market" card that opens position 2 of the verdict reveal flow
// for non-executive scans.
//
// This function does NOT modify the existing apify-naukri-jobs matcher.
// It calls the Apify actor directly with the same parameters and folds
// the raw 50-job payload into a presentation-ready aggregate:
//   - posting_count
//   - top 8 tags (with stopword + length filters)
//   - user_skill_overlap (gated to >=2 matches)
//   - salary stats (gated to >=5 disclosed)
//   - recency buckets
//
// Cache strategy: store the RAW Apify payload (not the aggregate) so
// aggregation logic changes don't force a re-scrape. Aggregation runs
// every request; the expensive call is the network fetch.
// ─────────────────────────────────────────────────────────────────────

import { z } from "https://esm.sh/zod@3.25.76";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";
import { SKILL_SYNONYMS } from "../_shared/skill-synonyms.ts";

const APIFY_ACTOR_ID = "alpcnRV9YI9lYVPWk";
const CACHE_TTL_HOURS = 6;
const RUN_LIMIT = 50;
// v2: adds corpus_relevance signal so the card can downgrade to a
// thin-signal render when Naukri's corpus doesn't reflect the user's role.
// Bumping invalidates v1 caches that lacked the new field.
const CACHE_VERSION = "v2";

// Same EXECUTIVE_HINTS as src/lib/jobsTab.ts (kept in sync manually —
// duplicated to avoid cross-tier import).
const EXECUTIVE_HINTS = [
  "founder", "co-founder", "ceo", "cfo", "coo", "cto", "cmo", "chro",
  "chief executive", "chief financial", "chief operating", "chief technology",
  "chief marketing", "chief people", "chief revenue", "managing director",
  "president", "general partner", "venture partner", "country head",
];

// Naukri pollution tags — appear in nearly every job regardless of role.
// Keep this list short and motivated.
const TAG_STOPWORDS = new Set([
  "sales",          // dominates marketing/eng-mgr corpora as field-sales pollution
  "development",    // generic; nearly every tech/non-tech job carries it
  "management",     // generic ladder noise
  "communication",  // boilerplate soft skill on >50% of postings
  "english",        // language tag, not a job skill
  "hindi",          // language tag
  "kannada",        // language tag (Bangalore corpora)
  "tamil",          // language tag (Chennai corpora)
  "team",           // generic
  "work",           // generic
]);

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export type ApifyJob = {
  title?: string;
  companyName?: string;
  jdURL?: string;
  jobDescription?: string;
  tagsAndSkills?: string;
  footerPlaceholderLabel?: string;
  salaryDetail?: {
    hideSalary?: boolean;
    minimumSalary?: number;
    maximumSalary?: number;
  };
};

export type SnapshotResult = {
  posting_count: number;
  fetched_at: string;
  cached: boolean;
  is_executive: boolean;
  error?: string;
  top_tags: Array<{ tag: string; count: number; pct: number }>;
  user_skill_overlap: {
    shown: boolean;
    matched_count: number;
    matched_skills: string[];
    missing_top_tags: string[];
  };
  salary: {
    shown: boolean;
    n_disclosed: number;
    n_total: number;
    median_lpa: number | null;
    p25_lpa: number | null;
    p75_lpa: number | null;
  };
  recency: {
    same_day_count: number;
    within_7d_count: number;
    older_count: number;
  };
  source: { name: "Naukri.com"; via: "Apify"; fetched_at: string };
};

const RequestSchema = z.object({
  role: z.string().min(2).max(120),
  city: z.string().max(80).optional().default("India"),
  all_skills: z.array(z.string().min(1).max(80)).optional().default([]),
  force_refresh: z.boolean().optional().default(false),
});

// ─────────────────────────────────────────────────────────────────────
// Pure helpers (exported for tests)
// ─────────────────────────────────────────────────────────────────────

export function normalizeText(value: string): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function isExecutiveTitle(role: string): boolean {
  const lower = (role || "").toLowerCase();
  return EXECUTIVE_HINTS.some((h) => lower.includes(h));
}

export function normalizeCity(city: string): string {
  return (city || "India").replace(/\(.*?\)/g, "").split(/,|\//)[0]?.trim() || "India";
}

function slugify(text: string): string {
  return (text || "")
    .replace(/[^\w\s]/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-") || "jobs";
}

// Inline copy of skillPresent from apify-naukri-jobs/index.ts.
// Kept verbatim so the matcher behaviour is identical to the existing
// production matcher. If that helper changes, mirror the change here.
let _normKeyIndex: Map<string, string[]> | null = null;
function lookupSynonymsLoose(skillNorm: string): string[] | undefined {
  if (!_normKeyIndex) {
    _normKeyIndex = new Map();
    for (const [k, v] of Object.entries(SKILL_SYNONYMS)) {
      _normKeyIndex.set(normalizeText(k), v);
    }
  }
  return _normKeyIndex.get(skillNorm);
}

export function skillPresent(skillNorm: string, haystackNorm: string): boolean {
  if (!skillNorm || !haystackNorm) return false;
  if (skillNorm.length >= 3 && haystackNorm.includes(skillNorm)) return true;
  const tokens = skillNorm.split(" ").filter((t) => t.length >= 3);
  if (tokens.length > 0 && tokens.every((t) => haystackNorm.includes(t))) return true;
  const variants = SKILL_SYNONYMS[skillNorm] ?? lookupSynonymsLoose(skillNorm);
  if (variants) {
    for (const v of variants) {
      const vN = normalizeText(v);
      if (vN.length >= 3 && haystackNorm.includes(vN)) return true;
      const vT = vN.split(" ").filter((t) => t.length >= 3);
      if (vT.length > 0 && vT.every((t) => haystackNorm.includes(t))) return true;
    }
  }
  return false;
}

// ─── Aggregation ─────────────────────────────────────────────────────

export function aggregateTopTags(jobs: ApifyJob[]): Array<{ tag: string; count: number; pct: number }> {
  const total = jobs.length || 1;
  const freq = new Map<string, number>();
  for (const job of jobs) {
    if (!job.tagsAndSkills) continue;
    const seenInJob = new Set<string>();
    for (const raw of job.tagsAndSkills.split(",")) {
      const tag = raw.trim().toLowerCase();
      if (!tag) continue;
      if (tag.length < 3) continue;            // length filter
      if (TAG_STOPWORDS.has(tag)) continue;    // stopword filter
      if (seenInJob.has(tag)) continue;        // dedupe within a job
      seenInJob.add(tag);
      freq.set(tag, (freq.get(tag) || 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count, pct: Math.round((count / total) * 100) }));
}

// ─────────────────────────────────────────────────────────────────
// DESIGN NOTE — overlap is computed against TOP-8 TAGS, not full
// job text. Rationale:
//
//   1. Top-8 tags represent what hiring managers consistently ask
//      for. Matching against them tells the user "your skills are
//      what this market wants" — semantically meaningful.
//   2. Full job text matching has known false-positive classes
//      documented in docs/DECISIONS.md (Phase 2A-iii): "team" +
//      "management" tokens, "system" + "design" tokens, "aws"
//      inside "laws". Using full text for the match column would
//      surface those FPs to users.
//   3. When Naukri's corpus for a role is polluted (e.g. Bangalore
//      Engineering Manager board returns sales/insurance/finance
//      listings), the top 8 tags don't reflect what the role
//      actually requires. In that case, overlap.shown=false is
//      the correct behavior — the column hides rather than shows
//      misleading data.
//
// The shown >= 2 gate ensures we only render the match column
// when ≥2 of the user's skills actually appear in the top-8
// tags — i.e. when the corpus represents the user's role.
//
// Phase 2B-iii (UI) MUST disclose this gating to users when
// overlap is hidden, e.g. "Skill-match not shown — this market's
// top tags don't cleanly reflect {role} skills."
// ─────────────────────────────────────────────────────────────────
export function computeUserSkillOverlap(
  topTags: Array<{ tag: string }>,
  userSkills: string[],
): { shown: boolean; matched_count: number; matched_skills: string[]; missing_top_tags: string[] } {
  const matchedSkills: string[] = [];
  const matchedTagSet = new Set<string>();
  // For each user skill, check it against the concatenated top-tag haystack.
  // A user skill "matches" if skillPresent finds it in any top-tag string.
  for (const skill of userSkills) {
    const sN = normalizeText(skill);
    if (!sN) continue;
    let hit = false;
    for (const { tag } of topTags) {
      const tN = normalizeText(tag);
      if (skillPresent(sN, tN)) {
        matchedTagSet.add(tag);
        hit = true;
      }
    }
    if (hit) matchedSkills.push(skill);
  }
  const missing = topTags.map((t) => t.tag).filter((t) => !matchedTagSet.has(t));
  return {
    shown: matchedSkills.length >= 2,
    matched_count: matchedSkills.length,
    matched_skills: matchedSkills,
    missing_top_tags: missing,
  };
}

function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function quantile(arr: number[], q: number): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.floor((s.length - 1) * q));
  return s[i];
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function aggregateSalary(jobs: ApifyJob[]): SnapshotResult["salary"] {
  const total = jobs.length;
  const mids: number[] = [];
  for (const j of jobs) {
    const sd = j.salaryDetail;
    if (!sd) continue;
    if (sd.hideSalary !== false) continue;
    const lo = Number(sd.minimumSalary) || 0;
    const hi = Number(sd.maximumSalary) || 0;
    if (lo <= 0 && hi <= 0) continue;
    let mid: number;
    if (lo > 0 && hi > 0) mid = (lo + hi) / 2;
    else mid = lo > 0 ? lo : hi;
    // Naukri values are annual INR. Convert to LPA.
    mids.push(mid / 100000);
  }
  const med = median(mids);
  const p25 = quantile(mids, 0.25);
  const p75 = quantile(mids, 0.75);
  return {
    shown: mids.length >= 5,
    n_disclosed: mids.length,
    n_total: total,
    median_lpa: med == null ? null : round1(med),
    p25_lpa: p25 == null ? null : round1(p25),
    p75_lpa: p75 == null ? null : round1(p75),
  };
}

export function aggregateRecency(jobs: ApifyJob[]): SnapshotResult["recency"] {
  let same = 0, w7 = 0, older = 0;
  for (const j of jobs) {
    const lbl = (j.footerPlaceholderLabel || "").toLowerCase();
    if (!lbl) continue;
    if (lbl.includes("just now") || lbl.includes("today") || lbl.includes("hour")) {
      same++; continue;
    }
    const dayMatch = lbl.match(/(\d+)\s*day/);
    if (dayMatch) {
      const d = parseInt(dayMatch[1], 10);
      if (d <= 0) same++;
      else if (d <= 7) w7++;
      else older++;
      continue;
    }
    if (lbl.includes("week")) {
      const wm = lbl.match(/(\d+)\s*week/);
      const w = wm ? parseInt(wm[1], 10) : 1;
      if (w * 7 <= 7) w7++;
      else older++;
      continue;
    }
    if (lbl.includes("month") || lbl.includes("year")) {
      older++; continue;
    }
    // unrecognized label — don't count anywhere
  }
  return { same_day_count: same, within_7d_count: w7, older_count: older };
}

// Stable empty/error shape — used for executive route, fetch failures,
// and any path where we cannot return real data.
export function emptyShape(opts: { is_executive: boolean; error?: string }): SnapshotResult {
  const now = new Date().toISOString();
  return {
    posting_count: 0,
    fetched_at: now,
    cached: false,
    is_executive: opts.is_executive,
    ...(opts.error ? { error: opts.error } : {}),
    top_tags: [],
    user_skill_overlap: { shown: false, matched_count: 0, matched_skills: [], missing_top_tags: [] },
    salary: { shown: false, n_disclosed: 0, n_total: 0, median_lpa: null, p25_lpa: null, p75_lpa: null },
    recency: { same_day_count: 0, within_7d_count: 0, older_count: 0 },
    source: { name: "Naukri.com", via: "Apify", fetched_at: now },
  };
}

export function buildSnapshot(jobs: ApifyJob[], userSkills: string[], cached: boolean): SnapshotResult {
  const now = new Date().toISOString();
  const top = aggregateTopTags(jobs);
  const overlap = computeUserSkillOverlap(top, userSkills);
  const salary = aggregateSalary(jobs);
  const recency = aggregateRecency(jobs);
  return {
    posting_count: jobs.length,
    fetched_at: now,
    cached,
    is_executive: false,
    top_tags: top,
    user_skill_overlap: overlap,
    salary,
    recency,
    source: { name: "Naukri.com", via: "Apify", fetched_at: now },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Apify call (mirrors apify-naukri-jobs payload shape)
// ─────────────────────────────────────────────────────────────────────

async function fetchApify(role: string, city: string): Promise<ApifyJob[]> {
  const apiToken = Deno.env.get("APIFY_API_TOKEN");
  if (!apiToken) throw new Error("APIFY_API_TOKEN is not configured");
  const roleSlug = slugify(role);
  const citySlug = slugify(normalizeCity(city));
  const searchUrl = `https://www.naukri.com/${roleSlug}-jobs-in-${citySlug}`;
  const url = `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${apiToken}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      searchUrl,
      maxJobs: RUN_LIMIT,
      freshness: "30",
      sortBy: "date",
      fetchDetails: false,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`apify_${resp.status}: ${text.slice(0, 200)}`);
  }
  const items = await resp.json();
  return Array.isArray(items) ? items : [];
}

// ─────────────────────────────────────────────────────────────────────
// HTTP entry
// ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const blocked = guardRequest(req, cors);
    if (blocked) return blocked;

    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { role, city, all_skills, force_refresh } = parsed.data;

    // Executive gate — no Apify call, deterministic empty shape.
    if (isExecutiveTitle(role)) {
      return json(emptyShape({ is_executive: true }));
    }

    const cacheKey = `live-market-snapshot:${CACHE_VERSION}:${normalizeText(role)}:${normalizeText(city)}`;
    const sb = createAdminClient();

    let rawJobs: ApifyJob[] | null = null;
    let cached = false;

    if (!force_refresh) {
      const { data: cacheRow } = await sb
        .from("enrichment_cache")
        .select("data, cached_at")
        .eq("cache_key", cacheKey)
        .maybeSingle();
      if (cacheRow?.data && cacheRow.cached_at) {
        const ageHours = (Date.now() - new Date(cacheRow.cached_at).getTime()) / 36e5;
        if (ageHours < CACHE_TTL_HOURS) {
          const cd = cacheRow.data as { jobs?: ApifyJob[] };
          if (Array.isArray(cd.jobs)) {
            rawJobs = cd.jobs;
            cached = true;
          }
        }
      }
    }

    if (!rawJobs) {
      try {
        rawJobs = await fetchApify(role, city);
      } catch (e) {
        console.warn("[live-market-snapshot] Apify fetch failed:", e instanceof Error ? e.message : e);
        return json(emptyShape({ is_executive: false, error: "data_fetch_failed" }));
      }

      // Fire-and-forget cache write — failures should not break the request.
      sb.from("enrichment_cache")
        .upsert(
          { cache_key: cacheKey, data: { jobs: rawJobs }, cached_at: new Date().toISOString() },
          { onConflict: "cache_key" },
        )
        .then(({ error }) => {
          if (error) console.warn("[live-market-snapshot] cache write failed:", error.message);
        });
    }

    return json(buildSnapshot(rawJobs, all_skills, cached));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[live-market-snapshot] unhandled:", message);
    return json(emptyShape({ is_executive: false, error: "internal_error" }));
  }
});

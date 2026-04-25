import { z } from "https://esm.sh/zod@3.25.76";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";
import { SKILL_SYNONYMS } from "../_shared/skill-synonyms.ts";

const APIFY_ACTOR_ID = "alpcnRV9YI9lYVPWk";
const CACHE_TTL_HOURS = 6;
const RUN_LIMIT = 50; // actor minimum

// Executive titles where Naukri keyword search returns junk.
const EXECUTIVE_HINTS = [
  "founder", "co-founder", "ceo", "cfo", "coo", "cto", "cmo", "chro",
  "chief executive", "chief financial", "chief operating", "chief technology",
  "chief marketing", "chief people", "chief revenue", "managing director",
  "president", "general partner", "venture partner", "country head",
];

const STOP_TOKENS = new Set([
  "and", "the", "for", "with", "of", "in", "at", "on", "to", "a", "an",
  "&", "lead", "sr", "jr", "senior", "junior", "principal", "head",
  "manager", "executive", "specialist", "associate", "consultant", "engineer",
  "developer", "analyst", "officer",
]);

const RequestSchema = z.object({
  role: z.string().min(2).max(120),
  city: z.string().max(80).optional().default("India"),
  skills: z.array(z.string().min(1).max(40)).optional().default([]),
  experience: z.string().max(30).optional().default(""),
  is_executive: z.boolean().optional().default(false),
  force_refresh: z.boolean().optional().default(false),
});

// Parse a free-form years-of-experience string into a number.
// Accepts: "11", "11 years", "11+", "10-12 yrs", "10 to 12". Returns null on failure.
export function parseUserYears(input: string | undefined | null): number | null {
  if (!input) return null;
  const m = String(input).match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 && n <= 60 ? n : null;
}

// Parse a Naukri listing's experience band like "1-3 Yrs", "5+ Yrs", "0-2 yrs".
// Returns { min, max } in years, or null. Open-ended bands ("5+") get max=null.
export function parseListingExperienceBand(input: string | undefined | null): { min: number; max: number | null } | null {
  if (!input) return null;
  const s = String(input).toLowerCase();
  // "1-3", "10 - 12"
  const range = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (Number.isFinite(min) && Number.isFinite(max) && min <= max) return { min, max };
  }
  // "5+ yrs", "10+ years"
  const open = s.match(/(\d+)\s*\+/);
  if (open) {
    const min = Number(open[1]);
    if (Number.isFinite(min)) return { min, max: null };
  }
  // single number "5 yrs"
  const single = s.match(/(\d+)/);
  if (single) {
    const n = Number(single[1]);
    if (Number.isFinite(n)) return { min: n, max: n };
  }
  return null;
}

/**
 * Returns a match-percentage delta in [-30, +6] based on the gap between the
 * user's years of experience and the listing's required band.
 *
 *   - Listing requires roughly the user's level (within ±2 yrs of band): +6 (perfect)
 *   - User overqualified by 1-2 levels (band max < user but within 4 yrs): 0 (neutral)
 *   - User wildly overqualified (band max ≤ user/2, e.g. 11yr user vs 1-3yr role): -25 (junior pollution)
 *   - User underqualified (band min > user + 4): -20 (overshooting senior role)
 *   - Open-ended "X+" bands: only penalize if X > user + 4
 *
 * Returns 0 (neutral) when either side cannot be parsed — never injects noise.
 */
export function experienceGapPenalty(userYears: number | null, band: { min: number; max: number | null } | null): number {
  if (userYears == null || !band) return 0;
  const { min, max } = band;

  // Underqualified — listing wants more than user has
  if (min > userYears + 4) return -20;

  // Open-ended "X+" — only neutral or slight negative if X is far above user
  if (max == null) {
    if (min <= userYears + 2) return 0; // user qualifies
    return -10; // marginally underqualified
  }

  // User is within band (with 1-yr grace either side) — perfect match
  if (userYears >= min - 1 && userYears <= max + 1) return 6;

  // Wildly overqualified — band tops out at half or less of user's experience.
  // This is the Farheen-case junior pollution signal.
  if (max * 2 <= userYears) return -25;

  // Mildly overqualified — band max below user but within 4 yrs
  if (max < userYears && max + 4 >= userYears) return 0;

  // Heavily overqualified — band max well below user but not extreme
  return -12;
}

type ApifyJob = {
  title?: string;
  companyName?: string;
  jdURL?: string;
  jobDescription?: string;
  tagsAndSkills?: string;
  experience?: string;
  experienceText?: string;
  minimumExperience?: string | number;
  maximumExperience?: string | number;
  salary?: string;
  salaryDetail?: { hideSalary?: boolean; minimumSalary?: number; maximumSalary?: number; label?: string };
  location?: string;
  footerPlaceholderLabel?: string;
  createdDate?: string;
  companyJobsUrl?: string;
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Returns true if the user skill is "present" in the haystack.
 * Tries three strategies in order:
 *   1. Direct contiguous substring (existing behavior)
 *   2. All sub-tokens of the skill (≥3 chars each) appear somewhere
 *      in haystack (handles "Node.js" → "node js" → matches "node"
 *      and "js" anywhere)
 *   3. Any synonym from SKILL_SYNONYMS[skill] matches via 1 or 2
 * Tokens shorter than 3 chars are excluded to avoid false positives
 * on fragments like "ai", "ml", "go" that smuggle into unrelated tags.
 *
 * Inputs are expected pre-normalized via normalizeText (lowercase,
 * alphanumerics + single spaces). The synonym map key is the user's
 * raw skill normalized with the SAME function — we re-derive it here
 * for callers that pass normalized input directly.
 */
export function skillPresent(skillNorm: string, haystackNorm: string): boolean {
  if (!skillNorm || !haystackNorm) return false;

  // Strategy 1: direct contiguous substring (only meaningful if skill
  // itself is ≥3 chars — shorter skills are noise-prone, fall through).
  if (skillNorm.length >= 3 && haystackNorm.includes(skillNorm)) return true;

  // Strategy 2: token-aware. Split the skill on whitespace, keep tokens
  // ≥3 chars, require ALL of them to appear somewhere in haystack.
  const tokens = skillNorm.split(" ").filter((t) => t.length >= 3);
  if (tokens.length > 0 && tokens.every((t) => haystackNorm.includes(t))) {
    return true;
  }

  // Strategy 3: synonyms. Look up by the normalized skill — but the map
  // keys may contain punctuation (e.g. "node.js", "a/b testing", "ci/cd"),
  // so try both the normalized form and a punctuation-preserving lookup.
  const variants = SKILL_SYNONYMS[skillNorm] ?? lookupSynonymsLoose(skillNorm);
  if (variants) {
    for (const variant of variants) {
      const vNorm = normalizeText(variant);
      if (vNorm.length >= 3 && haystackNorm.includes(vNorm)) return true;
      const vTokens = vNorm.split(" ").filter((t) => t.length >= 3);
      if (vTokens.length > 0 && vTokens.every((t) => haystackNorm.includes(t))) {
        return true;
      }
    }
  }

  return false;
}

// Map keys may carry punctuation (node.js, a/b testing, ci/cd, go-to-market…).
// Caller passes a normalized skill, so we also try matching against keys after
// normalizing the keys themselves. Built once per cold start.
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

function normalizeCity(city: string) {
  return city.replace(/\(.*?\)/g, "").split(/,|\//)[0]?.trim() || "India";
}

function slugify(text: string) {
  return text
    .replace(/[^\w\s]/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-") || "jobs";
}

function isExecutiveTitle(role: string) {
  const lower = role.toLowerCase();
  return EXECUTIVE_HINTS.some((hint) => lower.includes(hint));
}

// "Senior Product Manager" => ["product","manager"] but stop tokens removed.
// Keep the ANCHOR tokens — these MUST appear in the listing or it's dropped.
function getAnchorTokens(role: string): string[] {
  const tokens = normalizeText(role).split(" ").filter(Boolean);
  // Anchors are the non-stop, length>2 tokens. If none survive, fall back to longest word.
  const filtered = tokens.filter((t) => t.length > 2 && !STOP_TOKENS.has(t));
  if (filtered.length > 0) return filtered;
  return tokens.length ? [tokens.sort((a, b) => b.length - a.length)[0]] : [];
}

// Compress a long role string into a clean 2–3 token search query that Naukri
// actually recognises. "Digital Marketing Manager - Growth & Demand Generation Leader"
// → "digital-marketing-manager". Without this, Naukri returns junk results that
// then fail our relevance gate and the user sees an empty jobs tab.
function compressRoleForSearch(role: string): string {
  const tokens = normalizeText(role).split(" ").filter(Boolean);
  // Keep the first 3 non-stop tokens; if all are stop, fall back to first 3.
  const core = tokens.filter((t) => t.length > 2 && !STOP_TOKENS.has(t)).slice(0, 3);
  if (core.length >= 2) return core.join(" ");
  return tokens.slice(0, 3).join(" ") || role;
}

function buildSearchUrls(role: string, city: string) {
  const compactRole = compressRoleForSearch(role);
  const roleSlug = slugify(compactRole);
  const citySlug = slugify(normalizeCity(city));
  const naukriBoard = `https://www.naukri.com/${roleSlug}-jobs-in-${citySlug}`;
  return {
    naukri: naukriBoard,
    linkedin: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(compactRole)}&location=${encodeURIComponent(normalizeCity(city))}&f_TPR=r604800&sortBy=DD`,
    naukri_search_url: naukriBoard,
  };
}

function stripHtml(text?: string) {
  return (text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseDays(label?: string) {
  const lower = (label || "").toLowerCase();
  if (!lower) return null;
  if (lower.includes("just now") || lower.includes("today") || lower.includes("hour") || lower.includes("few hours")) return 0;
  const match = lower.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function isSalaryDisclosed(job: ApifyJob): boolean {
  if (job.salaryDetail?.hideSalary === false) return true;
  const salary = (job.salary || "").toLowerCase();
  if (!salary || salary.includes("not disclosed") || salary.includes("not specified")) return false;
  return /\d/.test(salary);
}

// Deterministic relevance scoring against the USER's role + skills.
// Returns { score, anchorMatched, skillOverlap, sharedSkills }
function scoreJobAgainstUser(job: ApifyJob, role: string, skills: string[]) {
  const haystackParts = [job.title, job.tagsAndSkills, stripHtml(job.jobDescription)].filter(Boolean).join(" ");
  const haystack = normalizeText(haystackParts);
  const titleHaystack = normalizeText(job.title || "");

  const anchors = getAnchorTokens(role);
  // ANCHOR rule: at least one anchor token MUST appear in the job TITLE (strict) — otherwise it's noise.
  const anchorInTitle = anchors.some((a) => titleHaystack.includes(a));
  const anchorInBody = anchors.filter((a) => haystack.includes(a)).length;

  // User skills overlap (computed against listing tags + body, not against itself).
  const userSkillsNorm = skills.map((s) => normalizeText(s)).filter((s) => s.length > 1);
  const sharedSkills = userSkillsNorm.filter((s) => skillPresent(s, haystack));
  const skillOverlapPct = userSkillsNorm.length ? sharedSkills.length / userSkillsNorm.length : 0;

  // Recency
  const days = parseDays(job.footerPlaceholderLabel);
  const recencyScore = days == null ? 0 : days <= 1 ? 3 : days <= 7 ? 2 : days <= 30 ? 1 : 0;

  // Composite
  const score =
    (anchorInTitle ? 10 : 0) +
    anchorInBody * 2 +
    sharedSkills.length * 4 +
    recencyScore;

  return {
    score,
    anchorInTitle,
    anchorInBody,
    sharedSkills, // returned in the listing's own casing
    skillOverlapPct,
  };
}

export function toMatchPct(opts: {
  anchorInTitle: boolean;
  sharedSkillsCount: number;
  userSkillsCount: number;
  recencyDays: number | null;
  experiencePenalty?: number; // from experienceGapPenalty(); -25..+6, default 0
}) {
  // Lower floor: was 60/65, now 40/55. Lets stretch jobs actually
  // read as stretches and creates real spread above them.
  let pct = opts.anchorInTitle ? 55 : 40;

  // Bigger skill bump: was max +25, now max +40. Skills do more work.
  if (opts.userSkillsCount > 0) {
    const overlap = Math.min(1, opts.sharedSkillsCount / opts.userSkillsCount);
    pct += Math.round(overlap * 40);
  } else if (opts.anchorInTitle) {
    pct += 10;
  }

  // NEW penalty: anchor-in-title with ZERO skill overlap is suspicious
  // (this catches Java jobs in a Node search, marketing jobs in a tele-
  // marketing search, etc.). Penalty does not apply when user has no
  // skills declared.
  if (opts.anchorInTitle && opts.userSkillsCount > 0 && opts.sharedSkillsCount === 0) {
    pct -= 10;
  }

  // Recency unchanged
  if (opts.recencyDays != null) {
    if (opts.recencyDays <= 1) pct += 4;
    else if (opts.recencyDays <= 7) pct += 2;
  }

  // Experience-gap penalty (Farheen-fix). Catches "11yr senior matched to 1-3yr role"
  // junior pollution, and "5yr engineer matched to staff/principal" overshooting.
  // Returns 0 when either side is unparseable, so this never injects spurious noise.
  if (typeof opts.experiencePenalty === "number") {
    pct += opts.experiencePenalty;
  }

  // Wider band: was 60-96, now 35-96. Stretch can mean stretch.
  return Math.max(35, Math.min(96, pct));
}

export function toMatchLabel(matchPct: number) {
  if (matchPct >= 80) return "Strong fit";   // was 85
  if (matchPct >= 65) return "Relevant";      // was 72
  return "Stretch";
}

function buildWhyFit(opts: {
  sharedSkills: string[];
  userSkillsCount: number;
  experience: string | null;
  postedLabel: string | null;
  anchorTokens: string[];
  anchorInTitle: boolean;
}) {
  const parts: string[] = [];
  if (opts.anchorInTitle) {
    parts.push(`Title matches your role (${opts.anchorTokens.slice(0, 2).join(" / ")})`);
  }
  if (opts.sharedSkills.length > 0) {
    parts.push(`${opts.sharedSkills.length}/${opts.userSkillsCount || opts.sharedSkills.length} of your skills present: ${opts.sharedSkills.slice(0, 3).join(", ")}`);
  } else if (opts.userSkillsCount > 0) {
    parts.push("None of your declared skills appear in this listing — verify before applying");
  }
  if (opts.experience) parts.push(`Experience band: ${opts.experience}`);
  if (opts.postedLabel) parts.push(`Posted ${opts.postedLabel.toLowerCase()}`);
  return parts.join(" · ");
}

function normalizeJobs(items: ApifyJob[], role: string, city: string, skills: string[]) {
  // Use the COMPRESSED role for anchor extraction. A 7-word job title shouldn't
  // require 7 anchor hits — that's why the gate was over-filtering and users
  // were seeing 0–2 jobs out of 50 scraped.
  const compactRole = compressRoleForSearch(role);
  const anchors = getAnchorTokens(compactRole);
  const userSkillsCount = skills.filter((s) => s && s.trim().length > 1).length;

  const scored = items
    .filter((item) => item.jdURL && item.title)
    .map((item) => {
      const s = scoreJobAgainstUser(item, compactRole, skills);
      const days = parseDays(item.footerPlaceholderLabel);
      const matchPct = toMatchPct({
        anchorInTitle: s.anchorInTitle,
        sharedSkillsCount: s.sharedSkills.length,
        userSkillsCount,
        recencyDays: days,
      });

      const tags = (item.tagsAndSkills || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 6);

      const expBand = item.experienceText || item.experience || null;
      const postedLabel = item.footerPlaceholderLabel || null;
      const whyFit = buildWhyFit({
        sharedSkills: s.sharedSkills,
        userSkillsCount,
        experience: expBand,
        postedLabel,
        anchorTokens: anchors,
        anchorInTitle: s.anchorInTitle,
      });

      return {
        title: item.title,
        company: item.companyName || "Hiring company",
        location: item.location || normalizeCity(city) || "India",
        salary: item.salary || "Not disclosed",
        salary_disclosed: isSalaryDisclosed(item),
        url: item.jdURL,
        company_jobs_url: item.companyJobsUrl || null,
        description_snippet: stripHtml(item.jobDescription).slice(0, 220),
        posted_label: postedLabel,
        posted_days: days,
        experience: expBand,
        tags,
        shared_skills: s.sharedSkills,
        verified_live: true,
        source: "apify_naukri",
        anchor_in_title: s.anchorInTitle,
        anchor_in_body: s.anchorInBody,
        match_pct: matchPct,
        match_label: toMatchLabel(matchPct),
        why_fit: whyFit,
        raw_score: s.score,
      };
    })
    // Relaxed relevance gate — keep a job if ANY of these is true:
    //  (a) anchor token in title (strict signal)
    //  (b) anchor token in body AND ≥1 of the user's skills is present
    //  (c) ≥2 user skills present (skill-led match for transferable roles)
    // The old gate (anchor-in-title OR ≥25% skill overlap) was dropping ~96% of
    // scraped jobs for niche or executive-flavoured titles, leaving the tab empty.
    .filter((j) => {
      if (j.anchor_in_title) return true;
      if (j.anchor_in_body > 0 && j.shared_skills.length >= 1) return true;
      if (j.shared_skills.length >= 2) return true;
      return false;
    })
    // Rank by match_pct first (what the user sees), then raw_score as tiebreaker.
    .sort((a, b) => (b.match_pct - a.match_pct) || (b.raw_score - a.raw_score))
    .slice(0, 10);

  return scored.map(({ raw_score, anchor_in_title, anchor_in_body, ...job }) => job);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const blocked = guardRequest(req, cors);
    if (blocked) return blocked;

    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }

    const { role, city, skills, force_refresh } = parsed.data;
    const isExecutive = parsed.data.is_executive || isExecutiveTitle(role);
    const searchUrls = buildSearchUrls(role, city);
    // v4: relaxed relevance gate + compressed search query (2026-04-24).
    // Bumping the version invalidates v3 cache entries that were over-filtered.
    const cacheKey = `apify-naukri-jobs:v4:${normalizeText(role)}:${normalizeText(city)}:${skills.slice(0, 5).map(normalizeText).sort().join("-")}:${isExecutive ? "exec" : "core"}`;
    const sb = createAdminClient();

    // Executive route: don't waste Apify credits — board search returns junk for C-suite roles.
    if (isExecutive) {
      return json({
        jobs: [],
        total_found: 0,
        executive_route: true,
        search_query: role,
        source: "apify_naukri",
        cached: false,
        data_age_minutes: 0,
        generated_at: new Date().toISOString(),
        search_urls: searchUrls,
        message: "Naukri public listings rarely surface confidential C-suite mandates. Use the search-firm routing below.",
        stats: { recent_count: 0, salary_disclosed_count: 0, total_returned: 0 },
      });
    }

    if (!force_refresh) {
      const { data: cached } = await sb.from("enrichment_cache").select("data, cached_at").eq("cache_key", cacheKey).maybeSingle();
      if (cached?.data && cached.cached_at) {
        const ageHours = (Date.now() - new Date(cached.cached_at).getTime()) / 36e5;
        if (ageHours < CACHE_TTL_HOURS) {
          return json({ ...(cached.data as Record<string, unknown>), cached: true, data_age_minutes: Math.round(ageHours * 60) });
        }
      }
    }

    const apiToken = Deno.env.get("APIFY_API_TOKEN");
    if (!apiToken) return json({ error: "APIFY_API_TOKEN is not configured" }, 500);

    // Use searchUrl mode for precision: /<role>-jobs-in-<city>
    const apifyUrl = `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${apiToken}`;
    const apifyResp = await fetch(apifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchUrl: searchUrls.naukri_search_url,
        maxJobs: RUN_LIMIT,
        freshness: "30",
        sortBy: "date",
        fetchDetails: false,
      }),
    });

    if (!apifyResp.ok) {
      const errorText = await apifyResp.text();
      return json({ error: `Apify request failed [${apifyResp.status}]`, details: errorText.slice(0, 400) }, 502);
    }

    const items = (await apifyResp.json()) as ApifyJob[];
    const jobs = normalizeJobs(Array.isArray(items) ? items : [], role, city, skills);
    const recentCount = jobs.filter((j) => j.posted_days != null && j.posted_days <= 7).length;
    const salaryDisclosedCount = jobs.filter((j) => j.salary_disclosed).length;

    const result = {
      jobs,
      total_found: jobs.length,
      total_scraped: Array.isArray(items) ? items.length : 0,
      executive_route: false,
      search_query: role,
      source: "apify_naukri",
      cached: false,
      data_age_minutes: 0,
      generated_at: new Date().toISOString(),
      search_urls: searchUrls,
      stats: {
        recent_count: recentCount,
        salary_disclosed_count: salaryDisclosedCount,
        total_returned: jobs.length,
      },
    };

    sb.from("enrichment_cache").upsert({ cache_key: cacheKey, data: result, cached_at: new Date().toISOString() }, { onConflict: "cache_key" }).then(() => {});
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});

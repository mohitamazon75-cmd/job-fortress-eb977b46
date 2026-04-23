import { z } from "https://esm.sh/zod@3.25.76";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";

const APIFY_ACTOR_ID = "alpcnRV9YI9lYVPWk";
const CACHE_TTL_HOURS = 6;
const RUN_LIMIT = 50;

const RequestSchema = z.object({
  role: z.string().min(2).max(120),
  city: z.string().max(80).optional().default("India"),
  skills: z.array(z.string().min(1).max(40)).optional().default([]),
  experience: z.string().max(30).optional().default(""),
  is_executive: z.boolean().optional().default(false),
});

type ApifyJob = {
  title?: string;
  companyName?: string;
  jdURL?: string;
  jobDescription?: string;
  tagsAndSkills?: string;
  experience?: string;
  experienceText?: string;
  salary?: string;
  location?: string;
  footerPlaceholderLabel?: string;
  createdDate?: string;
  companyJobsUrl?: string;
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeCity(city: string) {
  return city.replace(/\(.*?\)/g, "").split(/,|\//)[0]?.trim() || "India";
}

function buildKeyword(role: string, city: string, skills: string[], isExecutive: boolean) {
  const skillTail = isExecutive ? "" : ` ${skills.slice(0, 2).join(" ")}`;
  return `${role} ${normalizeCity(city)}${skillTail}`.trim();
}

function buildSearchUrls(role: string, city: string) {
  const roleSlug = role.replace(/[^\w\s]/g, " ").trim().toLowerCase().replace(/\s+/g, "-") || "jobs";
  const citySlug = normalizeCity(city).toLowerCase().replace(/\s+/g, "-") || "india";
  return {
    naukri: `https://www.naukri.com/${roleSlug}-jobs-in-${citySlug}`,
    linkedin: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(role)}&location=${encodeURIComponent(normalizeCity(city))}&f_TPR=r604800&sortBy=DD`,
  };
}

function stripHtml(text?: string) {
  return (text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseDays(label?: string) {
  const lower = (label || "").toLowerCase();
  if (!lower) return null;
  if (lower.includes("today") || lower.includes("hour")) return 0;
  const match = lower.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function scoreJob(job: ApifyJob, role: string, city: string, skills: string[]) {
  const haystack = normalizeText([job.title, job.jobDescription, job.tagsAndSkills, job.companyName].filter(Boolean).join(" "));
  const roleTokens = normalizeText(role).split(" ").filter((token) => token.length > 2 && !["and", "the", "for", "with"].includes(token));
  const roleHits = roleTokens.filter((token) => haystack.includes(token)).length;
  const skillHits = skills.slice(0, 4).filter((skill) => haystack.includes(normalizeText(skill))).length;
  const cityHit = normalizeText(job.location || "").includes(normalizeText(normalizeCity(city))) ? 2 : /remote|india/.test(normalizeText(job.location || "")) ? 1 : 0;
  const recency = (() => {
    const days = parseDays(job.footerPlaceholderLabel);
    if (days == null) return 0;
    if (days <= 1) return 2;
    if (days <= 7) return 1;
    return 0;
  })();
  return roleHits * 5 + skillHits * 2 + cityHit + recency;
}

function toMatchPct(score: number) {
  return Math.max(58, Math.min(95, 60 + score * 4));
}

function toMatchLabel(matchPct: number) {
  if (matchPct >= 85) return "Strong fit";
  if (matchPct >= 72) return "Relevant";
  return "Stretch";
}

function normalizeJobs(items: ApifyJob[], role: string, city: string, skills: string[]) {
  return items
    .filter((item) => item.jdURL && item.title)
    .map((item) => {
      const score = scoreJob(item, role, city, skills);
      const matchPct = toMatchPct(score);
      const tags = (item.tagsAndSkills || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 5);
      const whyFit = [
        tags.length ? `Skill overlap: ${tags.slice(0, 3).join(", ")}` : null,
        item.experienceText || item.experience ? `Experience band: ${item.experienceText || item.experience}` : null,
        item.footerPlaceholderLabel ? `Freshness: ${item.footerPlaceholderLabel}` : null,
      ].filter(Boolean).join(" · ");

      return {
        title: item.title,
        company: item.companyName || "Hiring company",
        location: item.location || city || "India",
        salary: item.salary || "Not disclosed",
        url: item.jdURL,
        company_jobs_url: item.companyJobsUrl || null,
        description_snippet: stripHtml(item.jobDescription).slice(0, 220),
        posted_label: item.footerPlaceholderLabel || null,
        experience: item.experienceText || item.experience || null,
        tags,
        verified_live: true,
        source: "apify_naukri",
        match_pct: matchPct,
        match_label: toMatchLabel(matchPct),
        why_fit: whyFit || "Live Naukri listing matched against your current role and skills.",
        raw_score: score,
      };
    })
    .sort((a, b) => b.raw_score - a.raw_score)
    .slice(0, 8)
    .map(({ raw_score, ...job }) => job);
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

    const { role, city, skills, is_executive } = parsed.data;
    const searchUrls = buildSearchUrls(role, city);
    const cacheKey = `apify-naukri-jobs:v1:${normalizeText(role)}:${normalizeText(city)}:${skills.slice(0, 3).map(normalizeText).join("-")}:${is_executive ? "exec" : "core"}`;
    const sb = createAdminClient();

    const { data: cached } = await sb.from("enrichment_cache").select("data, cached_at").eq("cache_key", cacheKey).maybeSingle();
    if (cached?.data && cached.cached_at) {
      const ageHours = (Date.now() - new Date(cached.cached_at).getTime()) / 36e5;
      if (ageHours < CACHE_TTL_HOURS) {
        return json({ ...(cached.data as Record<string, unknown>), cached: true, data_age_minutes: Math.round(ageHours * 60) });
      }
    }

    const apiToken = Deno.env.get("APIFY_API_TOKEN");
    if (!apiToken) return json({ error: "APIFY_API_TOKEN is not configured" }, 500);

    const apifyUrl = `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${apiToken}`;
    const keyword = buildKeyword(role, city, skills, is_executive);
    const apifyResp = await fetch(apifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword,
        maxJobs: RUN_LIMIT,
        freshness: "all",
        sortBy: "relevance",
        experience: "all",
        fetchDetails: false,
      }),
    });

    if (!apifyResp.ok) {
      const errorText = await apifyResp.text();
      return json({ error: `Apify request failed [${apifyResp.status}]`, details: errorText.slice(0, 400) }, 502);
    }

    const items = (await apifyResp.json()) as ApifyJob[];
    const jobs = normalizeJobs(Array.isArray(items) ? items : [], role, city, skills);
    const result = {
      jobs,
      total_found: jobs.length,
      search_query: keyword,
      source: "apify_naukri",
      cached: false,
      data_age_minutes: 0,
      generated_at: new Date().toISOString(),
      search_urls: searchUrls,
      stats: {
        recent_count: jobs.filter((job) => {
          const days = parseDays(job.posted_label || undefined);
          return days != null && days <= 7;
        }).length,
        named_companies: new Set(jobs.map((job) => job.company).filter(Boolean)).size,
      },
    };

    sb.from("enrichment_cache").upsert({ cache_key: cacheKey, data: result, cached_at: new Date().toISOString() }, { onConflict: "cache_key" }).then(() => {});
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});

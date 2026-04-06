/**
 * @fileoverview External data gathering for the scan pipeline.
 * All third-party API calls (resume parsing, LinkedIn, Firecrawl, Tavily)
 * are consolidated here. Each source fails gracefully — partial results
 * are always returned, never thrown.
 *
 * Used by: process-scan/index.ts
 */

import { sanitizeInput } from "../_shared/scan-helpers.ts";
import { fetchWithBackoff, AI_URL } from "../_shared/ai-agent-caller.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";
import {
  extractLinkedinSlug,
  sanitizeEvidenceSnippet,
  isTrustedLinkedinResult,
  stripUnverifiedNumbers,
} from "../_shared/scan-utils.ts";
import { inferFromLinkedinUrl, parseExperienceYears } from "../_shared/scan-helpers.ts";

// ── Types ──

export interface EnrichmentInput {
  scan: {
    linkedin_url: string | null;
    resume_file_path: string | null;
    years_experience: string | null;
    metro_tier: string | null;
    industry: string | null;
  };
  hasResume: boolean;
  activeModel: string;
  supabaseClient: any;
}

export interface EnrichmentResult {
  rawProfileText: string;
  profileExtractionConfidence: string;
  linkedinName: string | null;
  linkedinCompany: string | null;
  parsedLinkedinIndustry: string | null;
  parsedLinkedinRole: string | null;
  normalizedExperienceYears: number | null;
  resumeExtractedYears: number | null;
}

// ── Constants ──

const RESUME_PARSE_TIMEOUT_MS = 25_000;
const LINKEDIN_PARSE_TIMEOUT_MS = 10_000;

// ── Internal helpers ──

function createTimeoutController(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

// ── Resume Parsing ──

async function parseResume(
  supabaseClient: any,
  resumeFilePath: string,
  activeModel: string,
): Promise<{
  rawText: string;
  name: string | null;
  company: string | null;
  industry: string | null;
  role: string | null;
  confidence: string;
  extractedYears: number | null;
}> {
  const fallback = { rawText: "", name: null, company: null, industry: null, role: null, confidence: "low", extractedYears: null };

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return fallback;

  try {
    const { data: fileData, error: dlError } = await supabaseClient.storage.from("resumes").download(resumeFilePath);
    if (dlError || !fileData) return fallback;

    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const resumeBase64 = btoa(binary);

    const { signal, cancel } = createTimeoutController(RESUME_PARSE_TIMEOUT_MS);
    try {
      const aiResp = await fetch(AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: activeModel,
          messages: [
            {
              role: "system",
              content: `You are a resume parser. Extract structured career data from the resume. Return ONLY valid JSON:\n{\n  "name": string,\n  "headline": string (VERBATIM job title from resume — copy character by character, NEVER upgrade or inflate),\n  "company": string (current/most recent company),\n  "location": string,\n  "skills": [string] (specific granular skills, NOT broad categories — aim for 15-25),\n  "experience": [{"title": string, "company": string, "duration": string}],\n  "education": [{"degree": string, "institution": string}],\n  "inferredIndustry": string,\n  "yearsOfExperience": number\n}\nCRITICAL: headline MUST be the EXACT title as written on the resume. If it says "Senior Manager", output "Senior Manager" NOT "Director". If it says "Digital Marketing Manager", output "Digital Marketing Manager" NOT "Marketing Director".\nNo markdown, no explanation, only JSON.`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Extract all professional data from this resume. The headline field MUST be the VERBATIM job title — do NOT upgrade, paraphrase, or inflate it:" },
                { type: "image_url", image_url: { url: `data:application/pdf;base64,${resumeBase64}` } },
              ],
            },
          ],
          temperature: 0.05,
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal,
      });
      cancel();

      if (!aiResp.ok) {
        await aiResp.text();
        return fallback;
      }

      const aiData = await aiResp.json();
      logTokenUsage("process-scan", "resume-parser", activeModel, aiData);
      const content = aiData.choices?.[0]?.message?.content;
      if (!content) return fallback;

      const parsed = JSON.parse(content);
      let rawText = `Name: ${parsed.name || "Unknown"}\nHeadline: ${parsed.headline || "Unknown"}\nCompany: ${parsed.company || "Unknown"}\nLocation: ${parsed.location || "Unknown"}\nSkills: ${(parsed.skills || []).join(", ")}\nYears of Experience: ${parsed.yearsOfExperience || "Unknown"}\n`;
      if (parsed.experience?.length > 0) {
        rawText += `Experience:\n`;
        for (const exp of parsed.experience) rawText += `  - ${exp.title} at ${exp.company} (${exp.duration})\n`;
      }

      let extractedYears: number | null = null;
      if (parsed.yearsOfExperience && typeof parsed.yearsOfExperience === "number" && parsed.yearsOfExperience > 0 && parsed.yearsOfExperience < 60) {
        extractedYears = parsed.yearsOfExperience;
      }

      console.debug(`[Ingestion] Resume parsed: name=${parsed.name ? "[present]" : "[absent]"}, role=${parsed.headline ? "[present]" : "[absent]"}, exp=${extractedYears ?? "absent"}`);

      return {
        rawText,
        name: parsed.name || null,
        company: parsed.company || null,
        industry: parsed.inferredIndustry || null,
        role: parsed.headline || null,
        confidence: "high",
        extractedYears,
      };
    } catch (e) {
      cancel();
      if (e instanceof Error && e.name === "AbortError") {
        console.error("[Ingestion] Resume parsing timed out");
      } else {
        console.error("[Ingestion] Resume parsing JSON failed:", e);
      }
      return fallback;
    }
  } catch (e) {
    console.error("[Ingestion] Resume parsing failed:", e);
    return fallback;
  }
}

// ── LinkedIn Enrichment (parse-linkedin + Firecrawl + Tavily) ──

async function enrichFromLinkedin(
  linkedinUrl: string,
  supabaseClient: any,
  linkedinInferenceName: string | null,
): Promise<{
  rawText: string;
  confidence: string;
  name: string | null;
  company: string | null;
  industry: string | null;
  role: string | null;
}> {
  let rawProfileText = "";
  let confidence = "low";
  let name: string | null = null;
  let company: string | null = null;
  let industry: string | null = null;
  let role: string | null = null;
  const linkedinSlug = extractLinkedinSlug(linkedinUrl);

  try {
    // Step 1: parse-linkedin edge function
    const parseUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/parse-linkedin`;
    const { signal: parseSignal, cancel: parseCancel } = createTimeoutController(LINKEDIN_PARSE_TIMEOUT_MS);
    try {
      const parseResp = await fetch(parseUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrl }),
        signal: parseSignal,
      });
      parseCancel();

      if (parseResp.ok) {
        const profile = await parseResp.json();
        confidence = profile.extraction_confidence || profile.rawExtractionQuality || "low";
        name = profile.name && profile.name !== "Unknown" ? profile.name : linkedinInferenceName;
        company = profile.company || null;
        industry = profile.suggestedIndustry || profile.matchedIndustry || null;
        role = profile.headline || profile.matchedJobFamily || null;

        if (profile.name && profile.name !== "Unknown") rawProfileText += `Name: ${profile.name}\n`;
        if (profile.headline && profile.headline !== "Unknown" && profile.headline !== "Professional") rawProfileText += `Headline: ${profile.headline}\n`;
        if (profile.company) rawProfileText += `Company: ${profile.company}\n`;
        if (profile.location) rawProfileText += `Location: ${profile.location}\n`;
        if (profile.skills?.length > 0) rawProfileText += `Skills: ${profile.skills.join(", ")}\n`;
        if (profile.experience?.length > 0) {
          rawProfileText += `Experience:\n`;
          for (const exp of profile.experience) rawProfileText += `  - ${exp.title} at ${exp.company} (${exp.duration})\n`;
        }
        if (profile.matchedSkills?.length > 0) {
          rawProfileText += `\nSkill Risk Matches:\n`;
          for (const ms of profile.matchedSkills) rawProfileText += `  - ${ms.profile_skill} → automation risk: ${ms.automation_risk}%\n`;
        }

        if (confidence === "low") {
          rawProfileText += `\n⚠️ DATA QUALITY WARNING: Profile data was extracted from search snippets (NOT a direct LinkedIn page scrape). Data may be incomplete or contain errors. Do NOT fabricate details. Use null for any field you cannot verify from the text above.\n`;
        }

        console.log(`[Ingestion] LinkedIn parsed: confidence=${confidence}, name=${name ? "[present]" : "[absent]"}, role=${role ? "[present]" : "[absent]"}, company=${company ? "[present]" : "[absent]"}`);
      } else {
        await parseResp.text();
      }
    } catch (e) {
      parseCancel();
      console.error("[Ingestion] parse-linkedin call failed:", e);
    }

    // Step 2: Firecrawl enrichment
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (FIRECRAWL_API_KEY) {
      try {
        const scrapeResp = await fetchWithBackoff("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: linkedinUrl, formats: ["markdown"], onlyMainContent: true }),
        });

        if (scrapeResp.ok) {
          const d = await scrapeResp.json();
          const md = d?.data?.markdown;
          if (md && md.length > 200) rawProfileText += `\n--- Raw LinkedIn Profile ---\n${sanitizeInput(md.slice(0, 4000))}\n`;
        } else {
          await scrapeResp.text();

          // Fallback to Firecrawl search
          const searchQuery = linkedinSlug
            ? `site:linkedin.com/in/${linkedinSlug} "${linkedinSlug.replace(/-/g, " ")}"`
            : `site:linkedin.com/in/ "${(name || "").trim()}" professional`;

          const searchResp = await fetchWithBackoff("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ query: searchQuery, limit: 5, lang: "en" }),
          });

          if (searchResp.ok) {
            const searchData = await searchResp.json();
            const snippets = (searchData?.data || [])
              .filter((item: any) => isTrustedLinkedinResult(String(item.url || item.link || ""), String(item.title || ""), String(item.description || ""), linkedinSlug))
              .map((item: any) => `${item.title || "LinkedIn"}: ${sanitizeEvidenceSnippet(String(item.description || ""), 240)}`)
              .filter(Boolean)
              .slice(0, 3);

            if (snippets.length > 0) rawProfileText += `\n--- Search Profile Data ---\n${sanitizeInput(snippets.join("\n"))}\n`;
          }
        }
      } catch (e) {
        console.error("[Ingestion] Firecrawl failed:", e);
      }
    }

    // Step 3: Tavily enrichment (when profile data is thin)
    const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
    if (TAVILY_API_KEY && rawProfileText.length < 800) {
      try {
        const nameGuess = linkedinSlug
          .split(/[-_]+/)
          .filter(Boolean)
          .slice(0, 3)
          .map((t: string) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
          .join(" ");
        const tavilyQuery = linkedinSlug
          ? `site:linkedin.com/in/${linkedinSlug} "${nameGuess || linkedinSlug.replace(/[-_]+/g, " ")}"`
          : `site:linkedin.com/in/ "${nameGuess || name || "professional"}" professional experience`;

        console.log(`[Ingestion] Tavily enrichment (strict) — raw profile text ${rawProfileText.length} chars`);
        const tavilyResp = await fetchWithBackoff("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: TAVILY_API_KEY,
            query: tavilyQuery,
            search_depth: "advanced",
            max_results: 5,
            include_answer: false,
            include_domains: ["linkedin.com"],
          }),
        });

        if (tavilyResp.ok) {
          const tavilyData = await tavilyResp.json();
          const tavilyParts = (tavilyData.results || [])
            .filter((r: any) => isTrustedLinkedinResult(String(r.url || ""), String(r.title || ""), String(r.content || ""), linkedinSlug))
            .map((r: any) => `${r.title || "LinkedIn Profile"}\n${sanitizeEvidenceSnippet(String(r.content || ""), 600)}`)
            .filter(Boolean)
            .slice(0, 3);

          if (tavilyParts.length > 0) {
            rawProfileText += `\n--- Tavily Profile Intelligence ---\n${sanitizeInput(tavilyParts.join("\n\n").slice(0, 2500))}\n`;
            console.log(`[Ingestion] Tavily added ${tavilyParts.length} trusted LinkedIn blocks, total profile text now ${rawProfileText.length} chars`);
          } else {
            console.log("[Ingestion] Tavily returned no trusted LinkedIn blocks; skipped");
          }
        }
      } catch (e) {
        console.error("[Ingestion] Tavily enrichment failed:", e);
      }
    }
  } catch (e) {
    console.error("[Ingestion] LinkedIn scrape failed:", e);
  }

  return { rawText: rawProfileText, confidence, name, company, industry, role };
}

// ── Main Enrichment Orchestrator ──

/**
 * Gathers all external profile data (resume + LinkedIn + Firecrawl + Tavily).
 * Each source fails gracefully — partial results are always returned.
 *
 * @param input - Scan data and configuration
 * @returns Enrichment results with profile text and extracted metadata
 */
/**
 * gatherEnrichmentData — Collects external data from all available sources.
 *
 * @param input - EnrichmentInput with resume path, LinkedIn URL, API keys, scan context
 * @returns EnrichmentResult with resume text, LinkedIn data, Firecrawl/Tavily results
 * @notes Each source fails independently — partial results always returned, never thrown.
 *        All external calls use AbortController with 15s timeouts.
 */
export async function gatherEnrichmentData(input: EnrichmentInput): Promise<EnrichmentResult> {
  const { scan, hasResume, activeModel, supabaseClient } = input;
  const linkedinInference = inferFromLinkedinUrl(scan.linkedin_url);
  let normalizedExperienceYears = parseExperienceYears(scan.years_experience);

  let rawProfileText = "";
  let profileExtractionConfidence = "medium";
  let linkedinName: string | null = null;
  let linkedinCompany: string | null = null;
  let parsedLinkedinIndustry: string | null = null;
  let parsedLinkedinRole: string | null = null;
  let resumeExtractedYears: number | null = null;

  // Resume parsing (takes priority)
  if (hasResume && scan.resume_file_path) {
    console.log(`[Ingestion] Parsing resume: ${scan.resume_file_path}`);
    const resumeResult = await parseResume(supabaseClient, scan.resume_file_path, activeModel);
    rawProfileText = resumeResult.rawText;
    profileExtractionConfidence = resumeResult.confidence;
    linkedinName = resumeResult.name;
    linkedinCompany = resumeResult.company;
    parsedLinkedinIndustry = resumeResult.industry;
    parsedLinkedinRole = resumeResult.role;
    resumeExtractedYears = resumeResult.extractedYears;

    // Reconcile experience: resume is ground truth
    if (resumeExtractedYears !== null) {
      if (normalizedExperienceYears !== null && Math.abs(resumeExtractedYears - normalizedExperienceYears) > 2) {
        console.debug(`[Ingestion] Experience conflict: user selected "${scan.years_experience}" (${normalizedExperienceYears}y) but resume shows ${resumeExtractedYears}y — using resume value`);
        normalizedExperienceYears = resumeExtractedYears;
      } else if (normalizedExperienceYears === null) {
        normalizedExperienceYears = resumeExtractedYears;
      }
    }
  }

  // LinkedIn enrichment (only if no resume)
  if (scan.linkedin_url && !hasResume) {
    const linkedinResult = await enrichFromLinkedin(
      scan.linkedin_url,
      supabaseClient,
      linkedinInference.inferredName,
    );
    rawProfileText = linkedinResult.rawText;
    profileExtractionConfidence = linkedinResult.confidence;
    linkedinName = linkedinResult.name;
    linkedinCompany = linkedinResult.company;
    parsedLinkedinIndustry = linkedinResult.industry;
    parsedLinkedinRole = linkedinResult.role;
  }

  return {
    rawProfileText,
    profileExtractionConfidence,
    linkedinName,
    linkedinCompany,
    parsedLinkedinIndustry,
    parsedLinkedinRole,
    normalizedExperienceYears,
    resumeExtractedYears,
  };
}

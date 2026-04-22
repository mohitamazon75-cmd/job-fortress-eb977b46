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
import { parseResumeWithAffinda } from "../_shared/affinda-parser.ts";

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

    // Launch Affinda in parallel with the LLM vision call.
    // Affinda gives accurate years-from-dates and structured certifications.
    // ZERO REGRESSION: if Affinda fails/absent, affindaResult is null and
    // the LLM output is used unchanged. No await blocking the LLM path.
    const affindaPromise = parseResumeWithAffinda(resumeBase64).catch(() => null);

    // When Gemini fails (non-2xx, empty content, timeout, JSON parse error),
    // await the parallel Affinda call and use its structured data as rescue.
    // PR #21 only applied the Affinda fallback on the happy path; this closure
    // broadens the rescue to every Gemini-failure site below. Builds a minimal
    // rawText from Affinda's available fields (role, years, certs, edu tier) so
    // Agent 1 still has input to extract from, even without Gemini's rich output.
    const buildAffindaFallback = async (): Promise<{
      rawText: string;
      name: string | null;
      company: string | null;
      industry: string | null;
      role: string | null;
      confidence: string;
      extractedYears: number | null;
    }> => {
      const aff = await affindaPromise;
      if (aff?.current_job_title) {
        let rescueRawText = `Name: Unknown\nCurrent Role: ${aff.current_job_title}\n`;
        if (aff.accurate_years_experience !== null) {
          rescueRawText += `Years Experience: ${aff.accurate_years_experience}\n`;
        }
        if (aff.certifications && aff.certifications.length > 0) {
          rescueRawText += `Certifications: ${aff.certifications.join(", ")}\n`;
        }
        if (aff.education_tier) {
          rescueRawText += `Education Tier: ${aff.education_tier === "tier1" ? "Tier-1 India institution (IIT/NIT/IIM equivalent)" : "Tier-2 institution"}\n`;
        }
        rescueRawText += `\n(Resume parsed via Affinda structured extraction — Gemini vision unavailable. Data is from structured fields only; limited skills/achievements context.)`;
        console.log(`[parseResume] Gemini failed — Affinda rescue: role="${aff.current_job_title}" years=${aff.accurate_years_experience ?? "null"} certs=${aff.certifications?.length ?? 0}`);
        return {
          rawText: rescueRawText,
          name: null,
          company: null,
          industry: null,
          role: aff.current_job_title,
          confidence: "low",
          extractedYears: aff.accurate_years_experience,
        };
      }
      console.log(`[parseResume] Gemini failed — Affinda has no title either — no rescue available`);
      return fallback;
    };

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
              content: `You are an expert resume analyst. Extract every professionally meaningful detail from this resume. Return ONLY valid JSON — no markdown, no explanation.

SCHEMA:
{
  "name": string,
  "headline": string (VERBATIM job title — copy character by character, never upgrade or inflate),
  "company": string (current/most recent company),
  "location": string,
  "yearsOfExperience": number,
  "inferredIndustry": string,
  "inferredSubSector": string (specific sub-sector: e.g. "Fintech SaaS", "IT Services & Outsourcing", "E-commerce Platform"),
  "skills": [string] (SPECIFIC granular skills only — 15-25 items. Good: "React.js", "PostgreSQL", "Jest unit testing", "CI/CD with GitHub Actions", "REST API design", "Agile sprint planning". Bad: "programming", "communication", "teamwork", "presentation"),
  "techStack": [string] (every specific technology, language, framework, tool, platform mentioned anywhere in the resume — be exhaustive: "Python", "AWS Lambda", "Docker", "Kubernetes", "Selenium", "Jenkins", "Jira", "Confluence", "Figma", "Tableau", etc.),
  "certifications": [string] (AWS Certified, Google Cloud, PMP, Scrum Master, CFA, etc.),
  "experience": [
    {
      "title": string,
      "company": string,
      "duration": string,
      "keyAchievements": [string] (extract 2-4 bullet-point achievements verbatim or paraphrased closely — include numbers, metrics, scope: "Led migration of 3 legacy services to microservices, reducing latency by 40%", "Managed team of 8 engineers across 2 locations", "Built real-time inventory system handling 50K daily transactions"),
      "technologiesUsed": [string] (specific tech used in THIS role)
    }
  ],
  "education": [{ "degree": string, "institution": string, "year": string | null }],
  "projects": [{ "name": string, "description": string, "techUsed": [string] }],
  "openSource": string | null (any GitHub, open source, publications mentioned),
  "domainExpertise": [string] (deep domain knowledge signals: "payments processing", "healthcare compliance", "supply chain optimization", "credit risk modeling" — NOT generic skills)
}

CRITICAL RULES:
- headline MUST be the EXACT title from the resume. Never upgrade. "Senior QA Engineer" stays "Senior QA Engineer".
- skills: extract from ALL sections — skills section, experience bullets, projects, certifications. If resume mentions "Selenium WebDriver" extract "Selenium WebDriver", not "testing".
- keyAchievements: this is the most important field. Extract real numbers and impact. "Improved test coverage from 40% to 85%" is gold. "Responsible for testing" is useless.
- techStack: be exhaustive. If resume says "worked with AWS services including EC2, S3, RDS, Lambda" — extract all four separately.
- domainExpertise: what industry problems has this person solved? "e-commerce checkout optimization", "banking fraud detection", "clinical trial data management" etc.`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Extract every professional detail from this resume. Be exhaustive on skills, technologies, and achievements. The headline MUST be verbatim — do NOT upgrade or inflate:" },
                { type: "file", file: { filename: "resume.pdf", file_data: `data:application/pdf;base64,${resumeBase64}` } },
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
        return await buildAffindaFallback();
      }

      const aiData = await aiResp.json();
      logTokenUsage("process-scan", "resume-parser", activeModel, aiData);
      const content = aiData.choices?.[0]?.message?.content;
      if (!content) return await buildAffindaFallback();

      const parsed = JSON.parse(content);

      // Build a rich profile text that gives Agent 1 the full picture.
      // Previously we only passed: Name, Headline, flat Skills list, and job title+company.
      // That caused Agent 1 to use surface-level skills ("presentation", "manual testing")
      // instead of the real technical depth visible in the resume.
      let rawText = `Name: ${parsed.name || "Unknown"}\nHeadline: ${parsed.headline || "Unknown"}\nCompany: ${parsed.company || "Unknown"}\nLocation: ${parsed.location || "Unknown"}\nYears of Experience: ${parsed.yearsOfExperience || "Unknown"}\nInferred Industry: ${parsed.inferredIndustry || "Unknown"}\nInferred Sub-Sector: ${parsed.inferredSubSector || "Unknown"}\n`;

      // Skills — full granular list
      if (parsed.skills?.length > 0) {
        rawText += `\nSpecific Skills: ${parsed.skills.join(", ")}\n`;
      }

      // Tech stack — exhaustive
      if (parsed.techStack?.length > 0) {
        rawText += `Technology Stack: ${parsed.techStack.join(", ")}\n`;
      }

      // Certifications
      if (parsed.certifications?.length > 0) {
        rawText += `Certifications: ${parsed.certifications.join(", ")}\n`;
      }

      // Domain expertise
      if (parsed.domainExpertise?.length > 0) {
        rawText += `Domain Expertise: ${parsed.domainExpertise.join(", ")}\n`;
      }

      // Experience WITH achievements and role-specific tech
      if (parsed.experience?.length > 0) {
        rawText += `\nWork Experience:\n`;
        for (const exp of parsed.experience) {
          rawText += `  ${exp.title} at ${exp.company} (${exp.duration})\n`;
          if (exp.technologiesUsed?.length > 0) {
            rawText += `    Technologies: ${exp.technologiesUsed.join(", ")}\n`;
          }
          if (exp.keyAchievements?.length > 0) {
            for (const ach of exp.keyAchievements) {
              rawText += `    • ${ach}\n`;
            }
          }
        }
      }

      // Projects
      if (parsed.projects?.length > 0) {
        rawText += `\nProjects:\n`;
        for (const proj of parsed.projects) {
          rawText += `  ${proj.name}: ${proj.description}`;
          if (proj.techUsed?.length > 0) rawText += ` [${proj.techUsed.join(", ")}]`;
          rawText += `\n`;
        }
      }

      // Open source / publications
      if (parsed.openSource) {
        rawText += `\nOpen Source / Publications: ${parsed.openSource}\n`;
      }

      let extractedYears: number | null = null;
      if (parsed.yearsOfExperience && typeof parsed.yearsOfExperience === "number" && parsed.yearsOfExperience > 0 && parsed.yearsOfExperience < 60) {
        extractedYears = parsed.yearsOfExperience;
      }

      // Await Affinda result (was launched in parallel with this LLM call)
      // If Affinda has date-computed years: prefer it over LLM's text estimate
      // because it's derived from actual start/end dates, not prose inference.
      // This matters for the survivability score multipliers (>2yr, >5yr, >10yr).
      const affindaResult = await affindaPromise;
      if (affindaResult) {
        // Use Affinda years if they're meaningfully different from LLM (>6mo delta)
        // or if LLM had no years. Affinda wins on accuracy; LLM wins on coverage.
        if (affindaResult.accurate_years_experience !== null) {
          const llmYears = extractedYears ?? 0;
          const affYears = affindaResult.accurate_years_experience;
          if (extractedYears === null || Math.abs(affYears - llmYears) > 0.5) {
            console.log(`[Affinda] Experience override: LLM=${llmYears}yr → Affinda=${affYears}yr (date-computed)`);
            extractedYears = affYears;
          }
        }
        // Inject Affinda certifications not already in the LLM's cert list
        if (affindaResult.certifications.length > 0) {
          const existing = (parsed.certifications ?? []).map((c: string) => c.toLowerCase());
          const newCerts = affindaResult.certifications.filter(c => !existing.includes(c.toLowerCase()));
          if (newCerts.length > 0) {
            rawText += `\nAdditional Certifications (Affinda): ${newCerts.join(", ")}\n`;
            console.debug(`[Affinda] Injected ${newCerts.length} additional certs`);
          }
        }
        // Inject education tier signal for seniority calibration
        if (affindaResult.education_tier === "tier1") {
          rawText += `\nEducation Signal: Tier-1 India institution detected (IIT/NIT/IIM equivalent)\n`;
        }
      }

      console.debug(`[Ingestion] Resume parsed (rich): name=${parsed.name ? "[present]" : "[absent]"}, role=${parsed.headline ? "[present]" : "[absent]"}, skills=${parsed.skills?.length ?? 0}, tech=${parsed.techStack?.length ?? 0}, achievements=${parsed.experience?.reduce((n: number, e: any) => n + (e.keyAchievements?.length ?? 0), 0) ?? 0}, exp=${extractedYears ?? "absent"}${affindaResult ? " (affinda-verified)" : ""}`);

      // 3-layer role-extraction fallback (Day 2 fix for role_extraction_failed bug):
      // 1. Gemini's verbatim headline (best — exact title from resume top)
      // 2. Gemini's first experience entry title (good — structured backup)
      // 3. Affinda's most-recent workExperience[0].jobTitle (reliable structured extraction independent of vision LLM)
      const roleFromHeadline = (typeof parsed.headline === "string" && parsed.headline.trim()) ? parsed.headline.trim() : null;
      const roleFromExperience = (typeof parsed.experience?.[0]?.title === "string" && parsed.experience[0].title.trim()) ? parsed.experience[0].title.trim() : null;
      const roleFromAffinda = affindaResult?.current_job_title ?? null;
      const role = roleFromHeadline ?? roleFromExperience ?? roleFromAffinda ?? null;
      const roleSource = roleFromHeadline ? "headline" : roleFromExperience ? "experience[0]" : roleFromAffinda ? "affinda" : "NONE";
      console.log(`[parseResume] Role source: ${roleSource} | headline=${roleFromHeadline ? "present" : "null"} exp[0]=${roleFromExperience ? "present" : "null"} affinda=${roleFromAffinda ? "present" : "null"}`);

      return {
        rawText,
        name: parsed.name || null,
        company: parsed.company || null,
        industry: parsed.inferredIndustry || null,
        role,
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
      return await buildAffindaFallback();
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
        role = profile.experience?.[0]?.title || profile.headline || profile.matchedJobFamily || null;

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

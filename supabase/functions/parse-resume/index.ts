
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { validateBody, z } from "../_shared/validate-input.ts";

const ParseResumeSchema = z.object({
  resumeFilePath: z.string().min(1).max(512),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    // P0 hardening: require valid JWT — Affinda + LLM calls + reads user storage.
    const auth = await requireAuth(req, corsHeaders);
    if (auth.kind === "unauthorized") return auth.response;

    const validated = await validateBody(req, ParseResumeSchema, corsHeaders);
    if (validated.kind === "invalid") return validated.response;
    const { resumeFilePath } = validated.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI not configured", fallback: true }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createAdminClient();

    // Download the resume from storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from("resumes")
      .download(resumeFilePath);

    if (fileError || !fileData) {
      console.error("[parse-resume] Storage download failed:", fileError);
      return new Response(
        JSON.stringify({ error: "Failed to download resume", fallback: true }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mimeType = fileData.type || "application/pdf";

    // Use Gemini to extract structured data from the PDF
    const aiCtrl = new AbortController();
    const aiT = setTimeout(() => aiCtrl.abort(), 30_000);
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a resume parser. Extract structured career data from the resume. Return ONLY valid JSON:
{
  "name": string,
  "headline": string (VERBATIM job title from resume — copy it CHARACTER BY CHARACTER. NEVER upgrade, inflate, or paraphrase. If it says "Senior Manager", output "Senior Manager" NOT "Director". If it says "Digital Marketing Manager", output "Digital Marketing Manager" NOT "Marketing Director"),
  "company": string (current/most recent company),
  "location": string,
  "skills": [string] (all technical and professional skills — use SPECIFIC granular names like "SEO Optimization" not "Marketing". Aim for 15-25 skills),
  "experience": [{"title": string, "company": string, "duration": string}],
  "education": [{"degree": string, "institution": string}],
  "inferredIndustry": string (one of: "IT & Software", "Finance & Banking", "Marketing & Advertising", "Healthcare", "Manufacturing", "Creative & Design", "Education", "Other"),
  "yearsOfExperience": number
}
CRITICAL RULES:
1. headline MUST be the EXACT title as written on the resume. This is the #1 trust signal for users.
2. skills must be SPECIFIC and GRANULAR — never use broad categories like "Marketing" or "Design"
3. If multiple titles exist, use the MOST RECENT / PRIMARY one
No markdown, no explanation, only JSON.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract all professional data from this resume. The headline field MUST be the VERBATIM job title — do NOT upgrade, paraphrase, or inflate it:" },
              {
                type: "file",
                file: { filename: `resume.${mimeType === "application/pdf" ? "pdf" : "docx"}`, file_data: `data:${mimeType};base64,${base64}` },
              },
            ],
          },
        ],
        temperature: 0.05, // Near-zero for maximum extraction consistency
      }),
      signal: aiCtrl.signal,
    });
    clearTimeout(aiT);

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error(`[parse-resume] AI error [${aiResp.status}]:`, errText.slice(0, 300));
      return new Response(
        JSON.stringify({ error: "AI extraction failed", fallback: true }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResp.json();
    logTokenUsage("parse-resume", null, "google/gemini-3.1-pro-preview", aiData);
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No content from AI", fallback: true }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    // Match against knowledge graph
    const { data: jobs } = await supabase
      .from("job_taxonomy")
      .select("job_family, category, disruption_baseline");

    const { data: allSkills } = await supabase
      .from("skill_risk_matrix")
      .select("skill_name, automation_risk, replacement_tools");

    const matchedJob = fuzzyMatchJob(parsed.headline || "", jobs || []);
    const matchedSkills = matchSkills(parsed.skills || [], allSkills || []);

    return new Response(
      JSON.stringify({
        name: parsed.name || "Unknown",
        headline: parsed.headline || "Professional",
        company: parsed.company || "",
        location: parsed.location || "",
        skills: parsed.skills || [],
        experience: parsed.experience || [],
        education: parsed.education || [],
        matchedJobFamily: matchedJob?.job_family || null,
        matchedIndustry: matchedJob?.category || null,
        matchedSkills,
        suggestedIndustry: matchedJob?.category || parsed.inferredIndustry || "Other",
        yearsOfExperience: parsed.yearsOfExperience || null,
        rawExtractionQuality: "good",
        source: "gemini_vision",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[parse-resume] error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", fallback: true }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function fuzzyMatchJob(headline: string, jobs: any[]) {
  const lower = headline.toLowerCase();
  const keywordMap: Record<string, string[]> = {
    frontend_developer: ["frontend", "front-end", "react", "angular", "vue"],
    backend_developer: ["backend", "back-end", "node.js", "django", "spring"],
    full_stack_developer: ["full stack", "fullstack", "full-stack"],
    data_scientist: ["data scientist", "data science", "ml engineer"],
    data_analyst: ["data analyst", "business intelligence"],
    devops_engineer: ["devops", "sre", "site reliability"],
    product_manager: ["product manager", "product owner"],
    digital_marketer: ["digital marketing", "growth", "performance marketing"],
    content_writer: ["content writer", "copywriter"],
    ui_ux_designer: ["ui/ux", "ux designer", "ui designer", "product designer"],
    financial_analyst: ["financial analyst", "finance analyst"],
    accountant: ["accountant", "chartered accountant", "ca"],
    hr_generalist: ["hr", "human resources"],
    sales_executive: ["sales", "business development"],
    teacher: ["teacher", "lecturer", "professor"],
    doctor: ["doctor", "physician"],
    management_consultant: ["consultant", "consulting"],
  };

  for (const [family, keywords] of Object.entries(keywordMap)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return jobs.find((j: any) => j.job_family === family) || null;
      }
    }
  }
  return null;
}

function matchSkills(profileSkills: string[], dbSkills: any[]) {
  const matched: Array<{ profile_skill: string; db_skill: string; automation_risk: number }> = [];
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const ps of profileSkills) {
    const normPs = normalize(ps);
    for (const ds of dbSkills) {
      const normDs = normalize(ds.skill_name);
      if (normPs.includes(normDs) || normDs.includes(normPs)) {
        matched.push({ profile_skill: ps, db_skill: ds.skill_name, automation_risk: ds.automation_risk });
        break;
      }
    }
  }
  return matched;
}

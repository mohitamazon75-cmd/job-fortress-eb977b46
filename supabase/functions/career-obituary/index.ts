import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);

  const blocked = guardRequest(req, cors);
  if (blocked) return blocked;

  try {
    // --- Soft auth: identify user if logged in, allow anonymous ---
    const authHeader = req.headers.get("Authorization");
    let user = null;
    if (authHeader) {
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data } = await authClient.auth.getUser();
      user = data?.user ?? null;
    }
    // user is now either the authenticated User object or null (anonymous)
    // --- end soft auth ---

    const { role, industry, city, skills, achievements, experience } = await req.json();

    const roleLabel = role || "Professional";
    const industryLabel = industry || "Technology";
    const cityLabel = city || "Bengaluru";
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const profileContext = [
      `Role: ${roleLabel}`,
      `Industry: ${industryLabel}`,
      `City: ${cityLabel}`,
      experience ? `Experience: ${experience}` : "",
      skills?.length ? `Key Skills: ${(Array.isArray(skills) ? skills : [skills]).join(", ")}` : "",
      achievements ? `Notable Achievements: ${achievements}` : "",
    ].filter(Boolean).join("\n");

    const systemPrompt = `You are a legendary obituary writer for India's most prestigious broadsheet newspaper. You write OBITUARIES FOR JOB ROLES KILLED BY AI — never for people, always for the profession itself. Your writing is the love child of P.G. Wodehouse's wit and a Times of India editorial's gravitas.

VOICE: Melancholic yet devastatingly funny. Every sentence should make the reader wince, laugh, and then screenshot it for WhatsApp. Think: "a eulogy that trends on LinkedIn."

ABSOLUTE RULES:
1. NEVER use any person's real name. The subject is ALWAYS the role title in third person — "The ${roleLabel}", "The seasoned ${roleLabel}".
2. HYPER-PERSONALIZE using the exact skills provided. For EACH major skill, name the SPECIFIC 2025-2026 era AI tool that killed it. USE CURRENT TOOLS ONLY — e.g., "GPT-5", "Claude 4 Opus", "Gemini 2.5 Pro", "GitHub Copilot Workspace", "Cursor AI", "Devin (the AI software engineer)", "Midjourney v7", "Sora 2", "Runway Gen-4", "Perplexity Pro", "Google NotebookLM", "Lovable (the AI app builder)", "v0 by Vercel", "Bolt.new", "Gamma AI", "Beautiful.ai", "Fireflies.ai", "Otter.ai", "Harvey AI (legal)", "EvenUp (legal)", "Abridge (medical)", "Jasper AI", "Writer.com", "Adobe Firefly 3", "Figma AI (auto-layout)", "Canva Magic Studio", "Notion AI Q&A", "Linear AI", "Glean AI". NEVER reference outdated model names like "GPT-4", "Claude 3.5 Sonnet", "Midjourney v5" — these are legacy. Generic references like "AI tools" = failure.
3. INDIAN CORPORATE SOUL: Weave in at least 4 of these — bell-curve appraisals, 90-day notice periods, "we're like a family" CEOs, Bengaluru/Hyderabad/Pune traffic as personality trait, chai breaks as coping mechanism, LinkedIn humble-brags, appraisal season panic, "synergy" meetings, startup layoff WhatsApp groups, "my 2 cents" emails, Slack status as existential identity, Monday.com boards nobody checks, HR's "anonymous" surveys.
4. THE DEVASTATION FORMULA: 
   - Paragraph 1: The GLORY DAYS. Make the role sound genuinely noble and important. The reader should feel proud. Then end with a gut-punch foreshadowing.
   - Paragraph 2: THE MURDER. Skill by skill, tool by tool, describe how AI dismantled this role. Be surgically specific. Include at least one line like "was last seen [doing mundane task] that [AI tool] now completes in [absurdly small time/cost]."
   - Paragraph 3: THE FUNERAL. Dark comedy climax. End with a line so quotable people will put it in their LinkedIn bio ironically.
5. The "survived_by" field is CRUCIAL for virality — list 3-4 absurd, painfully relatable corporate artifacts this role leaves behind.
6. The "cause_of_death" should be a one-line medical-report style verdict that's darkly hilarious.
7. The headline MUST work as a standalone social media caption — punchy, dramatic, under 10 words.
8. The epitaph should be tombstone-worthy — the kind of line people screenshot and share.

Return ONLY valid JSON:
{
  "headline": "Under 10 words. Dramatic. Would stop someone mid-scroll on Twitter/LinkedIn.",
  "subheadline": "A sardonic subtitle. Max 15 words. The kind of line that makes you exhale sharply.",
  "dateline": "${cityLabel.toUpperCase()}, ${dateStr}",
  "body": "Three devastating paragraphs separated by \\n\\n. Each 4-6 sentences. Total 300-400 words. Use em-dashes, semicolons, and broadsheet prose. Make every line quotable.",
  "cause_of_death": "One line. Clinical/medical report style but absurd. e.g., 'Acute irrelevance complicated by chronic meeting attendance.'",
  "survived_by": "3-4 items separated by semicolons. Painfully specific corporate artifacts. e.g., 'a 47-slide deck titled Final_v7_FINAL_USE_THIS.pptx; 2,847 unread Slack notifications; a LinkedIn headline that still says \"Passionate about synergy\"'",
  "epitaph": "One devastating tombstone line. Max 12 words. The kind of line people put in their bio."
}`;

    const response = await fetch(AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write the obituary for this profession. Make it so personal they'll screenshot it within 5 seconds:\n\n${profileContext}` },
        ],
        temperature: 0.85,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      console.error("[career-obituary] AI API error:", status);
      if (status === 402 || status === 429) {
        return new Response(
          JSON.stringify({ error: status === 402 ? "AI credits exhausted" : "Rate limited", code: status === 402 ? "CREDITS_EXHAUSTED" : "RATE_LIMITED", status: "error" }),
          { status, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI API returned ${status}`);
    }

    const aiResult = await response.json();
    logTokenUsage("career-obituary", null, "google/gemini-3-flash-preview", aiResult);
    const raw = aiResult.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    return new Response(JSON.stringify({
      headline: parsed.headline || `${roleLabel}: A Career Cut Short`,
      subheadline: parsed.subheadline || "Survived by an outdated LinkedIn profile and 47 unread Jira tickets",
      dateline: parsed.dateline || `${cityLabel.toUpperCase()}, ${dateStr}`,
      body: parsed.body || `The ${roleLabel} lived a full and productive life in ${industryLabel}, until AI arrived.`,
      cause_of_death: parsed.cause_of_death || "Acute irrelevance complicated by chronic meeting attendance.",
      survived_by: parsed.survived_by || "a half-finished Coursera certificate; 47 unread Jira tickets; a motivational desk quote that read 'Hustle Hard'",
      epitaph: parsed.epitaph || "Here lies a role that could have learned Python.",
      generatedAt: new Date().toISOString(),
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[career-obituary] Error:", error);

    return new Response(JSON.stringify({
      headline: "Role Found Redundant; AI Sends Condolences via Slack Bot",
      subheadline: "Survived by an outdated LinkedIn profile and 47 unread Jira tickets",
      dateline: "BENGALURU, " + new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      body: "The Professional, once the pride of open-plan offices across India's silicon corridors, was pronounced redundant at approximately 2:47 PM IST, just moments after a quarterly all-hands where the CEO described the company as 'a family.' The cause of death was listed as 'automation,' though close colleagues suspect it was the bell-curve appraisal system that delivered the first wound.\n\nIn its prime, the role was known for its mastery of Excel pivot tables, its ability to sit through three-hour 'synergy alignment' meetings without visible suffering, and its uncanny talent for making PowerPoint decks that said absolutely nothing in 47 slides. These skills, once considered indispensable, were quietly replicated by a ChatGPT prompt costing ₹0.003 per query. The role's LinkedIn endorsements — 'Strategic Thinking,' 'Team Player,' 'Synergy' — proved as useful as a paper umbrella in Mumbai monsoon.\n\nThe role is survived by its three-month notice period, a half-finished Coursera certificate in 'AI for Everyone,' and a motivational quote pinned to its cubicle wall that read 'Adapt or Perish.' It chose neither. In lieu of flowers, the family requests that you update your own LinkedIn headline before it's too late.",
      cause_of_death: "Acute irrelevance complicated by chronic meeting attendance and terminal PowerPoint dependency.",
      survived_by: "a 90-day notice period nobody will serve; a half-finished Coursera certificate in 'AI for Everyone'; a motivational desk quote that read 'Adapt or Perish'",
      epitaph: "Ctrl+Z couldn't undo this one.",
      generatedAt: new Date().toISOString(),
      _fallback: true,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

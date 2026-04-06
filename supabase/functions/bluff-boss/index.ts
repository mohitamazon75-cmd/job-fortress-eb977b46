import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { tavilySearch } from "../_shared/tavily-search.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);

  const blocked = guardRequest(req, cors);
  if (blocked) return blocked;

  const { userId: _jwtUserId, blocked: jwtBlocked } = await validateJwtClaims(req, cors);
  if (jwtBlocked) return jwtBlocked;

  try {
    const { role, industry, seniority, company, responsibilities, region } = await req.json();

    const seniorityLabel = seniority || "mid-level";
    const roleLabel = role || "professional";
    const industryLabel = industry || "technology";
    const today = new Date().toISOString().split("T")[0];
    const currentMonth = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

    const toneGuide = seniorityLabel === "EXECUTIVE" || seniorityLabel === "SENIOR_LEADER"
      ? "strategic, board-room appropriate, P&L focused"
      : seniorityLabel === "ENTRY"
        ? "eager, learning-focused, shows initiative"
        : "confident, practical, results-oriented";

    // ═══ STEP 1: Tavily search for REAL recent AI news in their field ═══
    const [trendSearch, toolSearch] = await Promise.all([
      tavilySearch({
        query: `${roleLabel} ${industryLabel} AI automation latest news tools ${currentMonth}`,
        maxResults: 6,
        days: 14,
        includeAnswer: true,
      }),
      tavilySearch({
        query: `best new AI tools for ${roleLabel} ${industryLabel} 2026 launch`,
        maxResults: 5,
        days: 30,
        includeAnswer: true,
      }),
    ]);

    const trendContext = trendSearch
      ? trendSearch.results.map((r) => `${r.title}: ${r.content}`).join("\n\n")
      : "";
    const trendAnswer = trendSearch?.answer || "";
    const toolContext = toolSearch
      ? toolSearch.results.map((r) => `${r.title}: ${r.content}`).join("\n\n")
      : "";
    const toolAnswer = toolSearch?.answer || "";
    const hasSearchData = trendContext.length > 0 || toolContext.length > 0;

    // ═══ STEP 2: Generate with search-grounded context ═══
    const prompt = `You are a witty career strategist with access to REAL, CURRENT search data about AI developments as of ${today}. Generate content for a ${seniorityLabel} ${roleLabel} in ${industryLabel}${company ? ` at ${company}` : ""}${region ? ` (${region})` : ""}.

${responsibilities ? `Their key responsibilities: ${responsibilities}` : ""}

${hasSearchData ? `
══ REAL SEARCH RESULTS (USE THESE — do NOT hallucinate) ══

--- AI TRENDS IN THEIR FIELD (last 2 weeks) ---
${trendContext}
Summary: ${trendAnswer}

--- LATEST AI TOOLS FOR THEIR ROLE ---
${toolContext}
Summary: ${toolAnswer}
══════════════════════════════════════════════════
` : ""}

Return a JSON object with these exact fields:

1. "buzzwords" — an array of EXACTLY 3 objects, each with:
   - "aiBuzzword": A real, currently trending AI concept genuinely relevant to ${industryLabel} and ${roleLabel} RIGHT NOW. ${hasSearchData ? "MUST be grounded in the search results above." : "Use well-known current trends."}
   - "plainEnglishTranslation": Casual, jargon-free explanation (1-2 sentences, conversational)
   - "realStory": A REAL recent news story or development (from the search results) that makes this buzzword relevant. Format: "[Company/Event] recently [did what] — this is why it matters to you as a ${roleLabel}." This is the "proof" that makes the user sound informed, not just buzzwordy.
   - "latestToolName": The name of a SPECIFIC, REAL AI tool that relates to this buzzword and is relevant to ${roleLabel}. Must be an actual product (e.g. "Claude 3.5", "Midjourney v6", "Jasper AI", "Copy.ai", "Runway ML", "Notion AI"). ${hasSearchData ? "Pick from search results when possible." : "Use well-known tools only."}
   - "meetingScript": A ready-to-use sentence referencing the REAL story and the specific tool name. Must sound like someone who actually reads industry news, not generic AI-speak. Example: "Did you see [Company] just rolled out [tool]? We should pilot something similar for our [specific workflow]."
   - "confidenceScore": 1-100 how relevant to their specific role
   - "trendSource": Real attribution — the actual source from search results, or a known conference/publication. Never say "Trending in AI community" — be specific.

2. "mustKnowTerms" — an array of EXACTLY 5 objects, each with:
   - "term": An AI/tech term specifically relevant to ${roleLabel} in ${industryLabel} RIGHT NOW (not generic)
   - "meaning": Plain English explanation in 1 sentence, tailored to how it impacts their specific role
   - "whyItMatters": One sentence on why this person specifically should care about it NOW
   - "realWorldExample": A SPECIFIC company or product using this. Format: "[Company] uses this to [do what]" — makes the term feel real and urgent, not academic. ${hasSearchData ? "Ground in search results." : "Use well-known examples."}
   - "toolToTry": Name of ONE specific tool/platform they can try THIS WEEK related to this term (must be real, accessible)

CRITICAL:
- ${hasSearchData ? "Ground EVERYTHING in the search results. The 'realStory' and 'realWorldExample' fields MUST reference actual events/companies from the search data." : "Use only well-known, verifiable facts. Do NOT invent news stories."}
- All buzzwords and terms must be genuinely trending as of ${today}
- Each must be DIFFERENT — no overlaps between buzzwords and mustKnowTerms
- Everything must be specific to ${roleLabel} in ${industryLabel}, not generic
- Tone: ${toneGuide}
- Meeting scripts must reference the real story + tool — this is what makes it "bluff-proof"

Return ONLY valid JSON, no markdown.`;

    const aiCtrl = new AbortController();
    const aiT = setTimeout(() => aiCtrl.abort(), 30_000);
    const response = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
      signal: aiCtrl.signal,
    });
    clearTimeout(aiT);

    if (!response.ok) {
      const status = response.status;
      console.error("[bluff-boss] AI API error:", status);
      if (status === 402 || status === 429) {
        return new Response(
          JSON.stringify({ error: status === 402 ? "AI credits exhausted" : "Rate limited", rate_limited: true }),
          { status, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI API returned ${status}`);
    }

    const aiResult = await response.json();
    logTokenUsage("bluff-boss", null, "google/gemini-3-flash-preview", aiResult);
    const raw = aiResult.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try extracting the outermost JSON object
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          // Try truncating at last valid brace
          const lastBrace = raw.lastIndexOf("}");
          if (lastBrace > 0) {
            parsed = JSON.parse(raw.slice(0, lastBrace + 1));
          } else {
            throw new Error("Failed to parse AI response");
          }
        }
      } else {
        throw new Error("Failed to parse AI response — no JSON found");
      }
    }

    const buzzwords = (parsed.buzzwords || []).slice(0, 3).map((b: any) => ({
      aiBuzzword: b.aiBuzzword || "Agentic Workflows",
      plainEnglishTranslation: b.plainEnglishTranslation || "AI agents that coordinate tasks autonomously.",
      realStory: b.realStory || "",
      latestToolName: b.latestToolName || "",
      meetingScript: b.meetingScript || `We should evaluate how ${b.aiBuzzword || "this"} can improve our pipeline.`,
      confidenceScore: Math.min(100, Math.max(1, b.confidenceScore || 75)),
      trendSource: b.trendSource || "Industry reports",
    }));

    while (buzzwords.length < 3) {
      buzzwords.push({
        aiBuzzword: ["Agentic Workflows", "Mixture of Experts", "RAG Pipelines"][buzzwords.length],
        plainEnglishTranslation: "An advanced AI architecture gaining traction across industries.",
        realStory: "",
        latestToolName: "",
        meetingScript: `We should explore how this can streamline our ${industryLabel} workflows.`,
        confidenceScore: 70,
        trendSource: "Industry reports",
      });
    }

    const mustKnowTerms = (parsed.mustKnowTerms || []).slice(0, 5).map((t: any) => ({
      term: t.term || "AI Term",
      meaning: t.meaning || "An important AI concept for your field.",
      whyItMatters: t.whyItMatters || "Directly impacts how your role evolves.",
      realWorldExample: t.realWorldExample || "",
      toolToTry: t.toolToTry || "",
    }));

    while (mustKnowTerms.length < 5) {
      mustKnowTerms.push({
        term: ["Retrieval-Augmented Generation", "AI Guardrails", "Synthetic Data", "Model Distillation", "Prompt Engineering"][mustKnowTerms.length],
        meaning: "A key AI concept reshaping how work gets done in your industry.",
        whyItMatters: "Understanding this gives you an edge in conversations with leadership.",
        realWorldExample: "",
        toolToTry: "",
      });
    }

    const result = {
      buzzwords,
      mustKnowTerms,
      generatedAt: new Date().toISOString(),
      search_grounded: hasSearchData,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[bluff-boss] Error:", error);

    return new Response(
      JSON.stringify({
        buzzwords: [
          { aiBuzzword: "Agentic Workflows", plainEnglishTranslation: "AI agents coordinating tasks without manual steps.", realStory: "", latestToolName: "CrewAI", meetingScript: `We should evaluate agentic workflows to remove human bottlenecks in our pipeline this quarter.`, confidenceScore: 72, trendSource: "Major AI conferences 2026" },
          { aiBuzzword: "Mixture of Experts", plainEnglishTranslation: "Multiple specialized AI models working together, each handling what it's best at.", realStory: "", latestToolName: "GPT-5", meetingScript: "The MoE architecture could reduce our inference costs by 40% while maintaining quality.", confidenceScore: 68, trendSource: "Google DeepMind research" },
          { aiBuzzword: "RAG Pipelines", plainEnglishTranslation: "AI that pulls from your actual company data before answering, so it doesn't hallucinate.", realStory: "", latestToolName: "LangChain", meetingScript: "We should pilot a RAG pipeline on our internal docs to cut support ticket resolution time.", confidenceScore: 75, trendSource: "Enterprise AI adoption reports" },
        ],
        mustKnowTerms: [
          { term: "Retrieval-Augmented Generation", meaning: "AI fetches relevant docs before answering — like giving it an open-book exam.", whyItMatters: "Every enterprise tool is adding this. Know it or look outdated.", realWorldExample: "Microsoft Copilot uses this to search your company's SharePoint before answering.", toolToTry: "Perplexity AI" },
          { term: "AI Guardrails", meaning: "Rules that prevent AI from going off-script or producing harmful outputs.", whyItMatters: "Leadership is asking about AI safety — this is your vocabulary.", realWorldExample: "OpenAI built guardrails into ChatGPT Enterprise for compliance.", toolToTry: "Guardrails AI" },
          { term: "Synthetic Data", meaning: "Fake but realistic data generated by AI to train models without privacy issues.", whyItMatters: "Solves the 'we don't have enough data' problem your team keeps hitting.", realWorldExample: "JPMorgan uses synthetic data to train fraud detection models.", toolToTry: "Gretel.ai" },
          { term: "Model Distillation", meaning: "Making a smaller, faster AI by training it to mimic a bigger one.", whyItMatters: "This is how AI gets cheap enough for your team to actually use daily.", realWorldExample: "Google distilled Gemini into smaller models for on-device use.", toolToTry: "Ollama" },
          { term: "Prompt Engineering", meaning: "The art of writing instructions that make AI give you exactly what you want.", whyItMatters: "The single highest-ROI skill you can learn this month.", realWorldExample: "Anthropic published prompt engineering best practices used by Fortune 500s.", toolToTry: "Claude.ai" },
        ],
        generatedAt: new Date().toISOString(),
        _fallback: true,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});

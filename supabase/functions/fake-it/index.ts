import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
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
    const { role, industry, seniority, skills, experience, company, region } = await req.json();

    const seniorityLabel = seniority || "mid-level";
    const roleLabel = role || "professional";
    const industryLabel = industry || "technology";
    const today = new Date().toISOString().split("T")[0];

    const prompt = `You are a brutally honest career upgrade strategist. Today is ${today}. Analyze this profile and generate a "Fake It Till You Make It" upgrade plan.

PROFILE:
- Role: ${roleLabel}
- Industry: ${industryLabel}
- Seniority: ${seniorityLabel}
${company ? `- Company: ${company}` : ""}
${skills ? `- Current Skills: ${skills}` : ""}
${experience ? `- Experience: ${experience}` : ""}
${region ? `- Region: ${region}` : ""}

Your task: Look at their CURRENT experience and skills, and show them EXACTLY how to reposition/upgrade their profile to sound AI-native and future-proof. Be specific, accurate, and actionable.

Return a JSON object with these exact fields:

- "currentTitle": Their current role as stated (e.g. "Marketing Manager")
- "upgradedTitle": A realistic upgraded title that sounds AI-native (e.g. "AI-Augmented Growth Marketing Lead"). Must be realistic enough to actually use on LinkedIn.
- "beforeAfter": An array of EXACTLY 3 objects showing skill repositioning:
  - "currentSkill": What they currently do (from their actual skills/role)
  - "upgradedVersion": How to describe it in AI-augmented language
  - "howToBackItUp": A specific, actionable step to make it real (not fake) — e.g. "Build one automated report using ChatGPT this week and screenshot the output"
- "linkedinHeadlineNow": What their LinkedIn headline probably says now
- "linkedinHeadlineUpgrade": A killer upgraded headline that positions them as AI-native
- "weekendProject": A specific weekend project (< 4 hours) they can do RIGHT NOW to legitimize the upgrade. Must be very specific to their role.
- "weekendProjectTools": The exact tools needed (real tool names)
- "credibilityScore": 1-100 — how credible the upgrade looks if they execute the weekend project
- "elevatorPitch": A 2-sentence pitch they can use when someone asks "what do you do?" that makes them sound cutting-edge. Must be specific to their role and industry.

CRITICAL:
- The upgrade must be REALISTIC — something they could put on LinkedIn without getting called out
- The "howToBackItUp" steps must be doable THIS WEEK
- Be specific to ${roleLabel} in ${industryLabel} — not generic advice
- The weekend project must produce a tangible artifact they can reference
- Tone: confident, slightly cheeky, but professional
- This is about REPOSITIONING existing experience, not lying

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
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
      signal: aiCtrl.signal,
    });
    clearTimeout(aiT);

    if (!response.ok) {
      const errText = await response.text();
      console.error("[fake-it] AI API error:", errText);
      throw new Error(`AI API returned ${response.status}`);
    }

    const aiResult = await response.json();
    logTokenUsage("fake-it", null, "google/gemini-3-flash-preview", aiResult);
    const raw = aiResult.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const lastBrace = raw.lastIndexOf("}");
      if (lastBrace > 0) {
        parsed = JSON.parse(raw.slice(0, lastBrace + 1));
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    // ── Post-generation skill validation ──
    if (skills && parsed.beforeAfter) {
      const inputSkillsLower = skills.toLowerCase().split(',').map((s: string) => s.trim()).filter(Boolean);
      parsed.beforeAfter = parsed.beforeAfter.map((ba: any) => {
        const currentLower = (ba.currentSkill || '').toLowerCase();
        const isRelevant = inputSkillsLower.some(
          (s: string) => currentLower.includes(s) || s.includes(currentLower)
        );
        ba._validated = isRelevant || inputSkillsLower.length === 0;
        return ba;
      });
      const validCount = parsed.beforeAfter.filter((b: any) => b._validated).length;
      if (validCount === 0) {
        console.warn('[fake-it] All beforeAfter skills mismatched input -- possible hallucination');
      }
    }

    const result = {
      currentTitle: parsed.currentTitle || roleLabel,
      upgradedTitle: parsed.upgradedTitle || `AI-Augmented ${roleLabel}`,
      beforeAfter: (parsed.beforeAfter || []).slice(0, 3).map((ba: any) => ({
        currentSkill: ba.currentSkill || "Current skill",
        upgradedVersion: ba.upgradedVersion || "AI-enhanced version",
        howToBackItUp: ba.howToBackItUp || "Complete a small AI project this week",
        _validated: ba._validated ?? true,
      })),
      linkedinHeadlineNow: parsed.linkedinHeadlineNow || `${roleLabel} at ${company || "Company"}`,
      linkedinHeadlineUpgrade: parsed.linkedinHeadlineUpgrade || `${roleLabel} | AI-Native ${industryLabel} Professional`,
      weekendProject: parsed.weekendProject || "Build an AI-powered workflow relevant to your role",
      weekendProjectTools: parsed.weekendProjectTools || "ChatGPT, Google Sheets",
      credibilityScore: Math.min(100, Math.max(1, parsed.credibilityScore || 78)),
      elevatorPitch: parsed.elevatorPitch || `I help ${industryLabel} teams integrate AI into their workflows to 10x output quality.`,
      generatedAt: new Date().toISOString(),
    };

    // Ensure beforeAfter has 3 items
    while (result.beforeAfter.length < 3) {
      result.beforeAfter.push({
        currentSkill: "Manual process management",
        upgradedVersion: "AI-orchestrated workflow design",
        howToBackItUp: "Automate one repetitive task with an AI tool this week",
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[fake-it] Error:", error);

    return new Response(
      JSON.stringify({
        currentTitle: "Professional",
        upgradedTitle: "AI-Augmented Professional",
        beforeAfter: [
          { currentSkill: "Data analysis in Excel", upgradedVersion: "AI-assisted predictive analytics", howToBackItUp: "Run your next analysis through ChatGPT Advanced Data Analysis and compare results" },
          { currentSkill: "Report writing", upgradedVersion: "AI-augmented insight generation", howToBackItUp: "Use Claude to draft your next report, then edit for accuracy" },
          { currentSkill: "Team coordination", upgradedVersion: "Human-AI workflow orchestration", howToBackItUp: "Set up one AI automation in your team's Slack/Teams this week" },
        ],
        linkedinHeadlineNow: "Professional",
        linkedinHeadlineUpgrade: "AI-Native Professional | Building Human-AI Workflows",
        weekendProject: "Build an automated weekly report using ChatGPT + Google Sheets",
        weekendProjectTools: "ChatGPT, Google Sheets, Zapier",
        credibilityScore: 75,
        elevatorPitch: "I specialize in integrating AI into existing workflows to eliminate bottlenecks. Currently building human-AI systems that cut manual work by 60%.",
        generatedAt: new Date().toISOString(),
        _fallback: true,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});

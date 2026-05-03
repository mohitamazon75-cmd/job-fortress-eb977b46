// ═══════════════════════════════════════════════════════════════
// Job vs Business — Personalized Autopsy (Pro-gated)
// ═══════════════════════════════════════════════════════════════
// Receives: scanId + quiz answers + verdict band.
// Produces: 5-section autopsy grounded in the user's resume + scan context.
// Zero hallucinated numbers — only echoes data we already verified.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const cors = getCorsHeaders(req);
  const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
    const SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(SUPA_URL, SVC_KEY);
    const userClient = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: authHeader } } });

    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub;

    const body = await req.json();
    const { scanId, answers, verdict } = body || {};
    if (!scanId || !answers || !verdict?.band) {
      return json({ error: "scanId, answers, verdict required" }, 400);
    }

    // ── Load scan + profile context (deterministic grounding) ──
    const { data: scan } = await sb
      .from("scans")
      .select("user_id, role_detected, industry, estimated_monthly_salary_inr, years_experience, metro_tier, final_json_report")
      .eq("id", scanId)
      .maybeSingle();

    if (!scan || scan.user_id !== userId) return json({ error: "Scan not found" }, 404);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 503);

    // Compact, grounded context — no fabrication possible.
    // CTC: convert estimated monthly INR → annual lakhs only when present.
    const monthly = Number(scan.estimated_monthly_salary_inr ?? 0);
    const ctcLakhs = monthly > 0 ? Math.round((monthly * 12) / 100000) : null;
    const ctx = {
      role: scan.role_detected || "your role",
      industry: scan.industry || "your industry",
      city: scan.metro_tier || "India",
      years: scan.years_experience,
      ctc_lakhs: ctcLakhs,
      score: (scan.final_json_report as any)?.score ?? null,
    };

    const bandHumanCopy: Record<string, string> = {
      BUILD: "GO — quit-and-build is genuinely on the table",
      SIDE_HUSTLE: "WAIT — side-hustle on weekends, don't quit yet",
      PREP_12_MONTHS: "WAIT — 12 months of foundation-building before betting",
      JOB_IS_MOAT: "NO — building today would burn savings before you find fit",
    };

    const systemPrompt = `You are a brutally honest startup advisor for Indian professionals. You have helped 1000+ aspiring founders. You speak in short sentences, no jargon, no MBA-speak. You ground every claim in the user's actual situation. You never invent numbers. You never use the words "fortified", "guaranteed", "definitely", "you'll succeed". You DO use words like "likely", "your odds", "what usually kills people like you".

Your tone is a senior founder talking to a younger one over chai — caring but honest enough to hurt.

Return ONLY a JSON object with this exact shape:
{
  "verdict_paragraph": "2-3 sentences. Starts with the band verdict. Personalised to their role + city + ctc.",
  "what_kills_you": ["3 specific failure modes for someone in their exact situation"],
  "what_saves_you": ["3 concrete moves they could make in the next 90 days"],
  "your_unfair_edge": "1-2 sentences naming the edge they actually have, given their resume signals",
  "the_30_60_90": {
    "next_30_days": "1 sentence — what to do this month",
    "next_60_days": "1 sentence — what to validate by month 2",
    "next_90_days": "1 sentence — kill-criteria: what tells you to STOP"
  },
  "if_you_ignore_this": "1 brutal sentence — what their life looks like in 18 months if they ignore the verdict and quit anyway"
}

No markdown, no preamble, only JSON.`;

    const userPrompt = `User context (verified, do NOT invent more):
- Role: ${ctx.role}
- Industry: ${ctx.industry}
- City: ${ctx.city || "India"}
- Experience: ${ctx.years ?? "unknown"} years
- Current CTC: ${ctx.ctc_lakhs ? `₹${ctx.ctc_lakhs} LPA` : "not disclosed"}
- AI-risk score: ${ctx.score ?? "unknown"}/100

Their quiz answers (0=worst, 3=best on each):
- Runway saved: ${answers.runway}/3
- Dependents: ${answers.dependents}/3
- Unfair advantage: ${answers.advantage}/3
- Demand pull (paying customers): ${answers.demand}/3
- Commitment + dip tolerance: ${answers.commitment}/3

Total readiness score: ${verdict.score}/15
Deterministic verdict: ${verdict.band} → ${bandHumanCopy[verdict.band]}

Write the autopsy. Be specific to ${ctx.role} in ${ctx.industry}. Reference their CTC only if disclosed. If runway is low, say so. If demand is zero, say so. Don't soften.`;

    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
      }),
    });

    if (!ai.ok) {
      if (ai.status === 429) return json({ error: "Rate limited, try again in a minute" }, 429);
      if (ai.status === 402) return json({ error: "Service capacity reached" }, 402);
      return json({ error: "AI generation failed" }, 500);
    }

    const aiData = await ai.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) return json({ error: "Empty AI response" }, 500);

    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let autopsy;
    try {
      autopsy = JSON.parse(cleaned);
    } catch {
      return json({ error: "AI returned invalid JSON" }, 500);
    }

    // Persist (best-effort — don't fail the response if insert fails)
    try {
      await sb.from("business_autopsy_results").insert({
        scan_id: scanId,
        user_id: userId,
        answers,
        score: verdict.score,
        band: verdict.band,
        autopsy,
      });
    } catch (e) {
      console.warn("[job-vs-business-autopsy] persist failed (non-fatal):", e);
    }

    return json({ autopsy, verdict });
  } catch (e) {
    console.error("[job-vs-business-autopsy] error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});

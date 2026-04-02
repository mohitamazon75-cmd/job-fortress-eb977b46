import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Static fallback plans for when AI is unavailable ──────────────────

function getFallbackPlan(jobTitle: string) {
  return {
    headline: "From executor to strategist — starting now",
    phases: [
      {
        phase_number: 1,
        name: "Weaponise the tools",
        days: "days 1-30",
        goal: "Deploy AI on every automatable task in your role before anyone else does",
        tasks: [
          { week: "week 1", tag: "ai", title: "Audit every deliverable you produce", detail: "List every output you created last week. Next to each, write 'AI can draft this in <5 min: yes/no'. This becomes your automation backlog.", boss_visibility: "Send your manager one unsolicited, AI-researched insight by Thursday." },
          { week: "week 1", tag: "ai", title: "Set up your ₹1,800/month AI stack", detail: "ChatGPT Plus or Claude Pro for strategy and drafting. Perplexity free tier for research. Canva AI for visuals. Document your setup.", boss_visibility: "Share the doc in your next team standup." },
          { week: "week 2", tag: "ai", title: "Cut your weekly reporting time by 70%", detail: "Build an AI prompt that converts raw weekly data into a polished manager report in under 10 minutes.", boss_visibility: "Use the new format this Friday." },
          { week: "week 3", tag: "strategic", title: "Send the brief nobody asked for", detail: "Produce a 400-word competitive intelligence brief. Email it to your manager.", boss_visibility: "The unsolicited brief IS the move." },
          { week: "week 4", tag: "ai", title: "Build one system that runs itself", detail: "Identify one recurring task and build a half-automated workflow. Cut time from 4 hours to 30 minutes.", boss_visibility: "Tell your manager: 'I've built a faster way to handle this'." },
          { week: "week 4", tag: "human", title: "Book the manager meeting with your numbers", detail: "Book 20 minutes. Walk in with time saved, things shipped, and one initiative you want to own.", boss_visibility: "Walk in with outcomes, not effort." },
        ],
      },
      {
        phase_number: 2,
        name: "Own a number",
        days: "days 31-60",
        goal: "Tie your name to a business metric only you can move",
        tasks: [
          { week: "week 5", tag: "strategic", title: "Pick one revenue-adjacent metric to own", detail: "Not 'engagement'. Pick: leads generated, cost reduced, deals supported, errors caught.", boss_visibility: "Email your manager with your metric goal." },
          { week: "week 5", tag: "ai", title: "Build a live dashboard your skip-level would read", detail: "Use Looker Studio or a Notion table. One page, four numbers, automatic weekly refresh.", boss_visibility: "CC your skip-level on the first automated report." },
          { week: "week 6", tag: "strategic", title: "Align your metric to a business outcome in writing", detail: "Get verbal agreement, then follow up by email with the commitment.", boss_visibility: "Forward the email confirmation to your appraisal folder." },
          { week: "week 7", tag: "ai", title: "Run one project where AI drafted, you directed", detail: "Use AI for first draft, make judgment calls yourself, document your decisions.", boss_visibility: "Add a 'Strategic rationale' section. Sign your decisions." },
          { week: "week 7", tag: "human", title: "Write a monthly intelligence memo", detail: "A 400-word brief: one competitor move, one market trend, one implication for your team.", boss_visibility: "Send to manager AND one cross-functional stakeholder." },
          { week: "week 8", tag: "human", title: "Have the 'what do you need from me' conversation", detail: "Find the person whose work intersects most. Ask what you could do to help. Then do it in 48 hours.", boss_visibility: "Loop your manager in on the collaboration." },
        ],
      },
      {
        phase_number: 3,
        name: "Become the strategist",
        days: "days 61-90",
        goal: "Make every decision you take visible — and own the room",
        tasks: [
          { week: "week 9", tag: "strategic", title: "Propose one initiative nobody assigned you", detail: "Write a 1-page proposal for an experiment. Low cost, high signal.", boss_visibility: "Submit as a written proposal. Not verbal. Written." },
          { week: "week 9", tag: "human", title: "Run a competitive war-room with your team", detail: "Walk your team through market trends and what to do about them. You become the strategist.", boss_visibility: "Send session notes to your manager." },
          { week: "week 10", tag: "human", title: "Build one cross-functional proof of impact", detail: "Deliver on the cross-functional collaboration. Document the outcome with ₹ or % impact.", boss_visibility: "Write up the outcome as a one-pager." },
          { week: "week 11", tag: "human", title: "Get one piece of public professional proof", detail: "Write one specific LinkedIn post about something you shipped or learned.", boss_visibility: "Your manager will see it. Let them find it." },
          { week: "week 11", tag: "strategic", title: "Document a process and propose training a junior", detail: "Write a 1-page SOP for your most efficient workflow. Signal you're thinking above your designation.", boss_visibility: "The proposal to train a junior IS the signal." },
          { week: "week 12", tag: "strategic", title: "Walk into your review with data, not hope", detail: "Book your review before HR schedules it. Walk in with numbers, initiatives, and a business case for your role.", boss_visibility: "Booking it before they do is itself a signal." },
        ],
      },
    ],
  };
}

function getFallbackPrompts(jobTitle: string) {
  return [
    { name: "Weekly report engine", use_case: "Every Friday before manager update", category: "reporting", time_saved: "saves 2 hrs/week", prompt: `Write a weekly performance report for my manager.\n\nMetric | This week | Last week | Target:\n[Paste your numbers here]\n\nKey activities completed:\n[bullet list]\n\nFormat: Executive summary (2 sentences), Metrics table, Top win, One risk, Next week focus (3 bullets). Max 300 words. My role is: ${jobTitle}.` },
    { name: "Competitor intelligence brief", use_case: "Monthly market monitoring", category: "research", time_saved: "saves 4 hrs/month", prompt: `Act as a senior market analyst. Research competitors: [Competitor 1], [Competitor 2], [Competitor 3].\n\nFor each: current positioning, top 3 themes, pricing changes, one thing they do that we don't. 400-word executive brief. My role: ${jobTitle}.` },
    { name: "Email sequence writer", use_case: "Any outreach or campaign", category: "writing", time_saved: "saves 3 hrs/sequence", prompt: `Write a 3-email sequence for [purpose].\n\nAudience: [role, company size]\nGoal: [desired action]\nKey message: [value]\n\nEmail 1 (Day 0): Useful insight. Email 2 (Day 4): Address objection. Email 3 (Day 9): Clear CTA. Max 200 words each. My role: ${jobTitle}.` },
    { name: "Meeting prep brief", use_case: "Before important meetings", category: "strategy", time_saved: "saves 1 hr/meeting", prompt: `Meeting with [person/team] on [topic].\n\nContext: [situation]\nMy goal: [outcome]\nTheir concerns: [what they care about]\n\nGive me: 3 smart questions, one framing for my main point, two objections + responses, opening sentence. Indian corporate context. My role: ${jobTitle}.` },
    { name: "Data summary to insight", use_case: "When you have numbers to explain", category: "analysis", time_saved: "saves 1.5 hrs/report", prompt: `Data: [paste numbers]\nContext: [what it measures]\nAudience: [who reads it]\nDecision: [what they're deciding]\n\nGive me: single most important insight, the one number that matters, what to do next, one caveat. Max 150 words. My role: ${jobTitle}.` },
    { name: "Professional LinkedIn post", use_case: "Weekly professional presence", category: "writing", time_saved: "saves 1 hr/week", prompt: `Insight to share: [your insight]\nRole: ${jobTitle}\nAudience: [who]\n\nCreate 3 variations: Data-led (open with a number), Story format (4-line narrative), Contrarian (challenge one assumption). Max 150 words each. Max 2 hashtags. No filler.` },
  ];
}

// ─── Call Lovable AI Gateway ──────────────────────────────────────────────

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-pro-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`AI gateway error: ${response.status}`, text);
    if (response.status === 429) throw new Error("rate_limited");
    if (response.status === 402) throw new Error("credits_exhausted");
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// ─── Main handler ──────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { mode, job_title, monthly_ctc, risk_score, ai_skills, human_skills, experience_band, result_id } = body;

    if (!mode || !job_title) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: mode, job_title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let aiResponse: unknown;

    // ── MODE: survival_plan ──────────────────────────────────────────────────
    if (mode === "survival_plan") {
      let usedFallback = false;

      try {
        const systemPrompt = `You are a brutally honest Indian career strategist. You know the Indian corporate landscape deeply — appraisal cycles, startup culture in Bengaluru/Delhi/Mumbai, MNC politics, Tier 2 city job markets, 6-month performance reviews, hike cycles in April/October. You give hyper-specific, actionable advice grounded in Indian realities. You never give generic advice like "upskill yourself" or "network more". You name actual tools with their INR pricing. You reference Indian-specific outcomes (appraisal ratings, CTC hike percentages, PIP risk). Be direct. Be uncomfortable if needed.`;

        const userPrompt = `Role: ${job_title}
Monthly CTC: ₹${new Intl.NumberFormat('en-IN').format(monthly_ctc || 0)}
Replacement risk score: ${risk_score}%
AI-replaceable tasks they currently do: ${(ai_skills || []).join(", ") || "none specified"}
Human-strength tasks: ${(human_skills || []).join(", ") || "none identified — this is a red flag"}
Years of experience: ${experience_band || "3-5 yrs"}

Generate a 3-phase 90-day survival plan specific to this person's role and situation.
Indian corporate context throughout. Name specific tools with ₹ pricing where relevant.
Reference Indian corporate milestones: appraisal cycles, skip-levels, quarterly reviews.

Return ONLY valid JSON — no markdown fences, no preamble, no explanation:
{
  "headline": "5-word punchy headline summarising the plan",
  "phases": [
    {
      "phase_number": 1,
      "name": "phase name (3-4 words)",
      "days": "days 1-30",
      "goal": "one sentence — what changes by end of this phase",
      "tasks": [
        {
          "week": "week 1",
          "tag": "ai",
          "title": "task title — max 8 words",
          "detail": "2-3 sentences. Name specific tools with ₹ pricing. Name specific outcomes. Indian context.",
          "boss_visibility": "exactly how to make this visible to your manager — 1 specific sentence"
        }
      ]
    }
  ]
}

Exactly 3 phases, 6 tasks per phase = 18 tasks total.
Tag distribution:
- Phase 1: 4 ai, 1 human, 1 strategic
- Phase 2: 2 ai, 2 human, 2 strategic
- Phase 3: 1 ai, 3 human, 2 strategic`;

        const rawText = await callAI(systemPrompt, userPrompt);
        aiResponse = JSON.parse(rawText.replace(/```json|```/g, "").trim());
      } catch (err) {
        console.error("AI error for survival_plan, using fallback:", err);
        aiResponse = getFallbackPlan(job_title);
        usedFallback = true;
      }

      if (result_id) {
        await supabase
          .from("diagnostic_results")
          .update({ survival_plan: aiResponse })
          .eq("id", result_id);
      }

      return new Response(
        JSON.stringify({ data: aiResponse, fallback: usedFallback }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── MODE: role_prompts ───────────────────────────────────────────────────
    else if (mode === "role_prompts") {
      let usedFallback = false;

      try {
        const systemPrompt = `You create powerful, role-specific AI prompts for Indian professionals. Your prompts are hyper-specific — never generic. They include [PLACEHOLDER] brackets for variables. They reference Indian business context naturally: ₹ amounts, Indian regulatory context, Indian company structures. Every prompt must be immediately usable — copy-paste and go.`;

        const userPrompt = `Job title: ${job_title}
AI-exposed tasks: ${(ai_skills || []).join(", ") || "general office tasks"}
Experience: ${experience_band || "3-5 yrs"}

Create 6 AI prompts this specific professional can use TODAY to cut their weekly work time by 60% and produce output their manager will visibly notice.

Return ONLY valid JSON array — no markdown, no preamble:
[
  {
    "name": "prompt name (max 5 words)",
    "use_case": "when exactly to use this (max 10 words)",
    "category": "research|writing|analysis|strategy|reporting|communication",
    "time_saved": "saves X hrs/week",
    "prompt": "Full ready-to-use prompt. Min 80 words. Include [PLACEHOLDERS]. Reference Indian context. Powerful, specific."
  }
]

Exactly 6 prompts. Cover different categories. Make each specific to their role.`;

        const rawText = await callAI(systemPrompt, userPrompt);
        aiResponse = JSON.parse(rawText.replace(/```json|```/g, "").trim());
      } catch (err) {
        console.error("AI error for role_prompts, using fallback:", err);
        aiResponse = getFallbackPrompts(job_title);
        usedFallback = true;
      }

      if (result_id) {
        await supabase
          .from("diagnostic_results")
          .update({ role_prompts: aiResponse })
          .eq("id", result_id);
      }

      return new Response(
        JSON.stringify({ data: aiResponse, fallback: usedFallback }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid mode. Use: survival_plan | role_prompts" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("run-diagnostic error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

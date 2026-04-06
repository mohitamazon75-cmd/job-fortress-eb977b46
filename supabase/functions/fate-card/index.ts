import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    // --- JWT validation ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header", code: "UNAUTHORIZED", status: "error" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token", code: "UNAUTHORIZED", status: "error" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // --- end JWT validation ---

    const { assessmentId, platform } = await req.json();

    if (!assessmentId) {
      return new Response(
        JSON.stringify({ error: "assessmentId required", code: "INVALID_INPUT", status: "error" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the assessment
    const { data: assessment } = await supabase
      .from("assessments")
      .select("*")
      .eq("id", assessmentId)
      .single();

    if (!assessment) {
      return new Response(
        JSON.stringify({ error: "Assessment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const verdict = assessment.agent_4_verdict as any;
    const isThreatened = assessment.status === "THREATENED";

    // Build fate card data (for client-side rendering via canvas)
    const cardData = {
      fateScore: assessment.fate_score,
      status: assessment.status,
      industry: assessment.industry,
      timeline: verdict?.timelineMonths || "N/A",
      primaryThreats: (verdict?.primaryThreats || []).slice(0, 3),
      salvageableSkills: (verdict?.salvageableSkills || []).slice(0, 3),
      marketHealth: verdict?.marketHealth || "STABLE",
      skillsAssessed: verdict?.skillsAssessed || 0,
      highRiskCount: (verdict?.highRiskSkills || []).length,
      lowRiskCount: (verdict?.lowRiskSkills || []).length,
      aiTools: (verdict?.aiToolsThreatening || []).slice(0, 4),
      colors: {
        primary: isThreatened ? "#e94560" : "#f9a825",
        background: isThreatened
          ? "linear-gradient(135deg, #1a0a0e 0%, #2d0a14 50%, #1a0a0e 100%)"
          : "linear-gradient(135deg, #0a1a0e 0%, #142d0a 50%, #0a1a0e 100%)",
        accent: isThreatened ? "#ff6b6b" : "#ffd700",
      },
      shareText: isThreatened
        ? `🚨 My AI Fate Score: ${assessment.fate_score}/100 — THREATENED. ${(verdict?.primaryThreats || [])[0] || "AI"} is coming for my job. What's YOUR score?`
        : `✅ My AI Fate Score: ${assessment.fate_score}/100 — AUGMENTED. AI will 10x my career. What's YOUR score?`,
      hashtags: ["#AIProphet", "#CareerFate", "#FutureOfWork", "#AIIndia"],
      url: "https://ai-prophet.in",
    };

    // Create or update fate card record
    const { data: existingCard } = await supabase
      .from("fate_cards")
      .select("id")
      .eq("assessment_id", assessmentId)
      .single();

    let cardId: string;
    if (existingCard) {
      cardId = existingCard.id;
    } else {
      const { data: newCard } = await supabase
        .from("fate_cards")
        .insert({
          assessment_id: assessmentId,
          card_data: cardData,
        })
        .select("id")
        .single();
      cardId = newCard?.id || "";
    }

    // Track share event if platform specified
    if (platform) {
      await supabase.from("share_events").insert({
        fate_card_id: cardId,
        assessment_id: assessmentId,
        platform,
        user_agent: req.headers.get("user-agent") || "",
      });

      // Increment share count manually
      const { data: currentCard } = await supabase
        .from("fate_cards")
        .select("share_count")
        .eq("id", cardId)
        .single();
      
      await supabase
        .from("fate_cards")
        .update({ share_count: (currentCard?.share_count || 0) + 1 })
        .eq("id", cardId);
    }

    return new Response(
      JSON.stringify({
        cardId,
        cardData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fate card error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Phase B: Compute score delta for scan-over-scan comparison
// Receives: { user_id: string, scan_id: string }
// Fetches the 2 most recent score_history records and computes delta_summary
// Updates the newer record with the delta and summary_text

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { setCurrentScanId, clearCurrentScanId } from "../_shared/cost-logger.ts";



const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// Call AI via Lovable AI gateway to generate a 1-sentence summary
// NOTE: Career Position Score = 100 - determinism_index.
// Higher determinism_index = HIGHER automation risk = WORSE for the user.
// `careerScoreDelta` here is the change in Career Position (so positive = better).
async function generateDeltaSummary(
  currentCareerScore: number,
  previousCareerScore: number,
  careerScoreDelta: number,
): Promise<string> {
  if (!LOVABLE_API_KEY) {
    return `Your Career Position ${careerScoreDelta > 0 ? 'improved' : 'declined'} by ${Math.abs(careerScoreDelta)} points since your last scan.`;
  }

  try {
    const direction = careerScoreDelta > 0 ? 'improved' : 'declined';
    const prompt = `You are a career AI analyst. In one short sentence (max 15 words), describe the career impact of someone whose Career Position Score (higher = safer from AI displacement, lower = more at risk) ${direction} from ${previousCareerScore} to ${currentCareerScore} (delta: ${careerScoreDelta > 0 ? '+' : ''}${careerScoreDelta}). Be encouraging if delta is positive, cautionary if negative. Respond with ONLY the sentence, no quotes.`;

    const aiCtrl = new AbortController();
    const aiT = setTimeout(() => aiCtrl.abort(), 30_000);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 100,
      }),
      signal: aiCtrl.signal,
    });
    clearTimeout(aiT);

    if (!res.ok) {
      console.warn(`[compute-delta] AI gateway failed ${res.status}`);
      return `Your Career Position ${careerScoreDelta > 0 ? 'improved' : 'dipped'} by ${Math.abs(careerScoreDelta)} points since your last scan.`;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    return text.trim() || `Your Career Position ${careerScoreDelta > 0 ? 'improved' : 'dipped'} by ${Math.abs(careerScoreDelta)} points since your last scan.`;
  } catch (err) {
    console.warn("[compute-delta] AI generation failed:", err);
    return `Your Career Position ${careerScoreDelta > 0 ? 'improved' : 'dipped'} by ${Math.abs(careerScoreDelta)} points since your last scan.`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const body = await req.json();
    const { user_id, scan_id } = body;

    if (!user_id || !scan_id) {
      return new Response(JSON.stringify({ error: "Missing user_id or scan_id" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    // Attribute downstream cost_event rows to this scan for /admin/costs.
    setCurrentScanId(scan_id);
    const sb = createAdminClient();

    // Fetch the 2 most recent score_history records for this user
    const { data: records, error: fetchError } = await sb
      .from("score_history")
      .select("id, scan_id, determinism_index, survivability_score, moat_score, role_detected, created_at")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(2);

    if (fetchError) {
      console.error("[compute-delta] Fetch error:", fetchError);
      return new Response(JSON.stringify({ error: "Database fetch failed" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ error: "No score history found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // If only 1 record exists, this is the first scan
    if (records.length === 1) {
      const summaryText = "Run your first scan to see your score history here.";
      const delta = {
        score_change: 0,
        moved_up: [],
        moved_down: [],
        new_risks: [],
        new_moats: [],
        summary_text: summaryText,
      };

      await sb
        .from("score_history")
        .update({ delta_summary: delta })
        .eq("id", records[0].id);

      return new Response(JSON.stringify({ success: true, is_first_scan: true }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // We have 2 or more records — compute delta between newest and second-newest
    const newer = records[0]; // Most recent
    const older = records[1]; // Second most recent

    // Career Position Score = 100 - determinism_index (higher = safer).
    // Surface the delta in Career Position terms so the UI/narrative
    // matches the hero number users see ("91 out of 100").
    const newerCareerScore = 100 - (newer.determinism_index || 0);
    const olderCareerScore = 100 - (older.determinism_index || 0);
    const scoreChange = newerCareerScore - olderCareerScore;

    // Placeholder arrays — require complex KG query (Phase C/D)
    const movedUp: string[] = [];
    const movedDown: string[] = [];
    const newRisks: string[] = [];
    const newMoats: string[] = [];

    // Generate summary_text
    let summaryText: string;
    if (scoreChange === 0) {
      summaryText = "Career Position unchanged since last scan.";
    } else if (Math.abs(scoreChange) <= 5) {
      summaryText = `Your Career Position ${scoreChange > 0 ? 'improved' : 'dipped'} by ${Math.abs(scoreChange)} points since your last scan.`;
    } else {
      // Call Gemini Flash for >5 point changes
      summaryText = await generateDeltaSummary(
        newerCareerScore,
        olderCareerScore,
        scoreChange,
      );
    }

    const delta = {
      score_change: scoreChange,
      moved_up: movedUp,
      moved_down: movedDown,
      new_risks: newRisks,
      new_moats: newMoats,
      summary_text: summaryText,
    };

    // Update the newer record with delta_summary
    const { error: updateError } = await sb
      .from("score_history")
      .update({ delta_summary: delta })
      .eq("id", newer.id);

    if (updateError) {
      console.error("[compute-delta] Update error:", updateError);
      return new Response(JSON.stringify({ error: "Database update failed" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, score_change: scoreChange, summary_text: summaryText }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[compute-delta] Fatal error:", err);
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } finally {
    clearCurrentScanId();
  }
});

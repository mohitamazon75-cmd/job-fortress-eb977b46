// Phase B: Compute score delta for scan-over-scan comparison
// Receives: { user_id: string, scan_id: string }
// Fetches the 2 most recent score_history records and computes delta_summary
// Updates the newer record with the delta and summary_text

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// Call AI via Lovable AI gateway to generate a 1-sentence summary
async function generateDeltaSummary(
  currentDI: number,
  previousDI: number,
  scoreDelta: number
): Promise<string> {
  if (!LOVABLE_API_KEY) {
    return `Your score ${scoreDelta > 0 ? 'improved' : 'declined'} by ${Math.abs(scoreDelta)} points since your last scan.`;
  }

  try {
    const prompt = `You are a career AI analyst. In one short sentence (max 15 words), describe the career impact of someone whose automation risk determinism index changed from ${previousDI} to ${currentDI} (delta: ${scoreDelta > 0 ? '+' : ''}${scoreDelta}). Be encouraging if delta is positive, cautionary if negative. Respond with ONLY the sentence, no quotes.`;

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
      return `Your score ${scoreDelta > 0 ? 'improved' : 'dipped'} by ${Math.abs(scoreDelta)} points since your last scan.`;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    return text.trim() || `Your score ${scoreDelta > 0 ? 'improved' : 'dipped'} by ${Math.abs(scoreDelta)} points since your last scan.`;
  } catch (err) {
    console.warn("[compute-delta] AI generation failed:", err);
    return `Your score ${scoreDelta > 0 ? 'improved' : 'dipped'} by ${Math.abs(scoreDelta)} points since your last scan.`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id, scan_id } = body;

    if (!user_id || !scan_id) {
      return new Response(JSON.stringify({ error: "Missing user_id or scan_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Fetch the 2 most recent score_history records for this user
    const { data: records, error: fetchError } = await supabase
      .from("score_history")
      .select("id, scan_id, determinism_index, survivability_score, moat_score, role_detected, created_at")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(2);

    if (fetchError) {
      console.error("[compute-delta] Fetch error:", fetchError);
      return new Response(JSON.stringify({ error: "Database fetch failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ error: "No score history found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

      await supabase
        .from("score_history")
        .update({ delta_summary: delta })
        .eq("id", records[0].id);

      return new Response(JSON.stringify({ success: true, is_first_scan: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // We have 2 or more records — compute delta between newest and second-newest
    const newer = records[0]; // Most recent
    const older = records[1]; // Second most recent

    const scoreChange = (newer.determinism_index || 0) - (older.determinism_index || 0);

    // Placeholder arrays — require complex KG query (Phase C/D)
    const movedUp: string[] = [];
    const movedDown: string[] = [];
    const newRisks: string[] = [];
    const newMoats: string[] = [];

    // Generate summary_text
    let summaryText: string;
    if (scoreChange === 0) {
      summaryText = "Score unchanged since last scan.";
    } else if (Math.abs(scoreChange) <= 5) {
      summaryText = `Your score ${scoreChange > 0 ? 'improved' : 'dipped'} by ${Math.abs(scoreChange)} points since your last scan.`;
    } else {
      // Call Gemini Flash for >5 point changes
      summaryText = await generateDeltaSummary(
        newer.determinism_index || 0,
        older.determinism_index || 0,
        scoreChange
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
    const { error: updateError } = await supabase
      .from("score_history")
      .update({ delta_summary: delta })
      .eq("id", newer.id);

    if (updateError) {
      console.error("[compute-delta] Update error:", updateError);
      return new Response(JSON.stringify({ error: "Database update failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, score_change: scoreChange, summary_text: summaryText }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[compute-delta] Fatal error:", err);
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

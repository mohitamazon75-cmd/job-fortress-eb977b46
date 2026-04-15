/**
 * ResultsChoose — Routes to the rich Model B analysis (7.8/10 experience).
 *
 * Flow: any link to /results/choose?id=... → /results/model-b?id=...
 *
 * The Model B analysis (get-model-b-analysis edge fn) produces:
 *   card1_risk: fear_hook, confrontation, cost_of_inaction
 *   card2_market: live market signals, disruption timeline
 *   card3_shield: cognitive moat, ATS keywords matched
 *   card4_pivot: role transitions with negotiation anchors
 *   card5_jobs: real job matches from live search
 *   card6_blindspots: blind spots, interview prep questions
 *   card7_human: human advantages with proof labels
 *
 * SevenCardReveal (the swipeable teaser) is shown as part of the main /
 * scan flow before the user reaches this point.
 */
import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function ResultsChoose() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const analysisId = searchParams.get("id");

  useEffect(() => {
    if (!analysisId) {
      navigate("/", { replace: true });
      return;
    }

    // Analytics continuity
    supabase.functions.invoke("log-ab-event", {
      body: { analysis_id: analysisId, event_type: "model_b_redirect" },
    }).catch(() => {});

    // Route to the rich Model B analysis
    navigate(`/results/model-b?id=${analysisId}`, { replace: true });
  }, [analysisId, navigate]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF9F6" }}>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "#6B6960" }}>
        Generating your personalised analysis…
      </div>
    </div>
  );
}

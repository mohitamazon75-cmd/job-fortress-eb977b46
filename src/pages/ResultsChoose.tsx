/**
 * ResultsChoose — Previously showed "choose Model A or Model B".
 * Now redirects to the unified flow (/?id=scanId) which uses the
 * new SevenCardReveal experience — same data, no forced choice.
 *
 * Kept as a named route so that any external links/bookmarks
 * to /results/choose?id=... still work correctly.
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

    // Log the redirect for analytics continuity
    supabase.functions.invoke("log-ab-event", {
      body: { analysis_id: analysisId, event_type: "unified_redirect" },
    }).catch(() => {});

    // Redirect to the main flow which now shows SevenCardReveal
    navigate(`/?id=${analysisId}`, { replace: true });
  }, [analysisId, navigate]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF9F6" }}>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "#6B6960" }}>
        Loading your report…
      </div>
    </div>
  );
}

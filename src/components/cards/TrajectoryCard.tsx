/**
 * TrajectoryCard — "Where are you headed?"
 * 
 * Shows the user's projected score at 30/90/180 days:
 * - WITHOUT any action (decay curve)
 * - WITH actions they're already taking (based on signals)
 * 
 * The key insight: most users don't realise their score DECAYS
 * automatically as AI adoption accelerates. This card creates urgency
 * without being manipulative — it shows a real projection, not fake scarcity.
 * 
 * Gets smarter: as cohort data accumulates, prediction shifts from
 * model-based → cohort-validated → high-confidence.
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface TrajectoryData {
  current_score: number;
  predicted_score_30d: number;
  predicted_score_90d: number;
  predicted_score_180d: number;
  no_action_score_90d: number;
  monthly_decay_rate: number;
  cohort_size: number;
  top_actions: Array<{ action: string; expected_score_impact: number; months_to_see_impact: number }>;
  confidence: "model" | "cohort" | "high";
  role: string;
  industry: string;
}

const ACTION_LABELS: Record<string, string> = {
  skill_selected: "Investigate and learn a skill from your risk list",
  plan_action_checked: "Complete actions from your 90-Day Plan",
  job_clicked: "Apply to a matching role on Naukri/LinkedIn",
  pivot_expanded: "Research and pursue a career pivot path",
  vocab_copied: "Use power phrases in your next meeting",
  tool_opened: "Explore the full toolkit",
};

function ScoreBar({ label, score, max = 100, color, isUser = false }: {
  label: string; score: number; max?: number; color: string; isUser?: boolean;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: isUser ? 800 : 600, color: isUser ? "var(--mb-ink)" : "var(--mb-ink3)" }}>{label}</span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 800, color }}>{score}</span>
      </div>
      <div style={{ height: isUser ? 10 : 6, background: "var(--mb-paper)", borderRadius: 5, overflow: "hidden", border: "1px solid var(--mb-rule)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(score / max) * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ height: "100%", background: color, borderRadius: 5 }}
        />
      </div>
    </div>
  );
}

export default function TrajectoryCard({ analysisId, cardData }: { analysisId: string; cardData: any }) {
  const [trajectory, setTrajectory] = useState<TrajectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!analysisId) return;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("compute-trajectory", {
          body: { scan_id: analysisId },
        });
        if (data?.success) setTrajectory(data.data);
      } catch (e) {
        console.debug("[TrajectoryCard] fetch failed:", e);
        setHasError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [analysisId]);

  if (loading) return (
    <div style={{ padding: "24px 0", textAlign: "center", color: "var(--mb-ink3)", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
      Computing your trajectory...
    </div>
  );

  if (hasError || !trajectory) return (
    <div style={{ padding: "20px 0", textAlign: "center", color: "var(--mb-ink3)", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
      Trajectory data unavailable — rescan to compute your projection.
    </div>
  );

  const gap = trajectory.predicted_score_90d - trajectory.no_action_score_90d;
  const isImproving = gap > 2;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mb-navy)", marginBottom: 6 }}>
          📡 Career Trajectory Engine
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "var(--mb-ink)", letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 8 }}>
          Where are you headed?
        </div>
        <div style={{ fontSize: 13, color: "var(--mb-ink3)", lineHeight: 1.6 }}>
          Your score decays automatically as AI adoption accelerates in your industry. Here's your 6-month projection.
        </div>
      </div>

      {/* Decay warning */}
      <div style={{ background: "rgba(220,38,38,0.05)", border: "1.5px solid rgba(220,38,38,0.15)", borderRadius: 12, padding: "12px 14px", marginBottom: 18, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--mb-red, #dc2626)", marginBottom: 3 }}>
            Without action: {trajectory.no_action_score_90d}/100 in 90 days
          </div>
          <div style={{ fontSize: 12, color: "var(--mb-ink3)", lineHeight: 1.5 }}>
            {trajectory.industry} is automating at {trajectory.monthly_decay_rate}%/month. AI tools don't slow down — your score decays unless you act.
          </div>
        </div>
      </div>

      {/* Score projections */}
      <div style={{ background: "white", border: "1.5px solid var(--mb-rule)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--mb-ink3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
          Score projection — with your current actions
        </div>
        <ScoreBar label="Today" score={trajectory.current_score} color="var(--mb-blue, #2563eb)" isUser />
        <ScoreBar label="30 days" score={trajectory.predicted_score_30d} color={trajectory.predicted_score_30d >= trajectory.current_score ? "var(--mb-green, #16a34a)" : "var(--mb-amber, #d97706)"} />
        <ScoreBar label="90 days" score={trajectory.predicted_score_90d} color={trajectory.predicted_score_90d >= trajectory.current_score ? "var(--mb-green, #16a34a)" : "var(--mb-amber, #d97706)"} />
        <ScoreBar label="180 days" score={trajectory.predicted_score_180d} color={trajectory.predicted_score_180d >= trajectory.current_score ? "var(--mb-green, #16a34a)" : "var(--mb-red, #dc2626)"} />

        {isImproving && gap > 3 && (
          <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(22,163,74,0.06)", borderRadius: 10, border: "1px solid rgba(22,163,74,0.2)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--mb-green, #16a34a)" }}>
              ✅ Your actions are adding +{gap} pts vs doing nothing
            </span>
          </div>
        )}
      </div>

      {/* Cohort context */}
      {trajectory.cohort_size > 0 && (
        <div style={{ padding: "11px 14px", borderRadius: 10, background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--mb-ink)", marginBottom: 3 }}>
            👥 {trajectory.cohort_size} {trajectory.role}s in our dataset
          </div>
          <div style={{ fontSize: 12, color: "var(--mb-ink3)", lineHeight: 1.5 }}>
            {trajectory.confidence === "cohort"
              ? `Among similar professionals who rescanned, the median score change was ${trajectory.cohort_size > 0 ? "tracked" : "being collected"}.`
              : "Prediction based on Knowledge Graph calibration. Gets more accurate as more professionals rescan."}
          </div>
          <div style={{ fontSize: 10, color: "var(--mb-ink4)", marginTop: 6, fontStyle: "italic" }}>
            Confidence: {trajectory.confidence === "model" ? "Model-based" : trajectory.confidence === "cohort" ? "Cohort-validated" : "High (real data)"}
          </div>
        </div>
      )}

      {/* Recommended actions to improve trajectory */}
      {trajectory.top_actions.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--mb-ink3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            To improve your trajectory
          </div>
          {trajectory.top_actions.map((action, i) => (
            <div key={i} style={{ padding: "10px 14px", borderRadius: 10, background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "var(--mb-ink2)", lineHeight: 1.4 }}>
                {ACTION_LABELS[action.action] || action.action}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--mb-green, #16a34a)", flexShrink: 0, background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)", borderRadius: 8, padding: "3px 10px" }}>
                +{action.expected_score_impact} pts
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

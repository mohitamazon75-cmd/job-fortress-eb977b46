// ════════════════════════════════════════════════════════════════
// MondayMoveCard — sticky single-action prompt above the 7-card journey.
// Counsellor-driven UX: anxious user must see ONE concrete thing to do
// on Monday morning. Deterministic only — no LLM call, no new latency.
// ════════════════════════════════════════════════════════════════

import { useMemo } from "react";

type CardData = any;

/** Pick the single highest-leverage action for this user's Monday morning. */
function pickMondayMove(cardData: CardData): { action: string; hinglish: string; source: string } {
  // Priority 1: Card 1's `confrontation` is engineered to "end with a specific action"
  const c1Conf = cardData?.card1_risk?.confrontation;
  if (typeof c1Conf === "string" && c1Conf.trim().length > 0) {
    // Take the last sentence (Agent prompt: "End with a specific action, not a question")
    const sentences = c1Conf.split(/(?<=[.!?])\s+/).filter(Boolean);
    const action = (sentences[sentences.length - 1] || c1Conf).trim();
    return {
      action,
      hinglish: "Yeh ek kaam Monday subah karo. Bas yahi.",
      source: "From your risk verdict",
    };
  }

  // Priority 2: this week's survival diet day-1 item
  const diet = cardData?.weekly_survival_diet?.items;
  if (Array.isArray(diet) && diet.length > 0) {
    const first = diet[0];
    const skill = first?.skill || first?.action || first?.title;
    if (skill) {
      return {
        action: `Spend 30 minutes on ${skill}. Open one tutorial. Finish it.`,
        hinglish: `Monday subah 30 minute ${skill} pe lagao. Ek tutorial. Khatam karo.`,
        source: "From your survival diet",
      };
    }
  }

  // Priority 3: most critical gap skill from Card 3 Shield
  const shield = cardData?.card3_shield?.skills;
  if (Array.isArray(shield)) {
    const gap = shield.find((s: any) => s?.tier === "critical-gap" || s?.tier === "buildable");
    if (gap?.name) {
      return {
        action: `Open one ${gap.name} tutorial on Monday. Just one. Watch it end-to-end.`,
        hinglish: `Monday ko ek ${gap.name} ka tutorial dekho. Sirf ek. Pura dekho.`,
        source: "From your skill shield",
      };
    }
  }

  // Priority 4: a target role from pivot paths
  const pivots = cardData?.card4_pivot?.adjacent_roles || cardData?.card4_pivot?.paths;
  if (Array.isArray(pivots) && pivots.length > 0) {
    const role = pivots[0]?.role || pivots[0]?.title;
    if (role) {
      return {
        action: `Open Naukri Monday morning. Search "${role}". Read 3 listings end-to-end.`,
        hinglish: `Monday subah Naukri kholo. "${role}" search karo. 3 listings padho.`,
        source: "From your pivot paths",
      };
    }
  }

  // Final fallback — still concrete
  return {
    action: "Open Naukri Monday morning. Search your role. Read 3 listings end-to-end.",
    hinglish: "Monday subah Naukri kholo. Apni role search karo. 3 listings padho.",
    source: "Default action",
  };
}

export default function MondayMoveCard({ cardData }: { cardData: CardData }) {
  const move = useMemo(() => pickMondayMove(cardData), [cardData]);

  return (
    <div
      style={{
        background: "linear-gradient(135deg, var(--mb-navy-tint) 0%, white 60%)",
        border: "1.5px solid var(--mb-navy-tint2)",
        borderLeft: "5px solid var(--mb-navy)",
        borderRadius: 16,
        padding: "18px 22px",
        marginBottom: 20,
        boxShadow: "0 2px 10px rgba(27,47,85,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            fontWeight: 800,
            color: "var(--mb-navy)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            background: "white",
            padding: "4px 10px",
            borderRadius: 12,
            border: "1px solid var(--mb-navy-tint2)",
          }}
        >
          📌 Your Monday Move
        </span>
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 10.5,
            fontWeight: 700,
            color: "var(--mb-ink3)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          · {move.source}
        </span>
      </div>

      <p
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 18,
          fontWeight: 700,
          color: "var(--mb-ink)",
          lineHeight: 1.45,
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        {move.action}
      </p>

      <p
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--mb-ink2)",
          fontStyle: "italic",
          lineHeight: 1.5,
          marginTop: 8,
          marginBottom: 0,
        }}
      >
        {move.hinglish}
      </p>
    </div>
  );
}

// Exported for testing
export { pickMondayMove };

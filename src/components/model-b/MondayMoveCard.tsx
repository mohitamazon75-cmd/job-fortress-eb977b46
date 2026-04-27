// ════════════════════════════════════════════════════════════════
// MondayMoveCard — sticky single-action prompt above the 7-card journey.
// Counsellor-driven UX: anxious user must see ONE concrete thing to do
// on Monday morning. Deterministic only — no LLM call, no new latency.
//
// Picker contract (v2, 2026-04-27):
//   Concrete > abstract. Skill/tool/role-anchored actions are picked
//   FIRST. The risk-verdict's closing sentence is only used if it
//   passes a quality filter (must contain a concrete verb AND either
//   a number or a Proper-Noun token). Otherwise it is rejected as
//   vague and we fall through to the next priority.
// ════════════════════════════════════════════════════════════════

import { useMemo } from "react";

type CardData = any;
type Move = { action: string; hinglish: string; source: string; why?: string };

const CONCRETE_VERBS = /\b(open|search|read|write|draft|send|email|call|post|publish|finish|complete|build|ship|record|message|dm|apply|review|list|map|sketch|outline|prepare|book|schedule)\b/i;
const HAS_NUMBER = /\b\d+\b/;
const HAS_PROPER_NOUN = /\b[A-Z][a-zA-Z]{2,}/; // crude but effective
const VAGUE_OPENERS = /^(one|a|an|the)\s+\w+\s+(you|to)\b/i; // "One revenue outcome you own"

/** Concrete-enough to put on a calendar? */
function isActionable(sentence: string): boolean {
  const s = sentence.trim();
  if (s.length < 12 || s.length > 180) return false;
  if (VAGUE_OPENERS.test(s)) return false;
  if (!CONCRETE_VERBS.test(s)) return false;
  // must anchor to something real: a number OR a proper noun (tool/company/role)
  return HAS_NUMBER.test(s) || HAS_PROPER_NOUN.test(s);
}

/** Pick the single highest-leverage action for this user's Monday morning. */
function pickMondayMove(cardData: CardData): Move {
  // ── Priority 0: server-computed monday_move (deterministic, from get-model-b-analysis) ──
  const server = cardData?.monday_move;
  if (server && typeof server === "object" && typeof server.action === "string" && server.action.trim().length > 0) {
    return {
      action: String(server.action),
      hinglish: String(server.hinglish || "Yeh ek kaam Monday subah karo. Bas yahi."),
      source: String(server.source || "Your Monday move"),
      why: typeof server.why === "string" ? server.why : undefined,
    };
  }

  // ── Priority 1: a target role from pivot paths (most concrete: search + read) ──
  const pivots = cardData?.card4_pivot?.adjacent_roles || cardData?.card4_pivot?.paths;
  if (Array.isArray(pivots) && pivots.length > 0) {
    const role = pivots[0]?.role || pivots[0]?.title;
    if (role && typeof role === "string") {
      return {
        action: `Open Naukri Monday morning. Search "${role}". Read 3 listings end-to-end and copy 5 repeated keywords.`,
        hinglish: `Monday subah Naukri kholo. "${role}" search karo. 3 listings padho, 5 keywords note karo.`,
        source: "From your pivot paths",
        why: "These keywords go straight into your resume this week.",
      };
    }
  }

  // ── Priority 2: most critical gap skill from Card 3 Shield ──
  const shield = cardData?.card3_shield?.skills;
  if (Array.isArray(shield)) {
    const gap = shield.find((s: any) => s?.tier === "critical-gap")
             || shield.find((s: any) => s?.tier === "buildable");
    if (gap?.name) {
      return {
        action: `Open one ${gap.name} tutorial on Monday. Just one. Watch it end-to-end and ship one tiny output.`,
        hinglish: `Monday ko ek ${gap.name} ka tutorial dekho. Sirf ek. Pura dekho, ek chhota output banao.`,
        source: "From your skill shield",
        why: `${gap.name} is your highest-leverage gap right now.`,
      };
    }
  }

  // ── Priority 3: this week's survival-diet day-1 item ──
  const diet = cardData?.weekly_survival_diet?.items;
  if (Array.isArray(diet) && diet.length > 0) {
    const first = diet[0];
    const skill = first?.skill || first?.action || first?.title;
    if (skill && typeof skill === "string") {
      return {
        action: `Spend 30 minutes on ${skill} Monday morning. Open one tutorial. Finish it.`,
        hinglish: `Monday subah 30 minute ${skill} pe lagao. Ek tutorial. Khatam karo.`,
        source: "From your survival diet",
        why: "Day 1 of the 7-day plan you already have.",
      };
    }
  }

  // ── Priority 4: card1 confrontation — ONLY if its closing sentence is actionable ──
  const c1Conf = cardData?.card1_risk?.confrontation;
  if (typeof c1Conf === "string" && c1Conf.trim().length > 0) {
    const sentences = c1Conf.split(/(?<=[.!?])\s+/).map((s: string) => s.trim()).filter(Boolean);
    // try last, then second-last (sometimes the real action is the penultimate)
    const candidates = [sentences[sentences.length - 1], sentences[sentences.length - 2]].filter(Boolean) as string[];
    const good = candidates.find(isActionable);
    if (good) {
      return {
        action: good,
        hinglish: "Yeh ek kaam Monday subah karo. Bas yahi.",
        source: "From your risk verdict",
      };
    }
  }

  // ── Final fallback — still concrete, role-aware if we have it ──
  const role = cardData?.profile?.role || cardData?.role;
  const search = role && typeof role === "string" ? role : "your role";
  return {
    action: `Open Naukri Monday morning. Search "${search}". Read 3 listings end-to-end and copy 5 repeated keywords.`,
    hinglish: `Monday subah Naukri kholo. "${search}" search karo. 3 listings padho, 5 keywords note karo.`,
    source: "Default action",
    why: "Even 20 minutes here beats another anxious doom-scroll.",
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
          flexWrap: "wrap",
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

      {move.why && (
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--mb-ink2)",
            lineHeight: 1.5,
            marginTop: 8,
            marginBottom: 0,
          }}
        >
          Why: {move.why}
        </p>
      )}

      <p
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--mb-ink2)",
          fontStyle: "italic",
          lineHeight: 1.5,
          marginTop: 6,
          marginBottom: 0,
        }}
      >
        {move.hinglish}
      </p>
    </div>
  );
}

// Exported for testing
export { pickMondayMove, isActionable };

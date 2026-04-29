// ════════════════════════════════════════════════════════════════
// CopyInterviewAnswer — tangible artifact for Card 6 (Blind Spots).
// Each blind spot becomes a STAR-format interview answer skeleton
// the user can copy and adapt. This converts "you have a gap" into
// "here's exactly what to say when they ask about it on Monday".
//
// Pure client. Deterministic. No LLM. Template is calibrated to
// reframe a gap into a learning narrative — the interview answer
// recruiters actually want to hear.
// ════════════════════════════════════════════════════════════════

import { useState } from "react";

type Props = {
  gapTitle: string;
  role?: string;
  firstName?: string | null;
};

function buildAnswer(gapTitle: string, role: string, firstName?: string | null): string {
  const name = firstName?.trim();
  const intro = name ? `Interview answer template — ${name}` : "Interview answer template";
  const gap = gapTitle.trim();
  const r = role.trim() || "your role";
  return [
    `${intro}`,
    `Question: "Tell me about a gap in your background — specifically around ${gap}."`,
    ``,
    `SITUATION: In my current role as ${r}, I noticed that ${gap.toLowerCase()} was becoming a critical capability for the team.`,
    ``,
    `TASK: I needed to close that gap quickly — both for my own work and to keep contributing at the level the team needed.`,
    ``,
    `ACTION: I [pick ONE: shipped a small project / took a focused course / shadowed a senior / built a side project] specifically on ${gap.toLowerCase()}. I gave myself a 30-day window and a concrete output.`,
    ``,
    `RESULT: [Add the measurable outcome — % time saved, project shipped, peer feedback, certificate earned. Keep it specific.]`,
    ``,
    `What I learned: This taught me to spot capability gaps early instead of waiting for them to become blockers. I now run a 30-day "gap audit" on myself every quarter.`,
    ``,
    `— Source: jobbachao.com career scan`,
  ].join("\n");
}

export default function CopyInterviewAnswer({ gapTitle, role = "", firstName }: Props) {
  const [copied, setCopied] = useState(false);
  const trimmed = String(gapTitle || "").trim();
  if (!trimmed) return null;

  const handleCopy = async () => {
    const payload = buildAnswer(trimmed, role, firstName);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy STAR interview answer for ${trimmed}`}
      style={{
        marginTop: 10,
        padding: "8px 14px",
        borderRadius: 10,
        border: "1.5px solid var(--mb-navy)",
        background: copied ? "var(--mb-green-tint)" : "white",
        color: copied ? "var(--mb-green)" : "var(--mb-navy)",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.02em",
        cursor: "pointer",
        minHeight: 36,
      }}
    >
      {copied ? "✓ Copied — paste into Notes app" : "📋 Copy STAR interview answer"}
    </button>
  );
}

// Exported for testing
export { buildAnswer };

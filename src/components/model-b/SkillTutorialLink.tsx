// ════════════════════════════════════════════════════════════════
// SkillTutorialLink — tangible artifact for Card 3 (Skill Shield).
// One-click deep-link to a tutorial for a critical-gap or buildable
// skill. Uses india-course-map (already in repo) when we have a
// curated India-specific resource; otherwise falls back to a YouTube
// search URL — same pattern Card3 already uses for the weekly diet,
// kept consistent so the user trusts the link.
//
// Pure client. Deterministic. No LLM, no network.
// ════════════════════════════════════════════════════════════════

import { getCoursesForSkills } from "@/lib/india-course-map";

type Props = {
  skill: string;
};

function youtubeSearchUrl(skill: string): string {
  const q = `${skill} tutorial for beginners 2026`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export default function SkillTutorialLink({ skill }: Props) {
  const trimmed = String(skill || "").trim();
  if (!trimmed) return null;

  // Try curated India course first (zero-cost affiliate engine)
  const recs = getCoursesForSkills([trimmed], 1);
  const curated = recs[0]?.courses?.[0];
  const href = curated?.url || youtubeSearchUrl(trimmed);
  const label = curated
    ? `▶ Open ${curated.platform} tutorial`
    : `▶ Open ${trimmed} tutorial`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open a tutorial for ${trimmed}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginLeft: 6,
        padding: "3px 10px",
        borderRadius: 999,
        background: "white",
        border: "1.5px solid var(--mb-navy)",
        color: "var(--mb-navy)",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.02em",
        textDecoration: "none",
        minHeight: 26,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </a>
  );
}

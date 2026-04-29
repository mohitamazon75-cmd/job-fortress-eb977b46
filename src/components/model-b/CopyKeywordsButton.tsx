// ════════════════════════════════════════════════════════════════
// CopyKeywordsButton — tangible artifact for Card 1 (Risk Mirror).
// Tabs were "forgetful" per user feedback (Farheen, 2026-04-29).
// This gives the user something concrete to take with them: the
// exact keywords missing from their resume, copy-pasted into clipboard
// so they can paste straight into their CV/LinkedIn this week.
//
// Pure client. Deterministic. No LLM, no network. Receives keywords
// as a prop — does not re-derive them, so single source of truth
// stays inside Card1RiskMirror.
// ════════════════════════════════════════════════════════════════

import { useState } from "react";

type Props = {
  keywords: string[];
  firstName?: string | null;
};

export default function CopyKeywordsButton({ keywords, firstName }: Props) {
  const [copied, setCopied] = useState(false);
  const cleaned = (keywords || []).map(k => String(k || "").trim()).filter(Boolean);
  if (cleaned.length === 0) return null;

  const handleCopy = async () => {
    const name = firstName?.trim();
    const header = name
      ? `${name} — keywords to add to your resume + LinkedIn this week:`
      : "Keywords to add to your resume + LinkedIn this week:";
    const body = cleaned.map(k => `• ${k}`).join("\n");
    const footer = "\n\nSource: jobbachao.com — your AI risk scan.";
    const payload = `${header}\n\n${body}${footer}`;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // fallback: select the visible list (long-press on mobile)
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${cleaned.length} resume keywords to clipboard`}
      style={{
        marginTop: 12,
        padding: "10px 16px",
        borderRadius: 10,
        border: "1.5px solid var(--mb-navy)",
        background: copied ? "var(--mb-green-tint)" : "var(--mb-navy)",
        color: copied ? "var(--mb-green)" : "white",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: "0.02em",
        cursor: "pointer",
        minHeight: 40,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {copied
        ? `✓ Copied ${cleaned.length} keyword${cleaned.length === 1 ? "" : "s"} — paste into your CV`
        : `📋 Copy ${cleaned.length} resume keyword${cleaned.length === 1 ? "" : "s"}`}
    </button>
  );
}

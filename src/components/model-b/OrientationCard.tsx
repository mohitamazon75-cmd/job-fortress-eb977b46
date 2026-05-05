import { useMemo } from "react";
import { detectRoleFamily, getFamilyNarrative } from "@/lib/role-family";

type CardData = any;

/**
 * OrientationCard — first surface after the Verdict paywall.
 *
 * Goal: name ONE real observation about this user (the engine's
 * most specific finding), then frame the rest of the report.
 * Replaces the Monday Move strip on Card 1 (Risk Mirror), which
 * read as vague-action when users opened mid-week.
 *
 * Pure component — derives everything from cardData + firstName.
 * Fail-graceful: every personal field has a fallback so we never
 * render an empty placeholder.
 */
export default function OrientationCard({
  cardData,
  firstName,
}: {
  cardData: CardData;
  firstName?: string | null;
}) {
  const trimmedName = firstName?.trim();
  const greeting = trimmedName
    ? `${trimmedName}, one thing first`
    : "One thing first";

  const observation = useMemo(() => {
    const topMoat =
      cardData?.card7_human?.advantages?.[0]?.title
      || (cardData?.card3_shield?.skills || [])
          .find((s: any) => s?.level === "best-in-class" || s?.level === "strong")?.name
      || null;

    const topGap =
      cardData?.card6_blindspots?.blind_spots?.[0]?.title
      || (cardData?.card3_shield?.skills || [])
          .find((s: any) => s?.level === "critical-gap")?.name
      || null;

    if (topMoat && topGap) {
      return `Your strongest card is ${topMoat}. Your biggest gap is ${topGap}. The next 4 cards show how to lean into one and close the other.`;
    }
    if (topMoat) {
      return `Your strongest card is ${topMoat}. The next 4 cards show how to lean into it — and where the real gaps are.`;
    }
    if (topGap) {
      return `Your biggest gap is ${topGap}. The next 4 cards show what's still protecting you and how to close the gap.`;
    }

    try {
      const u = cardData?.user || {};
      const roleFamilyInput = {
        role: u?.current_title || u?.role || cardData?.role || "",
        role_detected: u?.role_detected || u?.current_title || "",
      } as any;
      const family = detectRoleFamily(roleFamilyInput);
      if (family !== "GENERIC") {
        const fam = getFamilyNarrative(family);
        return fam.threatFrame;
      }
    } catch {
      // Fall through.
    }

    return "The next 4 cards show what's actually happening to your role and what to do about it. Real numbers, no fluff.";
  }, [cardData]);

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
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          fontWeight: 800,
          color: "var(--mb-navy)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {greeting}
      </div>

      <p
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 18,
          fontStyle: "italic",
          fontWeight: 600,
          color: "var(--mb-ink)",
          lineHeight: 1.5,
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        {observation}
      </p>

      <p
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--mb-ink2)",
          lineHeight: 1.5,
          marginTop: 12,
          marginBottom: 0,
        }}
      >
        Give this 15–20 focused minutes — not a lunchtime skim. Save the page and come back twice this week. You don't have to act today.
      </p>
    </div>
  );
}

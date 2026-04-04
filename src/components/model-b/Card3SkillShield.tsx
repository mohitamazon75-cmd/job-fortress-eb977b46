import { CardShell, CardHead, CardBody, Badge, EmotionStrip, SectionLabel, InfoBox, CardNav } from "./SharedUI";

interface Props {
  cardData: any;
  onBack: () => void;
  onNext: () => void;
}

const skillBadgeMap: Record<string, { label: string; bg: string; color: string; border: string }> = {
  "best-in-class": { label: "Best-in-class", bg: "var(--mb-green-tint)", color: "var(--mb-green)", border: "rgba(26,107,60,0.2)" },
  strong: { label: "Strong shield", bg: "var(--mb-green-tint)", color: "var(--mb-green)", border: "rgba(26,107,60,0.2)" },
  buildable: { label: "Build in 30–45 days", bg: "var(--mb-amber-tint)", color: "var(--mb-amber)", border: "rgba(139,90,0,0.2)" },
  "critical-gap": { label: "Critical gap", bg: "var(--mb-red-tint)", color: "var(--mb-red)", border: "rgba(174,40,40,0.2)" },
};

export default function Card3SkillShield({ cardData, onBack, onNext }: Props) {
  const c3 = cardData.card3_shield;
  if (!c3) return null;

  const r = 30;
  const C = 2 * Math.PI * r;
  const greenPct = c3.green_arc_pct || 0;
  const amberPct = c3.amber_arc_pct || 0;
  const greenOffset = C * (1 - greenPct / 100);
  // Amber arc starts where green ends
  const amberDash = C * amberPct / 100;
  const amberOffset = greenOffset - amberDash;

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="03 · Empowerment" variant="green" /><Badge label="Extracted from your resume" variant="green" /></>}
        title={c3.headline || "Skill Shield"}
        sub={c3.subline || ""}
      />
      <CardBody>
        <EmotionStrip bgColor="var(--mb-green-tint)" borderColor="rgba(26,107,60,0.15)" icon="✨" textColor="var(--mb-green)" message={c3.emotion_message || ""} />

        {/* Shield row */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", padding: 15, background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 12, marginBottom: 16 }}>
          <svg width={80} height={80} viewBox="0 0 80 80">
            <circle cx={40} cy={40} r={r} fill="none" stroke="var(--mb-rule)" strokeWidth={7} />
            <circle cx={40} cy={40} r={r} fill="none" stroke="var(--mb-green)" strokeWidth={7} strokeLinecap="round" transform="rotate(-90 40 40)" strokeDasharray={C} strokeDashoffset={greenOffset} />
            <circle cx={40} cy={40} r={r} fill="none" stroke="var(--mb-amber)" strokeWidth={7} strokeLinecap="round" transform="rotate(-90 40 40)" strokeDasharray={`${amberDash} ${C}`} strokeDashoffset={amberOffset} />
            <text x={40} y={37} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: "'DM Mono', monospace", fontSize: 19, fill: "var(--mb-ink)" }}>{c3.shield_score}</text>
            <text x={40} y={52} textAnchor="middle" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fill: "var(--mb-ink4)" }}>/100</text>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--mb-ink)" }}>Strong shield</span>
              {c3.badge_text && (
                <span style={{ fontSize: 11, background: "var(--mb-green-tint)", color: "var(--mb-green)", border: "1px solid rgba(26,107,60,0.2)", padding: "2px 9px", borderRadius: 20, marginLeft: 6, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{c3.badge_text}</span>
              )}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", lineHeight: 1.55, marginTop: 4 }}>{c3.shield_body}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-navy)", fontWeight: 600, marginTop: 7, cursor: "pointer" }}>See 60-day upgrade plan ↗</div>
          </div>
        </div>

        {/* Skills */}
        <SectionLabel label="Skills from your resume — honest assessment" />
        <div style={{ marginBottom: 16 }}>
          {(c3.skills || []).map((skill: any, i: number) => {
            const badge = skillBadgeMap[skill.level] || skillBadgeMap.buildable;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < (c3.skills?.length || 0) - 1 ? "1px solid var(--mb-rule)" : "none" }}>
                <span style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink)", fontWeight: 500 }}>{skill.name}</span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap", background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>{badge.label}</span>
              </div>
            );
          })}
        </div>

        {/* Resources */}
        <InfoBox variant="navy" title="Free resources for your skill gaps — India-verified">
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", lineHeight: 1.7 }}>
            {(c3.free_resources || []).map((res: any, i: number) => (
              <div key={i}>{res.skill} → {res.resource} · {res.cost || "Free"}</div>
            ))}
          </div>
        </InfoBox>

        <CardNav onBack={onBack} onNext={onNext} />
      </CardBody>
    </CardShell>
  );
}

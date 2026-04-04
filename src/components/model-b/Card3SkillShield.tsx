import { CardShell, CardHead, CardBody, Badge, EmotionStrip, SectionLabel, InfoBox, CardNav } from "./SharedUI";

interface Props {
  cardData: any;
  onBack: () => void;
  onNext: () => void;
  onUpgradePlan?: () => void;
}

const skillBadgeMap: Record<string, { label: string; bg: string; color: string; border: string }> = {
  "best-in-class": { label: "Best-in-class", bg: "var(--mb-green-tint)", color: "var(--mb-green)", border: "rgba(26,107,60,0.25)" },
  strong: { label: "Strong shield", bg: "var(--mb-green-tint)", color: "var(--mb-green)", border: "rgba(26,107,60,0.25)" },
  buildable: { label: "Build in 30–45 days", bg: "var(--mb-amber-tint)", color: "var(--mb-amber)", border: "rgba(139,90,0,0.25)" },
  "critical-gap": { label: "Critical gap", bg: "var(--mb-red-tint)", color: "var(--mb-red)", border: "rgba(174,40,40,0.25)" },
};

export default function Card3SkillShield({ cardData, onBack, onNext, onUpgradePlan }: Props) {
  const c3 = cardData.card3_shield;
  if (!c3) return null;

  const r = 30;
  const C = 2 * Math.PI * r;
  const greenPct = c3.green_arc_pct || 0;
  const amberPct = c3.amber_arc_pct || 0;
  const greenOffset = C * (1 - greenPct / 100);
  const amberDash = C * amberPct / 100;
  const amberOffset = -(C * greenPct / 100);

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
        <div style={{ display: "flex", gap: 16, alignItems: "center", padding: 18, background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 14, marginBottom: 18 }}>
          <svg width={88} height={88} viewBox="0 0 80 80">
            <circle cx={40} cy={40} r={r} fill="none" stroke="var(--mb-rule)" strokeWidth={8} />
            <circle cx={40} cy={40} r={r} fill="none" stroke="var(--mb-green)" strokeWidth={8} strokeLinecap="round" transform="rotate(-90 40 40)" strokeDasharray={C} strokeDashoffset={greenOffset} />
            <circle cx={40} cy={40} r={r} fill="none" stroke="var(--mb-amber)" strokeWidth={8} strokeLinecap="round" transform="rotate(-90 40 40)" strokeDasharray={`${amberDash} ${C}`} strokeDashoffset={amberOffset} />
            <text x={40} y={36} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 800, fill: "var(--mb-ink)" }}>{c3.shield_score}</text>
            <text x={40} y={52} textAnchor="middle" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, fill: "var(--mb-ink3)" }}>/100</text>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 800, color: "var(--mb-ink)" }}>Strong shield</span>
              {c3.badge_text && (
                <span style={{ fontSize: 12, background: "var(--mb-green-tint)", color: "var(--mb-green)", border: "1.5px solid rgba(26,107,60,0.25)", padding: "3px 12px", borderRadius: 20, fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}>{c3.badge_text}</span>
              )}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.65, marginTop: 6, fontWeight: 500 }}>{c3.shield_body}</div>
            <div
              onClick={onUpgradePlan}
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-navy)", fontWeight: 800, marginTop: 8, cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}
            >See 60-day upgrade plan ↗</div>
          </div>
        </div>

        {/* Skills */}
        <SectionLabel label="Skills from your resume — honest assessment" />
        <div style={{ marginBottom: 18 }}>
          {(c3.skills || []).map((skill: any, i: number) => {
            const badge = skillBadgeMap[skill.level] || skillBadgeMap.buildable;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < (c3.skills?.length || 0) - 1 ? "1px solid var(--mb-rule)" : "none" }}>
                <span style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink)", fontWeight: 600 }}>{skill.name}</span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 20, whiteSpace: "nowrap", background: badge.bg, color: badge.color, border: `1.5px solid ${badge.border}` }}>{badge.label}</span>
              </div>
            );
          })}
        </div>

        {/* Resources */}
        <InfoBox variant="navy" title="Free resources for your skill gaps — India-verified">
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.8, fontWeight: 500 }}>
            {(c3.free_resources || []).map((res: any, i: number) => (
              <div key={i}><strong style={{ fontWeight: 700, color: "var(--mb-ink)" }}>{res.skill}</strong> → {res.resource} · {res.cost || "Free"}</div>
            ))}
          </div>
        </InfoBox>

        <CardNav onBack={onBack} onNext={onNext} />
      </CardBody>
    </CardShell>
  );
}
import { useState } from "react";
import { CardShell, CardHead, CardBody, Badge, EmotionStrip, SectionLabel, InfoBox, CardNav, Badge as BadgeComp } from "./SharedUI";

interface Props {
  cardData: any;
  onBack: () => void;
  onNext: () => void;
  onUpgradePlan?: () => void;
}

const skillBadgeMap: Record<string, { label: string; bg: string; color: string; border: string }> = {
  "best-in-class": { label: "🏆 Best-in-class", bg: "var(--mb-green-tint)", color: "var(--mb-green)", border: "rgba(26,107,60,0.25)" },
  strong: { label: "💪 Strong shield", bg: "var(--mb-green-tint)", color: "var(--mb-green)", border: "rgba(26,107,60,0.25)" },
  buildable: { label: "🔨 Build in 30–45 days", bg: "var(--mb-amber-tint)", color: "var(--mb-amber)", border: "rgba(139,90,0,0.25)" },
  "critical-gap": { label: "🚨 Critical gap", bg: "var(--mb-red-tint)", color: "var(--mb-red)", border: "rgba(174,40,40,0.25)" },
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
        {/* Emotional arc — Affirmation first, then the sting */}
        {c3.hope_bridge && (
          <div style={{ background: "var(--mb-green-tint)", border: "2px solid rgba(26,107,60,0.2)", borderRadius: 14, padding: "14px 18px", marginBottom: 10 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--mb-green)", lineHeight: 1.7, margin: 0 }}>🛡️ {c3.hope_bridge}</p>
          </div>
        )}
        {c3.tough_love && (
          <div style={{ borderLeft: "4px solid var(--mb-amber)", background: "linear-gradient(90deg, var(--mb-amber-tint), transparent)", borderRadius: "0 12px 12px 0", padding: "12px 16px", marginBottom: 10 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.6, margin: 0 }}>⚠️ {c3.tough_love}</p>
          </div>
        )}
        {c3.confrontation && (
          <div style={{ background: "var(--mb-red-tint)", border: "1.5px solid rgba(174,40,40,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-red)", lineHeight: 1.6, margin: 0 }}>⚔️ {c3.confrontation}</p>
          </div>
        )}

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
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 800, color: "var(--mb-ink)" }}>
                {c3.shield_score >= 70 ? "Strong shield" : c3.shield_score >= 50 ? "Growing shield" : "Needs work"}
              </span>
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
        <SectionLabel label="WHAT'S KEEPING YOU EMPLOYED — honest assessment" />
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

        {c3.upgrade_path && (
          <InfoBox variant="navy" title="🎯 This week — one thing" body={c3.upgrade_path} />
        )}

        {/* ── Weekly Survival Diet — read/watch/listen learning plan ──────────────
            Generated by the main scan pipeline (weekly_survival_diet field).
            Injected into cardData by get-model-b-analysis as scan_weekly_diet.
            This is the "YouTube videos, courses, live tools" users expect. */}
        {cardData.scan_weekly_diet && (
          <>
            <SectionLabel label={`THIS WEEK'S LEARNING PLAN — ${(cardData.scan_weekly_diet as any).theme || 'Your skill upgrade'}`} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
              {["read", "watch", "listen"].map((type) => {
                const item = (cardData.scan_weekly_diet as any)[type];
                if (!item?.title) return null;
                const icons: Record<string, string> = { read: "📖", watch: "▶️", listen: "🎧" };
                const colors: Record<string, string> = {
                  read: "var(--mb-navy-tint)",
                  watch: "var(--mb-red-tint)",
                  listen: "var(--mb-teal-tint)",
                };
                const borders: Record<string, string> = {
                  read: "rgba(26,58,107,0.2)",
                  watch: "rgba(174,40,40,0.2)",
                  listen: "rgba(14,102,85,0.2)",
                };
                return (
                  <div key={type} style={{ background: colors[type], border: `1.5px solid ${borders[type]}`, borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: "var(--mb-ink3)", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 4 }}>
                      {icons[type]} {type} · {item.time_commitment || "15 min"}
                    </div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-ink)", marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", lineHeight: 1.6 }}>{item.action}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Judo Strategy — the one AI tool to adopt this week ─────────────────
            Generated by the scan pipeline (judo_strategy field).
            Shows a specific AI tool recommendation for their exact role,
            including how many months of protection it buys. */}
        {cardData.scan_judo && (cardData.scan_judo as any).recommended_tool && (
          <>
            <SectionLabel label="AI JUDO — turn automation into your advantage" />
            <div style={{ background: "var(--mb-amber-tint)", border: "2px solid rgba(139,90,0,0.2)", borderRadius: 14, padding: "18px 20px", marginBottom: 18 }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 800, color: "var(--mb-amber)", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 8 }}>
                🥋 THIS WEEK: Adopt {(cardData.scan_judo as any).recommended_tool}
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--mb-ink)", marginBottom: 8 }}>
                {(cardData.scan_judo as any).pitch}
              </div>
              {(cardData.scan_judo as any).months_gained > 0 && (
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--mb-amber)", fontWeight: 800 }}>
                  +{(cardData.scan_judo as any).months_gained} months of protection
                </div>
              )}
            </div>
          </>
        )}

        <CardNav onBack={onBack} onNext={onNext} />
      </CardBody>
    </CardShell>
  );
}

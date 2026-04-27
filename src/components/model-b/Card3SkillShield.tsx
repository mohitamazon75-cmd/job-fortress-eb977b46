import { useState, lazy, Suspense } from "react";
import { CardShell, CardHead, CardBody, Badge, SectionLabel, CardNav } from "./SharedUI";

// Skill Arbitrage Engine — already-built widget previously only on the dashboard.
// Lazy-loaded so the Shield tab stays fast and only pays the cost when the user
// actually expands the "Find your highest-ROI skill" section.
const SkillArbitrageWidget = lazy(() => import("@/components/dashboard/SkillArbitrageWidget"));

interface Props {
  cardData: any;
  onBack: () => void;
  onNext: () => void;
  onUpgradePlan?: () => void;
  overallScore?: number;
  scanId?: string;
}

export default function Card3SkillShield({ cardData, onBack, onNext, onUpgradePlan, overallScore, scanId }: Props) {
  const c3 = cardData.card3_shield;
  const [showArbitrage, setShowArbitrage] = useState(false);
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
        {c3.fear_hook && (
          <div style={{ background: "var(--mb-red-tint)", border: "1.5px solid rgba(174,40,40,0.18)", borderRadius: 12, padding: "12px 16px", marginBottom: 10 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-red)", lineHeight: 1.6, margin: 0 }}>⚠️ {c3.fear_hook}</p>
          </div>
        )}
        {c3.tough_love && (
          <div style={{ borderLeft: "4px solid var(--mb-amber)", background: "linear-gradient(90deg, var(--mb-amber-tint), transparent)", borderRadius: "0 12px 12px 0", padding: "12px 16px", marginBottom: 10 }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 600, color: "var(--mb-ink2)", fontStyle: "italic", lineHeight: 1.6, margin: 0 }}>{c3.tough_love}</p>
          </div>
        )}
        {c3.confrontation && (
          <div style={{ background: "var(--mb-red-tint)", border: "1.5px solid rgba(174,40,40,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-red)", lineHeight: 1.6, margin: 0 }}>⚔️ {c3.confrontation}</p>
          </div>
        )}

        {/* Shield row */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", padding: 18, background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 14, marginBottom: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 800, color: "var(--mb-ink3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Shield Sub-Score</div>
            <svg width={88} height={88} viewBox="0 0 80 80">
              <circle cx={40} cy={40} r={r} fill="none" stroke="var(--mb-rule)" strokeWidth={8} />
              <circle cx={40} cy={40} r={r} fill="none" stroke="var(--mb-green)" strokeWidth={8} strokeLinecap="round" transform="rotate(-90 40 40)" strokeDasharray={C} strokeDashoffset={greenOffset} />
              <circle cx={40} cy={40} r={r} fill="none" stroke="var(--mb-amber)" strokeWidth={8} strokeLinecap="round" transform="rotate(-90 40 40)" strokeDasharray={`${amberDash} ${C}`} strokeDashoffset={amberOffset} />
              <text x={40} y={36} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 800, fill: "var(--mb-ink)" }}>{c3.shield_score}</text>
              <text x={40} y={52} textAnchor="middle" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, fill: "var(--mb-ink3)" }}>/100</text>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 800, color: "var(--mb-ink)" }}>
                {c3.shield_score >= 70 ? "Strong shield" : c3.shield_score >= 50 ? "Growing shield" : "Needs work"}
              </span>
              {c3.badge_text && (
                <span style={{ fontSize: 12, background: "var(--mb-green-tint)", color: "var(--mb-green)", border: "1.5px solid rgba(26,107,60,0.25)", padding: "3px 12px", borderRadius: 20, fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}>{c3.badge_text}</span>
              )}
            </div>
            {typeof overallScore === "number" && overallScore > 0 && (
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", marginTop: 4, fontWeight: 600 }}>
                One of 4 inputs to your overall Career Safety Score of <strong style={{ color: "var(--mb-navy)" }}>{overallScore}/100</strong>
              </div>
            )}
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.65, marginTop: 6, fontWeight: 500 }}>{c3.shield_body}</div>
            <div
              onClick={onUpgradePlan}
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-navy)", fontWeight: 800, marginTop: 8, cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}
            >See 60-day upgrade plan ↗</div>
          </div>
        </div>

        {/* ── Skills — grouped with counts + stacked bar ───────────────────── */}
        {(() => {
          const skills = c3.skills || [];
          const groups: Array<{ key: string; label: string; emoji: string; color: string; tint: string }> = [
            { key: "best-in-class", label: "Best-in-class", emoji: "🏆", color: "var(--mb-green)", tint: "var(--mb-green-tint)" },
            { key: "strong",        label: "Strong shield",  emoji: "💪", color: "var(--mb-green)", tint: "var(--mb-green-tint)" },
            { key: "buildable",     label: "Buildable in 30–45 days", emoji: "🔨", color: "var(--mb-amber)", tint: "var(--mb-amber-tint)" },
            { key: "critical-gap",  label: "Critical gap",   emoji: "🚨", color: "var(--mb-red)",   tint: "var(--mb-red-tint)" },
          ];
          const counts = groups.map(g => skills.filter((s: any) => s.level === g.key).length);
          const total = Math.max(skills.length, 1);
          const summary = [
            counts[0] + counts[1] > 0 ? `${counts[0] + counts[1]} strength${counts[0]+counts[1] > 1 ? "s" : ""}` : null,
            counts[2] > 0 ? `${counts[2]} to build` : null,
            counts[3] > 0 ? `${counts[3]} gap${counts[3] > 1 ? "s" : ""}` : null,
          ].filter(Boolean).join(" · ");

          return (
            <>
              <SectionLabel label={`YOUR SKILL PORTFOLIO — ${summary || "honest assessment"}`} />
              {/* Stacked progress bar */}
              <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "var(--mb-rule)", marginBottom: 14 }}>
                {groups.map((g, gi) => counts[gi] > 0 && (
                  <div key={g.key} title={`${counts[gi]} ${g.label}`} style={{ width: `${(counts[gi] / total) * 100}%`, background: g.color }} />
                ))}
              </div>
              <div style={{ marginBottom: 18 }}>
                {groups.map((g) => {
                  const items = skills.filter((s: any) => s.level === g.key);
                  if (items.length === 0) return null;
                  return (
                    <div key={g.key} style={{ marginBottom: 10 }}>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: g.color, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{g.emoji} {g.label}</span>
                        <span style={{ background: g.tint, padding: "1px 8px", borderRadius: 10, fontSize: 10 }}>{items.length}</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {items.map((s: any, i: number) => (
                          <span key={i} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--mb-ink)", background: g.tint, border: `1px solid ${g.color}33`, padding: "5px 11px", borderRadius: 8 }}>{s.name}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}

        {/* ── PRESCRIPTION: This week — one thing (HERO) ───────────────────── */}
        {c3.upgrade_path && (
          <div style={{ position: "relative", background: "linear-gradient(135deg, var(--mb-navy-tint) 0%, white 90%)", border: "2px solid var(--mb-navy)", borderRadius: 16, padding: "20px 22px", marginBottom: 18, boxShadow: "0 6px 22px rgba(26,58,107,0.10)" }}>
            <div style={{ position: "absolute", top: -10, left: 18, background: "var(--mb-navy)", color: "white", fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", padding: "3px 10px", borderRadius: 4, textTransform: "uppercase" }}>Prescription · Week of {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.3, marginTop: 6, marginBottom: 8 }}>
              🎯 If you do <em>one</em> thing this week
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--mb-ink)", lineHeight: 1.65, margin: 0 }}>{c3.upgrade_path}</p>
            <div style={{ marginTop: 10, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--mb-navy)", fontWeight: 700, letterSpacing: "0.06em" }}>
              ⏱ ~3–5 hrs total · scoped for your role
            </div>
          </div>
        )}

        {/* ── Weekly Survival Diet — read/watch/listen with LIVE search links ──
            Resources arrive as { title, action, time_commitment } — no URLs.
            We deterministically synthesise live search-links from the title so
            users always have a working "find this →" CTA. No fabrication: we
            never claim to link to a specific page, we link to a search query. */}
        {cardData.scan_weekly_diet && (() => {
          const diet = cardData.scan_weekly_diet as any;
          const userRole = cardData.user?.current_title || "your role";
          const items: Array<{ type: "read" | "watch" | "listen"; data: any }> = ["read", "watch", "listen"]
            .filter((t) => diet[t]?.title)
            .map((t) => ({ type: t as any, data: diet[t] }));
          if (items.length === 0) return null;

          const minutes = items.reduce((sum, it) => {
            const m = String(it.data.time_commitment || "").match(/(\d+)/);
            return sum + (m ? parseInt(m[1], 10) : 15);
          }, 0);

          const meta: Record<string, { icon: string; verb: string; cta: string; color: string; tint: string; border: string; href: (q: string) => string }> = {
            read:   { icon: "📖", verb: "Read",   cta: "Find article",  color: "var(--mb-navy)",  tint: "var(--mb-navy-tint)",  border: "rgba(26,58,107,0.25)",  href: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
            watch:  { icon: "▶️", verb: "Watch",  cta: "Open in YouTube", color: "var(--mb-red)",  tint: "var(--mb-red-tint)",   border: "rgba(174,40,40,0.25)",  href: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
            listen: { icon: "🎧", verb: "Listen", cta: "Find podcast",  color: "var(--mb-teal)", tint: "var(--mb-teal-tint)",  border: "rgba(14,102,85,0.25)",  href: (q) => `https://open.spotify.com/search/${encodeURIComponent(q)}` },
          };

          return (
            <>
              <SectionLabel label={`THIS WEEK'S LEARNING PLAN · ${minutes ? `${minutes} min total` : ""}`} />
              {diet.theme && (
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", marginTop: -8, marginBottom: 12, lineHeight: 1.6, fontStyle: "italic" }}>
                  Curated for <strong style={{ color: "var(--mb-ink)" }}>{userRole}</strong> · theme: {diet.theme}
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                {items.map(({ type, data }, idx) => {
                  const m = meta[type];
                  return (
                    <div key={type} style={{ display: "flex", gap: 14, background: "white", border: `1.5px solid ${m.border}`, borderLeft: `5px solid ${m.color}`, borderRadius: 12, padding: "14px 16px", alignItems: "stretch" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 4, paddingTop: 2, minWidth: 38 }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 800, color: m.color }}>DAY {idx + 1}–{idx + 2}</div>
                        <div style={{ fontSize: 22 }}>{m.icon}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, color: m.color, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>{m.verb}</span>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--mb-ink3)", background: m.tint, padding: "2px 7px", borderRadius: 10, fontWeight: 700 }}>⏱ {data.time_commitment || "15 min"}</span>
                        </div>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "var(--mb-ink)", lineHeight: 1.35, marginBottom: 4 }}>{data.title}</div>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", lineHeight: 1.6, marginBottom: 10 }}>
                          <strong style={{ color: "var(--mb-ink)" }}>You'll be able to:</strong> {data.action}
                        </div>
                        <a href={m.href(data.title)} target="_blank" rel="noopener noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, color: "white", background: m.color, padding: "8px 14px", borderRadius: 8, textDecoration: "none", minHeight: 36 }}>
                          {m.cta} →
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}

        {/* ── Judo Strategy — restyled: months-gained is the headline ─────── */}
        {cardData.scan_judo && (cardData.scan_judo as any).recommended_tool && (() => {
          const judo = cardData.scan_judo as any;
          const tool = judo.recommended_tool;
          const months = judo.months_gained || 0;
          return (
            <>
              <SectionLabel label="AI JUDO · use the wave instead of fighting it" />
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 18, alignItems: "stretch", background: "linear-gradient(135deg, var(--mb-amber-tint) 0%, white 110%)", border: "2px solid var(--mb-amber)", borderRadius: 16, padding: "18px 20px", marginBottom: 18 }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 14px 0 4px", borderRight: "1.5px dashed rgba(139,90,0,0.3)" }}>
                  {months > 0 ? (
                    <>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 38, fontWeight: 900, color: "var(--mb-amber)", lineHeight: 1 }}>+{months}</div>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, color: "var(--mb-amber)", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginTop: 4 }}>months bought</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 32 }}>🥋</div>
                  )}
                </div>
                <div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, color: "var(--mb-amber)", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 6 }}>This week · adopt one tool</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.3, marginBottom: 6 }}>{tool}</div>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.65, margin: 0 }}>{judo.pitch}</p>
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(tool + " getting started tutorial")}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, color: "var(--mb-amber)", textDecoration: "none", borderBottom: "1.5px solid var(--mb-amber)", paddingBottom: 1 }}>
                    Start with the official tutorial →
                  </a>
                </div>
              </div>
            </>
          );
        })()}

        {/* ── Skill Arbitrage Engine ───────────────────────────────────────────
            World-class WTF moment: surfaces the single highest-ROI skill for
            this user (salary uplift, time-to-competency, 90-day learning plan,
            anti-skills). Backed by skill-arbitrage edge fn + live Tavily market
            data. Lazy: nothing loads until the user opts in. */}
        {(() => {
          const c1 = cardData.card1_risk;
          const allSkills = (c3.skills || []).map((s: any) => s.name);
          const moatSkills = (c3.skills || [])
            .filter((s: any) => s.level === "best-in-class" || s.level === "strong")
            .map((s: any) => s.name);
          const deadSkills = (c3.skills || [])
            .filter((s: any) => s.level === "critical-gap")
            .map((s: any) => s.name);
          const syntheticReport: any = {
            role: cardData.user?.current_title || "Professional",
            industry: cardData.user?.industry || "Technology",
            determinism_index: cardData.risk_score || 55,
            moat_score: c3.shield_score || 50,
            all_skills: allSkills,
            moat_skills: moatSkills,
            execution_skills_dead: deadSkills,
            seniority_tier: "PROFESSIONAL",
            metro_tier: cardData.user?.metro_tier || "tier1",
            current_role: cardData.user?.current_title || "Professional",
            country: "IN",
            survivability: { score: 100 - (cardData.risk_score || 55), breakdown: {}, primary_vulnerability: "", peer_percentile_estimate: "" },
            months_remaining: 24,
            doom_clock_months: 24,
            free_advice_1: "",
            free_advice_2: "",
          };

          if (!showArbitrage) {
            return (
              <div style={{ marginTop: 8, marginBottom: 18, padding: "20px 22px", background: "linear-gradient(135deg, var(--mb-navy-tint) 0%, var(--mb-amber-tint) 140%)", border: "2px solid var(--mb-navy-tint2)", borderRadius: 14 }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: "var(--mb-navy)", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 8 }}>
                  ✨ NEW · Skill Arbitrage Engine
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 700, color: "var(--mb-ink)", lineHeight: 1.3, marginBottom: 8 }}>
                  Find the one skill that actually pays off
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.65, marginBottom: 14 }}>
                  Cross-references your exact profile with live India 2025–26 demand, salary uplift data, and time-to-competency to surface the <strong>single</strong> highest-ROI skill for you — plus a 90-day plan and the skills NOT to waste time on.
                </div>
                <button
                  onClick={() => setShowArbitrage(true)}
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 800, color: "white", background: "var(--mb-navy)", border: "none", borderRadius: 12, padding: "12px 22px", cursor: "pointer", minHeight: 44 }}
                >
                  Run my skill arbitrage analysis →
                </button>
              </div>
            );
          }
          return (
            <div style={{ marginTop: 8, marginBottom: 18 }}>
              <Suspense fallback={
                <div style={{ padding: 32, textAlign: "center" as const, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink3)" }}>
                  Loading arbitrage engine…
                </div>
              }>
                <SkillArbitrageWidget report={syntheticReport} scanId={scanId} />
              </Suspense>
            </div>
          );
        })()}

        {/* Methodology stamp — trust footer */}
        <div style={{ marginTop: 4, padding: "10px 14px", background: "var(--mb-paper)", border: "1px dashed var(--mb-rule)", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", lineHeight: 1.6, fontWeight: 500 }}>
          <strong style={{ color: "var(--mb-ink2)", fontWeight: 800, letterSpacing: "0.04em" }}>HOW WE CALCULATED THIS:</strong> Skills extracted from your resume and classified against JobBachao's Skill Threat Intelligence matrix (v2.2) — a live knowledge graph of 800+ skills mapped to automation risk, demand velocity, and salary uplift across India's 2025–26 job market. Months-bought via AI Judo is a directional estimate, not a guarantee.
        </div>

        <CardNav onBack={onBack} onNext={onNext} />
      </CardBody>
    </CardShell>
  );
}

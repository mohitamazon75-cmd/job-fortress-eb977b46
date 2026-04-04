import { useState } from "react";
import { CardShell, CardHead, CardBody, EmotionStrip, SectionLabel, InfoBox, CardNav, Badge, variantColor } from "./SharedUI";

export default function Card4PivotPaths({ cardData, onBack, onNext }: { cardData: any; onBack: () => void; onNext: () => void }) {
  const d = cardData.card4_pivot;
  const [selectedPivot, setSelectedPivot] = useState(0);

  const pivotBg = (c: string) => c === "green" ? "var(--mb-green-tint)" : c === "teal" ? "var(--mb-teal-tint)" : "var(--mb-navy-tint)";

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="04 · Action" variant="navy" /><Badge label="Matched to your resume" variant="navy" /></>}
        title={d.headline}
        sub={d.subline}
      />
      <CardBody>
        {/* FOMO emotional trigger */}
        {d.fear_hook && (
          <div style={{ background: "var(--mb-amber-tint)", border: "2px solid rgba(139,90,0,0.2)", borderRadius: 14, padding: "14px 18px", marginBottom: 10 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-amber)", lineHeight: 1.7, margin: 0 }}>⏳ {d.fear_hook}</p>
          </div>
        )}
        {d.confrontation && (
          <div style={{ borderLeft: "4px solid var(--mb-navy)", background: "linear-gradient(90deg, var(--mb-navy-tint), transparent)", borderRadius: "0 12px 12px 0", padding: "12px 16px", marginBottom: 10 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.6, margin: 0 }}>⚔️ {d.confrontation}</p>
          </div>
        )}
        {d.hope_bridge && (
          <div style={{ background: "var(--mb-green-tint)", border: "1.5px solid rgba(26,107,60,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-green)", lineHeight: 1.6, margin: 0 }}>🚀 {d.hope_bridge}</p>
          </div>
        )}

        {/* Salary arc */}
        <div style={{ display: "flex", background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 14, overflow: "hidden", marginBottom: 18 }}>
          {[
            { val: d.current_band, label: "Current band · India", color: "var(--mb-ink2)", bg: "var(--mb-paper)" },
            { val: d.pivot_year1, label: "Pivot target · Year 1", color: "var(--mb-navy)", bg: "var(--mb-navy-tint)" },
            { val: d.director_band, label: "Director / VP · Year 2–3", color: "var(--mb-green)", bg: "var(--mb-green-tint)" },
          ].map((s, i) => (
            <div key={i} style={{ display: "contents" }}>
              {i > 0 && <div style={{ display: "flex", alignItems: "center", flexShrink: 0, padding: "0 6px", color: "var(--mb-ink3)", fontSize: 16, fontWeight: 800 }}>→</div>}
              <div style={{ flex: 1, padding: "14px 12px", textAlign: "center", background: s.bg }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 800, color: s.color, marginBottom: 3 }}>{s.val}</div>
                <div style={{ fontSize: 11, color: "var(--mb-ink2)", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Pivot cards */}
        {(d.pivots || []).map((p: any, i: number) => {
          const sel = selectedPivot === i;
          const bc = sel ? variantColor(p.color) : "var(--mb-rule)";
          const bg = sel ? pivotBg(p.color) : "var(--mb-paper)";
          const city = (p.location || "all-india").split(",")[0].trim().toLowerCase().replace(/\s+/g, "-");
          const searchUrl = p.search_url || `https://www.naukri.com/jobs-in-${city}?k=${encodeURIComponent(p.role).replace(/%20/g, "+")}`;
          return (
            <div key={i} onClick={() => setSelectedPivot(i)} style={{ background: bg, border: `2px solid ${bc}`, borderRadius: 14, padding: "16px 18px", marginBottom: 10, cursor: "pointer", transition: "border-color 150ms" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 800, color: "var(--mb-ink)" }}>{p.role}</span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 12, whiteSpace: "nowrap", background: pivotBg(p.color), color: variantColor(p.color), fontFamily: "'DM Sans', sans-serif" }}>{p.match_label}</span>
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", fontWeight: 600, marginBottom: 6 }}>{p.salary_range || p.salary} · {p.location}</div>
              <div style={{ height: 4, borderRadius: 2, background: variantColor(p.color), width: `${p.match_pct}%`, marginBottom: 8, transition: "width 0.6s ease" }} />
              {/* FOMO signal */}
              {p.fomo_signal && (
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "var(--mb-amber)", marginBottom: 8, padding: "6px 10px", background: "var(--mb-amber-tint)", borderRadius: 8, border: "1px solid rgba(139,90,0,0.15)" }}>
                  ⚡ {p.fomo_signal}
                </div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <a href={searchUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: 12, fontWeight: 800, padding: "6px 14px", borderRadius: 8, background: "#4A90D9", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 36 }}
                >🔍 Search on Naukri</a>
                <a href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(p.role)}&f_TPR=r604800`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: 12, fontWeight: 800, padding: "6px 14px", borderRadius: 8, background: "#0A66C2", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 36 }}
                >💼 LinkedIn</a>
              </div>
            </div>
          );
        })}

        {/* Pivot explanation */}
        {d.pivot_explanations?.[selectedPivot] && (
          <InfoBox variant="navy" title={d.pivot_explanations[selectedPivot].title} body={d.pivot_explanations[selectedPivot].body} />
        )}

        {/* Negotiation */}
        <div style={{ background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 14, padding: 18, marginBottom: 16 }}>
          <SectionLabel label="💰 Personalised salary negotiation anchor" />
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", lineHeight: 1.7, marginBottom: 14, fontWeight: 500 }}>{d.negotiation?.intro}</div>
          {d.negotiation?.pivot_phrase && (
            <div style={{ background: "var(--mb-navy-tint)", border: "1.5px solid var(--mb-navy-tint2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "var(--mb-navy)", margin: 0, fontStyle: "italic" }}>💬 "{d.negotiation.pivot_phrase}"</p>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { val: d.negotiation?.walk_away, label: "Walk away", color: "var(--mb-red)", highlight: false },
              { val: d.negotiation?.accept, label: "Accept", color: "var(--mb-amber)", highlight: false },
              { val: d.negotiation?.open_with, label: "Open with", color: "var(--mb-green)", highlight: true },
              { val: d.negotiation?.best_case, label: "Best case", color: "var(--mb-navy)", highlight: false },
            ].map((a, i) => (
              <div key={i} style={{ flex: 1, background: a.highlight ? "var(--mb-green-tint)" : "white", border: `1.5px solid ${a.highlight ? "rgba(26,107,60,0.35)" : "var(--mb-rule)"}`, borderRadius: 12, padding: "12px 10px", textAlign: "center", minWidth: 70 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 17, fontWeight: 800, color: a.color }}>{a.val}</div>
                <div style={{ fontSize: 11, color: "var(--mb-ink2)", fontWeight: 700, marginTop: 3, fontFamily: "'DM Sans', sans-serif" }}>{a.label}</div>
              </div>
            ))}
          </div>
        </div>

        {d.community_quote && (
          <div style={{ borderLeft: "3px solid var(--mb-navy)", borderRadius: "0 10px 10px 0", padding: "14px 18px", background: "var(--mb-navy-tint)", marginBottom: 16 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink)", lineHeight: 1.75, fontStyle: "italic", marginBottom: 6, fontWeight: 500 }}>{d.community_quote}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink2)", fontWeight: 700 }}>{d.community_quote_source}</div>
          </div>
        )}

        <CardNav onBack={onBack} onNext={onNext} />
      </CardBody>
    </CardShell>
  );
}

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
        <EmotionStrip bgColor="var(--mb-navy-tint)" borderColor="var(--mb-navy-tint2)" icon="🚀" textColor="var(--mb-navy)" message={d.emotion_message} />

        {/* Salary arc */}
        <div style={{ display: "flex", background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
          {[
            { val: d.current_band, label: "Current band · India", color: "var(--mb-ink3)", bg: "var(--mb-paper)" },
            { val: d.pivot_year1, label: "Pivot target · Year 1", color: "var(--mb-navy)", bg: "var(--mb-navy-tint)" },
            { val: d.director_band, label: "Director / VP · Year 2–3", color: "var(--mb-green)", bg: "var(--mb-green-tint)" },
          ].map((s, i) => (
            <div key={i} style={{ display: "contents" }}>
              {i > 0 && <div style={{ display: "flex", alignItems: "center", flexShrink: 0, padding: "0 4px", color: "var(--mb-ink4)", fontSize: 14 }}>→</div>}
              <div style={{ flex: 1, padding: "12px 10px", textAlign: "center", background: s.bg }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: s.color, marginBottom: 2 }}>{s.val}</div>
                <div style={{ fontSize: 10, color: "var(--mb-ink3)", fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Pivot cards */}
        {(d.pivots || []).map((p: any, i: number) => {
          const sel = selectedPivot === i;
          const bc = sel ? variantColor(p.color) : "var(--mb-rule)";
          const bg = sel ? pivotBg(p.color) : "var(--mb-paper)";
          const city = (p.location || "all-india").split(",")[0].trim().toLowerCase().replace(/\s+/g, "-"); const searchUrl = p.search_url || `https://www.naukri.com/jobs-in-${city}?k=${encodeURIComponent(p.role).replace(/%20/g, "+")}`;
          return (
            <div key={i} onClick={() => setSelectedPivot(i)} style={{ background: bg, border: `1.5px solid ${bc}`, borderRadius: 12, padding: "13px 15px", marginBottom: 8, cursor: "pointer", transition: "border-color 150ms" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--mb-ink)" }}>{p.role}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap", background: pivotBg(p.color), color: variantColor(p.color), fontFamily: "'DM Sans', sans-serif" }}>{p.match_label}</span>
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", fontWeight: 500, marginBottom: 7 }}>{p.salary_range || p.salary} · {p.location}</div>
              <div style={{ height: 2, borderRadius: 1, background: variantColor(p.color), width: `${p.match_pct}%`, marginBottom: 8 }} />
              <div style={{ display: "flex", gap: 5 }}>
                <a
                  href={searchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: 10, fontWeight: 700, padding: "4px 11px", borderRadius: 6, background: "#4A90D9", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
                >🔍 Search on Naukri</a>
                <a
                  href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(p.role)}&f_TPR=r604800`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: 10, fontWeight: 700, padding: "4px 11px", borderRadius: 6, background: "#0A66C2", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
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
        <div style={{ background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <SectionLabel label="Personalised salary negotiation anchor" />
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", lineHeight: 1.65, marginBottom: 12 }}>{d.negotiation?.intro}</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {[
              { val: d.negotiation?.walk_away, label: "Walk away", color: "var(--mb-red)", highlight: false },
              { val: d.negotiation?.accept, label: "Accept", color: "var(--mb-amber)", highlight: false },
              { val: d.negotiation?.open_with, label: "Open with", color: "var(--mb-green)", highlight: true },
              { val: d.negotiation?.best_case, label: "Best case", color: "var(--mb-navy)", highlight: false },
            ].map((a, i) => (
              <div key={i} style={{ flex: 1, background: a.highlight ? "var(--mb-green-tint)" : "white", border: `1px solid ${a.highlight ? "rgba(26,107,60,0.35)" : "var(--mb-rule)"}`, borderRadius: 9, padding: "10px 8px", textAlign: "center", minWidth: 65 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: a.color }}>{a.val}</div>
                <div style={{ fontSize: 9, color: "var(--mb-ink3)", fontWeight: 500, marginTop: 2, letterSpacing: "0.04em", fontFamily: "'DM Sans', sans-serif" }}>{a.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quote */}
        {d.community_quote && (
          <div style={{ borderLeft: "2px solid var(--mb-rule2)", borderRadius: "0 8px 8px 0", padding: "12px 16px", background: "var(--mb-navy-tint)", marginBottom: 14 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink2)", lineHeight: 1.75, fontStyle: "italic", marginBottom: 5 }}>{d.community_quote}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "var(--mb-ink3)", fontWeight: 600 }}>{d.community_quote_source}</div>
          </div>
        )}

        <CardNav onBack={onBack} onNext={onNext} />
      </CardBody>
    </CardShell>
  );
}

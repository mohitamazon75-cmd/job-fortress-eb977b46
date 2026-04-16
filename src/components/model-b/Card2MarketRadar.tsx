import { useState, useEffect } from "react";
import { CardShell, CardHead, CardBody, Badge, LivePill, EmotionStrip, SectionLabel, InfoBox, CardNav, variantColor } from "./SharedUI";
import { supabase } from "@/integrations/supabase/client";

interface LiveMarketData {
  salary_range_lpa?: { min: number; max: number; median: number };
  job_postings_trend?: "growing" | "declining" | "stable";
  posting_change_pct?: number;
  ai_disruption_level?: "LOW" | "MEDIUM" | "HIGH";
  key_findings?: string[];
  top_hiring_companies?: string[];
  in_demand_skills?: string[];
  data_confidence?: string;
}

interface Props {
  cardData: any;
  onBack: () => void;
  onNext: () => void;
}

export default function Card2MarketRadar({ cardData, onBack, onNext }: Props) {
  const c2 = cardData.card2_market;

  // Feature 1: Live market signals — fetched lazily when this card mounts.
  // 30-min DB cache in live-market means no LLM cost on repeat views.
  // Fires post-scan so it never adds to scan latency.
  const [liveMarket, setLiveMarket] = useState<LiveMarketData | null>(null);
  useEffect(() => {
    if (!c2) return;
    const role = cardData.user?.current_title || "";
    const industry = cardData.user?.industry || "";
    if (!role && !industry) return;

    supabase.functions.invoke("live-market", {
      body: { role, industry, metro: "tier1", country: "IN" },
    }).then(({ data }) => {
      if (data?.salary_range_lpa || data?.key_findings?.length) {
        setLiveMarket(data);
      }
    }).catch(() => { /* non-fatal — card shows fine without live data */ });
  }, []);
  if (!c2) return null;

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="02 · Context" variant="amber" /><LivePill /></>}
        title={c2.headline || "Market Radar"}
        sub={c2.subline || ""}
      />
      <CardBody>
        {/* 3-part emotional structure */}
        {c2.fear_hook && (
          <div style={{ background: "var(--mb-red-tint)", border: "2px solid rgba(174,40,40,0.2)", borderRadius: 14, padding: "14px 18px", marginBottom: 10 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-red)", lineHeight: 1.7, margin: 0, whiteSpace: "pre-line" }}>🚨 {c2.fear_hook}</p>
          </div>
        )}
        {c2.confrontation && (
          <div style={{ borderLeft: "4px solid var(--mb-amber)", background: "linear-gradient(90deg, var(--mb-amber-tint), transparent)", borderRadius: "0 12px 12px 0", padding: "12px 16px", marginBottom: 10 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.6, margin: 0 }}>⚔️ {c2.confrontation}</p>
          </div>
        )}
        {c2.hope_bridge && (
          <div style={{ background: "var(--mb-green-tint)", border: "1.5px solid rgba(26,107,60,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-green)", lineHeight: 1.6, margin: 0 }}>✅ {c2.hope_bridge}</p>
          </div>
        )}

        <SectionLabel label="WHAT THEY'RE ACTUALLY PAYING · Your role tier" />

        {(c2.salary_bands || []).map((band: any, i: number) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ color: "var(--mb-ink)" }}>{band.role}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 800, color: variantColor(band.color) }}>{band.range}</span>
            </div>
            <div style={{ height: 6, background: "var(--mb-rule)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: 6, borderRadius: 3, width: `${band.bar_pct}%`, background: variantColor(band.color), transition: "width 0.6s ease" }} />
            </div>
          </div>
        ))}

        <div style={{ marginTop: 18 }}>
          <InfoBox variant="green" title="Your numbers vs. the market" body={c2.key_insight || ""} />
        </div>

        {/* Quote box */}
        <div style={{ borderLeft: "3px solid var(--mb-navy)", borderRadius: "0 10px 10px 0", padding: "14px 18px", background: "var(--mb-navy-tint)", marginBottom: 16 }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink)", lineHeight: 1.75, fontStyle: "italic", marginBottom: 6, fontWeight: 500 }}>{c2.market_quote}</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink2)", fontWeight: 700 }}>{c2.market_quote_source}</div>
        </div>

        {/* ── Live skill threat intel — which AI tools are replacing which skills ──
            Injected from scan_skill_threats (from scan's skill_threat_intel field).
            Shows the current AI tools actively displacing skills in their role. */}
        {Array.isArray(cardData.scan_skill_threats) && (cardData.scan_skill_threats as any[]).length > 0 && (
          <>
            <SectionLabel label="LIVE THREAT SIGNALS — happening now in your role" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {(cardData.scan_skill_threats as any[]).map((threat: any, i: number) => {
                const sevColors: Record<string, { bg: string; color: string; border: string }> = {
                  CRITICAL: { bg: "var(--mb-red-tint)", color: "var(--mb-red)", border: "rgba(174,40,40,0.2)" },
                  HIGH: { bg: "#fff5ec", color: "#c44a1a", border: "rgba(196,74,26,0.2)" },
                  MEDIUM: { bg: "var(--mb-amber-tint)", color: "var(--mb-amber)", border: "rgba(139,90,0,0.2)" },
                  LOW: { bg: "var(--mb-green-tint)", color: "var(--mb-green)", border: "rgba(26,107,60,0.2)" },
                };
                const s = sevColors[threat.severity] || sevColors.MEDIUM;
                return (
                  <div key={i} style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-ink)", marginBottom: 2 }}>
                        {threat.skill} {threat.threat_tool && <span style={{ color: s.color }}>→ {threat.threat_tool}</span>}
                      </div>
                      {threat.defence && (
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", lineHeight: 1.5 }}>✅ {threat.defence}</div>
                      )}
                    </div>
                    {threat.timeline && (
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 800, color: s.color, whiteSpace: "nowrap" as const }}>{threat.timeline}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Feature 1: Live market signals from Tavily — lazy-loaded, 30-min cache */}
        {liveMarket && (
          <>
            <SectionLabel label={`LIVE MARKET SIGNALS — ${new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {liveMarket.salary_range_lpa && (
                <div style={{ background: "var(--mb-green-tint)", border: "1.5px solid rgba(26,107,60,0.2)", borderRadius: 12, padding: "12px 16px" }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 800, color: "var(--mb-green)", marginBottom: 4 }}>💰 LIVE SALARY RANGE — YOUR ROLE</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 800, color: "var(--mb-ink)" }}>
                    ₹{liveMarket.salary_range_lpa.min}–{liveMarket.salary_range_lpa.max}L · median ₹{liveMarket.salary_range_lpa.median}L
                  </div>
                </div>
              )}
              {liveMarket.job_postings_trend && (
                <div style={{ background: liveMarket.job_postings_trend === "growing" ? "var(--mb-green-tint)" : liveMarket.job_postings_trend === "declining" ? "var(--mb-red-tint)" : "var(--mb-amber-tint)", border: "1.5px solid rgba(0,0,0,0.1)", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, color: "var(--mb-ink)" }}>
                    {liveMarket.job_postings_trend === "growing" ? "📈" : liveMarket.job_postings_trend === "declining" ? "📉" : "➡️"} Job postings are {liveMarket.job_postings_trend}
                  </div>
                  {liveMarket.posting_change_pct !== undefined && (
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 800, color: liveMarket.posting_change_pct >= 0 ? "var(--mb-green)" : "var(--mb-red)" }}>
                      {liveMarket.posting_change_pct >= 0 ? "+" : ""}{liveMarket.posting_change_pct}% YoY
                    </span>
                  )}
                </div>
              )}
              {liveMarket.key_findings?.slice(0, 2).map((finding, i) => (
                <div key={i} style={{ background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 10, padding: "10px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--mb-ink2)", lineHeight: 1.6 }}>
                  🔍 {finding}
                </div>
              ))}
              {liveMarket.in_demand_skills && liveMarket.in_demand_skills.length > 0 && (
                <div style={{ background: "var(--mb-navy-tint)", border: "1.5px solid rgba(26,58,107,0.15)", borderRadius: 12, padding: "12px 16px" }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 800, color: "var(--mb-navy)", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>🔥 What employers want right now</div>
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                    {liveMarket.in_demand_skills.slice(0, 5).map((skill, i) => (
                      <span key={i} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "var(--mb-navy)", color: "white" }}>{skill}</span>
                    ))}
                  </div>
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

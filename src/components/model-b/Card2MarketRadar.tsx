import { useState, useEffect, useMemo } from "react";
import { CardShell, CardHead, CardBody, Badge, LivePill, SectionLabel, InfoBox, CardNav, variantColor } from "./SharedUI";
import { supabase } from "@/integrations/supabase/client";
import SalaryFitWidget from "./SalaryFitWidget";
import SectorNewsFeed from "./SectorNewsFeed";
import { decideAttribution } from "./quote-attribution";
import { sanitiseMarketCopy, filterFreshSectorNews } from "@/lib/market-copy-sanitizer";

interface NewsItem {
  headline: string;
  impact?: "positive" | "negative" | "neutral";
  why_it_matters?: string;
  source_domain?: string;
  url?: string;
}

interface LiveMarketData {
  salary_range_lpa?: { min: number; max: number; median: number };
  job_postings_trend?: "growing" | "declining" | "stable";
  posting_change_pct?: number;
  ai_disruption_level?: "LOW" | "MEDIUM" | "HIGH";
  key_findings?: string[];
  top_hiring_companies?: string[];
  in_demand_skills?: string[];
  sector_news?: NewsItem[];
  data_confidence?: string;
}

interface Props {
  cardData: any;
  // Sprint 3 (2026-04-29): both nav handlers optional so this card can be
  // stacked under LiveMarketCard inside the merged "Live Market" tab.
  onBack?: () => void;
  onNext?: () => void;
}

export default function Card2MarketRadar({ cardData, onBack, onNext }: Props) {
  const c2 = cardData.card2_market;

  // Feature 1: Live market signals — fetched lazily when this card mounts.
  // 30-min DB cache in live-market means no LLM cost on repeat views.
  // Fires post-scan so it never adds to scan latency.
  const [liveMarket, setLiveMarket] = useState<LiveMarketData | null>(null);
  const [cohortOutcome, setCohortOutcome] = useState<{
    calibrated: boolean; sample_size?: number; got_interview_rate?: number;
    upskilling_rate?: number; di_bucket_min?: number; di_bucket_max?: number;
    role_category?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!c2) return;
    const role = cardData.user?.current_title || "";
    const industry = cardData.user?.industry || "";
    if (!role && !industry) return;

    const userObj = (cardData as any)?.user || {};
    const metroTier = userObj.metro_tier || "tier1";
    const country = userObj.country || "IN";
    const exp = userObj.years_experience || "";

    supabase.functions.invoke("live-market", {
      body: { role, industry, metroTier, experienceBand: exp, country },
    }).then(({ data }) => {
      if (data?.salary_range_lpa || data?.key_findings?.length || data?.sector_news?.length) {
        setLiveMarket(data);
      }
    }).catch(() => { /* non-fatal — card shows fine without live data */ });

    // Fetch cohort outcome data (calibrated from real scan outcomes)
    const di = (cardData as any)?.risk_score ?? (cardData as any)?.determinism_index;
    if (di) {
      supabase.functions.invoke("get-cohort-outcomes", {
        body: {
          di,
          role: (cardData as any)?.user?.current_title || "",
          industry: (cardData as any)?.user?.industry || "",
        },
      }).then(({ data }) => {
        if (data) setCohortOutcome(data);
      }).catch(() => {}); // non-fatal
    }
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
        {/* HERO: Personalised salary fit — top of card, the answer to "am I paid right?" */}
        <SalaryFitWidget
          role={cardData.user?.current_title || ""}
          industry={cardData.user?.industry || ""}
          city={cardData.user?.location || ""}
          metroTier={cardData.user?.metro_tier || "tier1"}
          yearsExperience={cardData.user?.years_experience || ""}
          country={cardData.user?.country || "IN"}
          userSkills={(cardData.card3_shield?.skills || []).map((s: any) => s?.name).filter(Boolean)}
        />

        {/* ─────────────── Market Pulse — single consolidated emotional strip ───────────────
            Replaces the previous 3 separate full-width banners (fear/confront/hope) which
            duplicated Card 1's pattern poorly. One container, three colored-rule beats —
            keeps the psychological arc, drops the 🚨/⚔️/✅ emoji triple ("AI slop" per audit). */}
        {(c2.fear_hook || c2.tough_love || c2.confrontation || c2.hope_bridge) && (
          <div style={{ background: "white", border: "1.5px solid var(--mb-rule)", borderRadius: 16, padding: "16px 18px", marginBottom: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mb-ink3)", marginBottom: 12 }}>
              Market pulse · what's moving against you, with you
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {c2.fear_hook && (
                <div style={{ borderLeft: "3px solid var(--mb-red)", paddingLeft: 12, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-red)", lineHeight: 1.6, whiteSpace: "pre-line" as const }}>
                  {c2.fear_hook}
                </div>
              )}
              {c2.tough_love && (
                <div style={{ borderLeft: "3px solid var(--mb-amber)", paddingLeft: 12, fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 600, color: "var(--mb-ink2)", fontStyle: "italic" as const, lineHeight: 1.6 }}>
                  {c2.tough_love}
                </div>
              )}
              {c2.confrontation && (
                <div style={{ borderLeft: "3px solid var(--mb-amber)", paddingLeft: 12, fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: "var(--mb-ink)", fontStyle: "italic" as const, lineHeight: 1.6 }}>
                  {c2.confrontation}
                </div>
              )}
              {c2.hope_bridge && (
                <div style={{ borderLeft: "3px solid var(--mb-green)", paddingLeft: 12, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-green)", lineHeight: 1.6 }}>
                  {c2.hope_bridge}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─────────────── LIVE market signals (Tavily) — promoted above static bands ───────────────
            Live data carries credibility; static role-tier bands moved below as reference. */}
        {liveMarket && (liveMarket.salary_range_lpa || liveMarket.job_postings_trend || (liveMarket.key_findings?.length ?? 0) > 0 || (liveMarket.in_demand_skills?.length ?? 0) > 0) && (
          <>
            <SectionLabel label={`Live market signals · ${new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
              {liveMarket.salary_range_lpa && (
                <LiveSalaryBand
                  baseRange={liveMarket.salary_range_lpa}
                  userCity={cardData.user?.location || ""}
                />
              )}
              {liveMarket.job_postings_trend && (() => {
                // Round-5 fix (E, 2026-04-29): "stable +5% YoY" is a contradiction.
                // Override the server's label when the percentage disagrees with it.
                const pct = liveMarket.posting_change_pct;
                let trendLabel = liveMarket.job_postings_trend as string;
                if (typeof pct === "number") {
                  if (pct >= 5) trendLabel = "growing";
                  else if (pct <= -5) trendLabel = "declining";
                  else trendLabel = "stable";
                }
                const tint = trendLabel === "growing" ? "var(--mb-green-tint)" : trendLabel === "declining" ? "var(--mb-red-tint)" : "var(--mb-amber-tint)";
                return (
                  <div style={{ background: tint, border: "1.5px solid rgba(0,0,0,0.1)", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, color: "var(--mb-ink)" }}>
                      Job postings are <strong style={{ fontWeight: 800 }}>{trendLabel}</strong>
                    </div>
                    {pct !== undefined && (
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 800, color: pct >= 0 ? "var(--mb-green)" : "var(--mb-red)" }}>
                        {pct >= 0 ? "+" : ""}{pct}% YoY
                      </span>
                    )}
                  </div>
                );
              })()}
              {liveMarket.key_findings?.slice(0, 2).map((finding, i) => (
                <div key={i} style={{ background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 10, padding: "10px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--mb-ink2)", lineHeight: 1.6 }}>
                  {finding}
                </div>
              ))}
              {liveMarket.in_demand_skills && liveMarket.in_demand_skills.length > 0 && (
                <div style={{ background: "var(--mb-navy-tint)", border: "1.5px solid rgba(26,58,107,0.15)", borderRadius: 12, padding: "12px 16px" }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 800, color: "var(--mb-navy)", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>What employers want right now</div>
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

        {/* T6: Cohort outcome strip — only render once we actually have calibrated data.
            Round-5 fix (I, 2026-04-29): the "calibrating with real outcomes" placeholder
            is permanent at pre-PMF traffic. Hide entirely until n≥30 calibration fires. */}
        {cohortOutcome?.calibrated && (
          <div style={{ background: "var(--mb-green-tint)", border: "1.5px solid rgba(26,107,60,0.2)", borderRadius: 14, padding: "14px 18px", marginBottom: 22 }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 800, color: "var(--mb-green)", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 6 }}>
              Your cohort · real outcomes
            </div>
            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 15, fontWeight: 700, color: "var(--mb-ink)", lineHeight: 1.5 }}>
              Of <strong>{cohortOutcome.sample_size?.toLocaleString()}</strong> professionals with DI {cohortOutcome.di_bucket_min}–{cohortOutcome.di_bucket_max}
              {cohortOutcome.role_category ? ` in ${cohortOutcome.role_category}` : ""}:
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" as const }}>
              {(cohortOutcome.got_interview_rate ?? 0) > 0 && (
                <div style={{ background: "var(--mb-green)", borderRadius: 10, padding: "8px 14px", color: "white", fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700 }}>
                  {Math.round((cohortOutcome.got_interview_rate ?? 0) * 100)}% got interviews
                </div>
              )}
              {(cohortOutcome.upskilling_rate ?? 0) > 0 && (
                <div style={{ background: "var(--mb-navy)", borderRadius: 10, padding: "8px 14px", color: "white", fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700 }}>
                  {Math.round((cohortOutcome.upskilling_rate ?? 0) * 100)}% started upskilling
                </div>
              )}
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "var(--mb-ink3)", marginTop: 8 }}>
              Based on 7-day follow-ups from JobBachao users.
            </div>
          </div>
        )}

        {/* Static role-tier salary bands — capped at 4 (was 6) and demoted below live data. */}
        {(c2.salary_bands || []).length > 0 && (
          <>
            <SectionLabel label="Role-tier reference · how the band moves with seniority" />
            <div style={{ marginBottom: 18 }}>
              {(c2.salary_bands || []).slice(0, 4).map((band: any, i: number) => (
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
            </div>
          </>
        )}

        {c2.key_insight && (
          <InfoBox variant="green" title="What your resume signals to this market">
            <div>{c2.key_insight}</div>
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7, fontStyle: "italic" }}>
              Achievements pulled from your resume. Market figures from NASSCOM/WEF where cited. Salary not used — you didn't share it.
            </div>
          </InfoBox>
        )}

        {/* Sector news feed — dated headlines for user's industry */}
        {liveMarket?.sector_news && liveMarket.sector_news.length > 0 && (
          <SectorNewsFeed items={liveMarket.sector_news} industry={cardData.user?.industry} />
        )}

        {/* Live skill threat intel — capped at 4 to match Card 1's pill discipline */}
        {Array.isArray(cardData.scan_skill_threats) && (cardData.scan_skill_threats as any[]).length > 0 && (
          <>
            <SectionLabel label="Live threat signals · happening now in your role" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {(cardData.scan_skill_threats as any[]).slice(0, 4).map((threat: any, i: number) => {
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
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", lineHeight: 1.5 }}>{threat.defence}</div>
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

        {/* Quote — kept last as a social-proof close.
            Attribution passes through decideAttribution() which whitelists
            credible publishers/firms and quietly drops sources that look
            fabricated (e.g. generic "AI Researcher" with no named entity).
            See quote-attribution.ts for the decision matrix. */}
        {(() => {
          const att = decideAttribution(c2.market_quote, c2.market_quote_source);
          if (!att.showQuote) return null;
          return (
            <div style={{ borderLeft: "3px solid var(--mb-navy)", borderRadius: "0 10px 10px 0", padding: "14px 18px", background: "var(--mb-navy-tint)", marginBottom: 16 }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink)", lineHeight: 1.75, fontStyle: "italic", marginBottom: att.showSource ? 6 : 0, fontWeight: 500 }}>“{c2.market_quote}”</div>
              {att.showSource && (
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink2)", fontWeight: 700 }}>— {att.source}</div>
              )}
            </div>
          );
        })()}

        <CardNav onBack={onBack} onNext={onNext} />
      </CardBody>
    </CardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────
// Live salary band — round-4 fix (Option A, CTO call 2026-04-29):
// Previous TierAwareSalaryBand applied client-side tier multipliers
// (tier1 1.0 / tier2 0.75 / tier3 0.55) that were ungrounded magic
// numbers. Removed entirely — we now show ONLY what the server returned,
// labelled with the user's city. No fabrication, no toggle that pretends
// we have tier-aware salary data we don't have.
// ─────────────────────────────────────────────────────────────────────
function LiveSalaryBand({
  baseRange,
  userCity,
}: {
  baseRange: { min: number; max: number; median: number };
  userCity: string;
}) {
  const { min, max, median } = baseRange;
  const cityLabel = userCity && userCity.length > 0 && userCity.length < 30 ? userCity : null;
  return (
    <div style={{ background: "var(--mb-green-tint)", border: "1.5px solid rgba(26,107,60,0.2)", borderRadius: 12, padding: "12px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 800, color: "var(--mb-green)", letterSpacing: "0.04em" }}>
          💰 LIVE SALARY RANGE
        </div>
        {cityLabel && (
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: "var(--mb-green)", color: "white", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            📍 {cityLabel}
          </span>
        )}
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 800, color: "var(--mb-ink)" }}>
        ₹{min}–{max}L · median ₹{median}L
      </div>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "var(--mb-ink3)", marginTop: 8, lineHeight: 1.5, fontStyle: "italic" }}>
        Live national benchmark from current job postings — your offer depends on company, stage and negotiation.
      </div>
    </div>
  );
}

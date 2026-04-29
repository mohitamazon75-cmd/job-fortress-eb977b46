import { useState, useEffect } from "react";
import { CardShell, CardHead, CardBody, Badge, LivePill, SectionLabel, InfoBox, CardNav, variantColor } from "./SharedUI";
import { supabase } from "@/integrations/supabase/client";
import SalaryFitWidget from "./SalaryFitWidget";
import SectorNewsFeed from "./SectorNewsFeed";
import { decideAttribution } from "./quote-attribution";

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
                <TierAwareSalaryBand
                  baseRange={liveMarket.salary_range_lpa}
                  userMetroTier={cardData.user?.metro_tier || "tier1"}
                  userCity={cardData.user?.location || ""}
                />
              )}
              {liveMarket.job_postings_trend && (
                <div style={{ background: liveMarket.job_postings_trend === "growing" ? "var(--mb-green-tint)" : liveMarket.job_postings_trend === "declining" ? "var(--mb-red-tint)" : "var(--mb-amber-tint)", border: "1.5px solid rgba(0,0,0,0.1)", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, color: "var(--mb-ink)" }}>
                    Job postings are <strong style={{ fontWeight: 800 }}>{liveMarket.job_postings_trend}</strong>
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

        {/* T6: Cohort outcome strip — shows when calibration data exists (n≥30) */}
        {cohortOutcome && (
          <div style={{ background: cohortOutcome.calibrated ? "var(--mb-green-tint)" : "var(--mb-paper)", border: `1.5px solid ${cohortOutcome.calibrated ? "rgba(26,107,60,0.2)" : "var(--mb-rule)"}`, borderRadius: 14, padding: "14px 18px", marginBottom: 22 }}>
            {cohortOutcome.calibrated ? (
              <>
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
              </>
            ) : (
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--mb-ink3)" }}>
                <strong>Calibrating with real outcomes.</strong> As more users with your profile report back, this card will show what % got interviews.
              </div>
            )}
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
          <InfoBox
            variant="green"
            title="What your resume signals to this market"
            body={c2.key_insight}
            footnote="Achievements pulled from your resume. Market figures from NASSCOM/WEF where cited."
          />
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
// P0-5: Tier-aware salary band
// Server returns one base range (already metro-aware on backend), but
// the user has no visible signal that the number reflects THEIR tier.
// Tier-2/3 users seeing Tier-1-shaped numbers feel excluded.
// We surface the user's tier explicitly + let them toggle context.
// Multipliers are standard Indian market approximations applied
// client-side for context only — purely a presentation layer.
// ─────────────────────────────────────────────────────────────────────
type TierKey = "tier1" | "tier2" | "tier3";
const TIER_META: Record<TierKey, { label: string; cities: string; mult: number }> = {
  tier1: { label: "Tier 1", cities: "Bangalore · Mumbai · Delhi NCR · Pune · Hyderabad", mult: 1.0 },
  tier2: { label: "Tier 2", cities: "Jaipur · Indore · Kochi · Coimbatore · Chandigarh", mult: 0.75 },
  tier3: { label: "Tier 3", cities: "Bhopal · Nagpur · Vizag · Lucknow · smaller metros", mult: 0.55 },
};

function normaliseTier(raw: string): TierKey {
  const t = (raw || "").toLowerCase();
  if (t.includes("3") || t === "tier3") return "tier3";
  if (t.includes("2") || t === "tier2") return "tier2";
  return "tier1";
}

function TierAwareSalaryBand({
  baseRange,
  userMetroTier,
  userCity,
}: {
  baseRange: { min: number; max: number; median: number };
  userMetroTier: string;
  userCity: string;
}) {
  // Treat the live server number as the Tier-1 anchor (national benchmark).
  // Then present user's tier first, with toggle to see the others.
  const userTier = normaliseTier(userMetroTier);
  const [activeTier, setActiveTier] = useState<TierKey>(userTier);

  const meta = TIER_META[activeTier];
  const min = Math.round(baseRange.min * meta.mult * 10) / 10;
  const max = Math.round(baseRange.max * meta.mult * 10) / 10;
  const median = Math.round(baseRange.median * meta.mult * 10) / 10;
  const isUserTier = activeTier === userTier;

  return (
    <div style={{ background: "var(--mb-green-tint)", border: "1.5px solid rgba(26,107,60,0.2)", borderRadius: 12, padding: "12px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 800, color: "var(--mb-green)", letterSpacing: "0.04em" }}>
          💰 LIVE SALARY RANGE — {isUserTier ? "YOUR TIER" : meta.label.toUpperCase()}
        </div>
        {isUserTier && userCity && (
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: "var(--mb-green)", color: "white", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            📍 {userCity}
          </span>
        )}
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 800, color: "var(--mb-ink)" }}>
        ₹{min}–{max}L · median ₹{median}L
      </div>

      {/* Tier toggle — lets users sanity-check across city tiers */}
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {(Object.keys(TIER_META) as TierKey[]).map((t) => {
          const isActive = t === activeTier;
          const isUser = t === userTier;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTier(t)}
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 11,
                fontWeight: 800,
                padding: "5px 10px",
                borderRadius: 8,
                border: `1.5px solid ${isActive ? "var(--mb-green)" : "var(--mb-rule)"}`,
                background: isActive ? "var(--mb-green)" : "white",
                color: isActive ? "white" : "var(--mb-ink2)",
                cursor: "pointer",
                letterSpacing: "0.04em",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                transition: "all 150ms ease",
              }}
            >
              {TIER_META[t].label}
              {isUser && (
                <span style={{ fontSize: 9, opacity: isActive ? 1 : 0.7 }}>· you</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "var(--mb-ink3)", marginTop: 8, lineHeight: 1.5 }}>
        {meta.cities}
        <br />
        <span style={{ fontStyle: "italic" }}>
          Tier multipliers reflect typical Indian market spreads — your actual offer depends on company, stage and negotiation.
        </span>
      </div>
    </div>
  );
}

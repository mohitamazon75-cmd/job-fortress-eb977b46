// useState removed — scan count is now a prop from ResultsModelB
import { useEffect, useRef } from "react";
import { CardShell, CardHead, CardBody, Badge, SectionLabel, InfoBox, CardNav, variantColor } from "./SharedUI";
import BossPerceptionSimulator from "./BossPerceptionSimulator";
import CopyKeywordsButton from "./CopyKeywordsButton";
import { useTrack } from "@/hooks/use-track";
import { personalizeCard1 } from "@/lib/card1-personalization";

// Module-level dedup for analytics: ensures `card1_headline_source` fires
// once per scan_id even when Card1 unmounts/remounts during card navigation.
// Resets on full page reload (correct boundary — new view of the report).
const firedHeadlineEvents = new Set<string>();

interface Props {
  cardData: any;
  onNext: () => void;
  /** Optional. Currently unused (Card1 is first content card after Verdict);
   *  added for nav consistency with Card2+ in case the deck order changes. */
  onBack?: () => void;
  /** Monthly scan count for social proof. Fetched once by ResultsModelB and passed down. */
  monthlyScanCount?: number | null;
  /** Estimated monthly salary in INR (from scans table) for rupee-anchored cost framing. */
  monthlySalaryInr?: number | null;
  /** Reveal-side first name for personalized copy-paste artifacts. */
  firstName?: string | null;
}

/**
 * Format a paise/rupee monthly figure into an annualised "₹X.XL" string.
 * Used to convert abstract percentage gaps into concrete loss-aversion anchors
 * for the Indian middle-class reader.
 */
export function formatAnnualLakhs(monthlyInr: number): string {
  const annual = monthlyInr * 12;
  if (annual >= 10000000) return `₹${(annual / 10000000).toFixed(1)}Cr`;
  if (annual >= 100000) {
    const lakhs = annual / 100000;
    return lakhs >= 10 ? `₹${Math.round(lakhs)}L` : `₹${lakhs.toFixed(1)}L`;
  }
  return `₹${Math.round(annual / 1000)}k`;
}

/**
 * Parse a string like "15-20%" or "15%" into [low, high] decimals (0.15, 0.20).
 * Returns null if the string can't be confidently parsed.
 * Exported for unit testing — see src/test/card1-risk-helpers.test.ts.
 */
export function parsePctRange(s: string | undefined | null): [number, number] | null {
  if (!s) return null;
  const matches = s.match(/(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*%/i);
  if (matches) return [parseFloat(matches[1]) / 100, parseFloat(matches[2]) / 100];
  const single = s.match(/(\d+(?:\.\d+)?)\s*%/);
  if (single) {
    const v = parseFloat(single[1]) / 100;
    return [v, v];
  }
  return null;
}

/**
 * Parse an Indian salary band string (e.g. "₹18-28L", "₹50-90L", "₹1.2-1.8Cr",
 * "₹35L", "18-28 LPA") into the median annual rupee figure.
 * Returns null if no confident parse — caller falls back to LLM string.
 *
 * This is the component-layer fallback that powers rupee anchoring when the
 * scan record's `estimated_monthly_salary_inr` column is null (current state
 * for all 5 prod scans as of 2026-04-27 — the upstream pipeline does not
 * populate that column yet). We derive a credible monthly figure from the
 * LLM's already-grounded `card2_market.salary_bands` matched to the user's
 * current_title — same numbers the user sees one card later, so there's
 * zero credibility risk from a number mismatch.
 */
export function parseBandToAnnualInr(range: string | undefined | null): number | null {
  if (!range) return null;
  const isCrore = /Cr/i.test(range);
  const isLakh = !isCrore && /(L|LPA|lakh)/i.test(range);
  if (!isCrore && !isLakh) return null;
  const nums = range.match(/(\d+(?:\.\d+)?)/g);
  if (!nums || nums.length === 0) return null;
  const lo = parseFloat(nums[0]);
  const hi = nums.length > 1 ? parseFloat(nums[1]) : lo;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  const median = (lo + hi) / 2;
  const unit = isCrore ? 10_000_000 : 100_000; // 1Cr = 1e7, 1L = 1e5
  const annual = median * unit;
  return annual > 0 ? annual : null;
}

/**
 * Derive monthly salary in INR from the LLM-returned salary_bands array,
 * preferring the band whose `role` best matches the user's current_title.
 * Falls back to the median band if no match. Returns null if bands are absent
 * or unparseable.
 */
export function deriveMonthlyFromBands(
  bands: Array<{ role?: string; range?: string }> | undefined | null,
  currentTitle: string | undefined | null,
): number | null {
  if (!Array.isArray(bands) || bands.length === 0) return null;
  const title = (currentTitle || "").toLowerCase().trim();

  // Prefer exact-substring role match (e.g. user "Marketing Manager" → band "Marketing Manager").
  let chosen: { role?: string; range?: string } | undefined;
  if (title) {
    chosen = bands.find((b) => {
      const r = (b?.role || "").toLowerCase();
      if (!r) return false;
      // Match if either string contains a meaningful chunk of the other.
      return r.includes(title) || (title.length >= 4 && title.includes(r.slice(0, Math.min(r.length, 20))));
    });
  }
  // Fallback: middle band (LLM is instructed to put aspirational first; middle ≈ "your level").
  if (!chosen) chosen = bands[Math.floor(bands.length / 2)];

  const annual = parseBandToAnnualInr(chosen?.range);
  if (!annual) return null;
  return Math.round(annual / 12);
}

export default function Card1RiskMirror({ cardData, onNext, onBack, monthlyScanCount, monthlySalaryInr, firstName }: Props) {
  const c1 = cardData.card1_risk;
  const u = cardData.user || {};
  const academicExposure = cardData?.academic_exposure;
  const disruptionYear = c1?.disruption_year || "2027";

  // P-3-B: scan count is now fetched once by ResultsModelB and passed as a prop,
  // avoiding a redundant DB query every time this card renders.
  const scanCount = monthlyScanCount ?? null;

  // ─── Hooks MUST run before any early return (rules-of-hooks). The effect
  // body itself guards against missing data so we don't fire telemetry for
  // empty cards. We use a ref so the effect re-reads the latest computed
  // payload without re-firing on every render.
  const { track } = useTrack(cardData?.scan_id);
  const headlineTelemetryRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const sid = cardData?.scan_id;
    if (!sid) return;
    if (firedHeadlineEvents.has(sid)) return;
    const fire = headlineTelemetryRef.current;
    if (!fire) return;
    firedHeadlineEvents.add(sid);
    fire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardData?.scan_id]);

  if (!c1) return null;

  const r = 36;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - (c1.risk_score || 0) / 100);

  const gaugeColor = (c1.risk_score || 0) >= 70 ? "var(--mb-red)" : (c1.risk_score || 0) >= 40 ? "var(--mb-amber)" : "var(--mb-green)";

  const avatars = [
    { initials: "PK", bg: "var(--mb-navy-tint)", color: "var(--mb-navy)" },
    { initials: "SR", bg: "var(--mb-green-tint)", color: "var(--mb-green)" },
    { initials: "AM", bg: "var(--mb-amber-tint)", color: "var(--mb-amber)" },
    { initials: "NK", bg: "var(--mb-red-tint)", color: "var(--mb-red)" },
    { initials: "VR", bg: "var(--mb-teal-tint)", color: "var(--mb-teal)" },
  ];

  const cost = c1.cost_of_inaction;

  // Build the rupee-anchored cost sentence.
  // Source-of-truth priority for monthly salary, in order:
  //   1. monthlySalaryInr prop (from scans.estimated_monthly_salary_inr) — best.
  //   2. Median of LLM's card2_market.salary_bands matched to user.current_title.
  //      This is the same band the user sees on Card 2 → consistent narrative.
  //   3. Raw monthly_loss_lpa string from LLM (legacy free-form).
  // We never fabricate; if all three fail the line is suppressed cleanly.
  const derivedMonthly = deriveMonthlyFromBands(
    cardData?.card2_market?.salary_bands,
    u.current_title || u.role,
  );
  const monthlyForCalc = (monthlySalaryInr && monthlySalaryInr > 0) ? monthlySalaryInr : derivedMonthly;

  let rupeeCostLine: string | null = null;
  if (cost) {
    const range = parsePctRange(cost.annual_gap_pct);
    if (range && monthlyForCalc && monthlyForCalc > 0) {
      const annualSalary = monthlyForCalc * 12;
      const lo = formatAnnualLakhs((annualSalary * range[0]) / 12);
      const hi = formatAnnualLakhs((annualSalary * range[1]) / 12);
      rupeeCostLine = lo === hi
        ? `At your level, that's roughly ${lo}/year you don't get back.`
        : `At your level, that's roughly ${lo}–${hi}/year you don't get back.`;
    } else if (cost.monthly_loss_lpa) {
      // Pivot Coherence Pass — Bug 4 fix (2026-04-30):
      // The legacy free-form fallback string can carry an absolute ₹ figure
      // (e.g. "₹3-5L") that we cannot anchor without a user CTC. Showing it
      // as "earning power slipping past you" makes the user believe it's
      // their personal number. Suppress when (a) we have no user-anchored
      // monthly AND (b) the string contains a rupee/lakh figure. Percent-only
      // strings ("5-8% earning power") still render — they're honest.
      const lossStr = String(cost.monthly_loss_lpa);
      const hasRupeeFigure = /(₹\s*\d|\d+\s*(?:L|lakh|lakhs|cr|crore)\b)/i.test(lossStr);
      const hasAnchor = (monthlySalaryInr && monthlySalaryInr > 0) || (derivedMonthly && derivedMonthly > 0);
      if (!hasRupeeFigure || hasAnchor) {
        rupeeCostLine = `At your level, that's roughly ${lossStr} of earning power slipping past you each year.`;
      }
    }
  }

  const roleForSim = u.current_title || u.role || c1.role || "your role";

  // ─── Batch F (final): stake-amplifier strip under LLM headline ────────
  // The LLM-generated headline (rendered in CardHead) is already a strong
  // personalized verdict like "Your GTM architecture is safe; your
  // execution isn't." We don't replace it — we *amplify* it with a short
  // stake line that fuses the score + band into a single emotional beat,
  // sitting immediately under the headline and BEFORE the clinical gauge.
  //
  // Audit guardrails:
  //   • No naive plural ({title}s) — broken on "VP of Sales", "Head of X".
  //   • No task name from tasks_at_risk — pills below already render those.
  //   • Tone "indicative not absolute" per
  //     mem://style/tone-and-liability-calibration.
  //   • Renders only when score is a real number — otherwise suppressed.
  const score = c1.risk_score;
  const hasValidScore = typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100;

  let stakeLine: { kicker: string; bigNumber: string; line: string; tone: "red" | "amber" | "green" } | null = null;
  if (hasValidScore) {
    if (score >= 70) {
      stakeLine = {
        kicker: "What this actually means",
        bigNumber: `${score}%`,
        tone: "red",
        line: `of your daily execution is already machine-native. The window to reposition is closing — fast. The pills below show where it's bleeding first.`,
      };
    } else if (score >= 40) {
      stakeLine = {
        kicker: "What this actually means",
        bigNumber: `${score}%`,
        tone: "amber",
        line: `of your daily work is already automated or assisted by tools your peers are using. The strategy layer is still yours; the execution layer is borrowed time.`,
      };
    } else {
      stakeLine = {
        kicker: "What this actually means",
        bigNumber: `${score}%`,
        tone: "green",
        line: `of your daily output is automatable today — you sit in AI's blind spot. The moat holds. Your job is to keep it that way.`,
      };
    }
  }

  const stakeBg = stakeLine?.tone === "red" ? "var(--mb-red-tint)"
    : stakeLine?.tone === "amber" ? "var(--mb-amber-tint)"
    : "var(--mb-green-tint)";
  const stakeBorder = stakeLine?.tone === "red" ? "rgba(174,40,40,0.28)"
    : stakeLine?.tone === "amber" ? "rgba(196,142,30,0.30)"
    : "rgba(26,107,60,0.28)";
  const stakeAccent = stakeLine?.tone === "red" ? "var(--mb-red)"
    : stakeLine?.tone === "amber" ? "var(--mb-amber)"
    : "var(--mb-green)";

  // ─── Headline + peer-comparator personalization.
  // All the role-family routing, tenure/fresher logic, copy tables, and
  // peer-fallback strings live in src/lib/card1-personalization.ts. Card1
  // stays focused on rendering; the lib is unit-tested in isolation.
  const titleClean = (u.current_title || u.role || c1.role || "your role").replace(/\s+/g, " ").trim();
  const sector = (u.industry || "").trim();
  const personalization = personalizeCard1({
    llmHeadline: (c1.headline || "").trim(),
    llmSubline: (c1.subline || "").trim(),
    titleClean,
    sector,
    yrsRaw: u.years_experience ?? u.years ?? u.experience,
    score,
    hasValidScore,
    indiaAverageMissing: c1.india_average == null,
  });
  const { family, band, isFresher, isWeak, isSpecific, copyConfidence,
          displayHeadline, displaySubline, peerFallback } = personalization;

  // ─── Observability: track which copy path won (LLM vs template).
  // Operator queries `behavior_events` to decide when prompt quality is
  // good enough to retire the templates. Silent on failure. Dedup is
  // *per scan_id* (module-level Set) — not per-mount — because Card1
  // unmounts/remounts on every nav. A useRef would re-fire on each
  // remount and over-count by 3-5x. Set survives remounts; resets on
  // full page reload, which IS a new "view" of the report.
  // Effect lives at top of component (before early-return) for rules-of-hooks
  // — we just provide the closure here once values are computed.
  headlineTelemetryRef.current = () => {
    if (!hasValidScore) return;
    track("card1_headline_source", {
      source: isWeak ? "template" : "llm",
      family,
      band,
      score,
      llm_headline_len: (c1.headline || "").trim().length,
      llm_was_specific: isSpecific,
      peer_fallback_used: c1.india_average == null,
      sector: sector || null,
      is_fresher: isFresher,
      copy_confidence: copyConfidence,
    });
  };

  return (
    <CardShell>
      <CardHead
        badges={
          <>
            <Badge label="01 · Awareness" variant="amber" />
            <Badge label="Resume analysed" variant="navy" />
            {/* Pass C1 (#4) — KG match badge. Suppressed when matches are too
                weak to claim moat (LOW = <40%). Empty-fallback over fake-confident. */}
            {cardData?.kg_match && cardData.kg_match.confidence_label !== 'LOW' && (
              <Badge
                label={`KG match · ${cardData.kg_match.matched_count}/${cardData.kg_match.total_count} skills (${cardData.kg_match.pct}%)`}
                variant={cardData.kg_match.confidence_label === 'HIGH' ? 'green' : 'navy'}
              />
            )}
            {academicExposure?.kind === "mapped" && (
              <Badge
                label={academicExposure.converged ? "Cross-validated academic exposure" : "Academic exposure mapped"}
                variant={academicExposure.risk_tier === "HIGH" ? "red" : academicExposure.risk_tier === "MEDIUM" ? "amber" : "green"}
              />
            )}
          </>
        }
        title={displayHeadline}
        sub={displaySubline}
      />
      <CardBody>
        {/* Batch F (final): Stake-amplifier strip under LLM headline */}
        {stakeLine && (
          <div style={{ display: "flex", alignItems: "stretch", gap: 14, background: stakeBg, border: `2px solid ${stakeBorder}`, borderLeft: `5px solid ${stakeAccent}`, borderRadius: 14, padding: "14px 18px", marginBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minWidth: 78, paddingRight: 14, borderRight: `1.5px dashed ${stakeBorder}` }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 30, fontWeight: 800, color: stakeAccent, lineHeight: 1, letterSpacing: "-0.02em" }}>
                {stakeLine.bigNumber}
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: stakeAccent, marginTop: 4 }}>
                AI exposure
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: stakeAccent, marginBottom: 6 }}>
                {stakeLine.kicker}
              </div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--mb-ink)", lineHeight: 1.55, margin: 0 }}>
                {stakeLine.line}
              </p>
            </div>
          </div>
        )}

        {/* AI Exposure gauge - peer benchmark only (score moved up to stake strip) */}
        <div style={{ padding: "4px 14px 6px" }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mb-ink3)" }}>
            The evidence - how you compare
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center", padding: 20, background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 16, marginBottom: 8, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          {/* Gauge ring - score is small/secondary now (the big number lives in the stake strip above) */}
          <svg width={88} height={88} viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={r} fill="none" stroke="var(--mb-rule)" strokeWidth={9} />
            <circle cx={50} cy={50} r={r} fill="none" stroke={gaugeColor} strokeWidth={9} strokeLinecap="round" transform="rotate(-90 50 50)" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.8s ease" }} />
            <text x={50} y={48} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 800, fill: gaugeColor }}>{c1.risk_score}<tspan style={{ fontSize: 10, fontWeight: 700 }}>%</tspan></text>
            <text x={50} y={68} textAnchor="middle" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 800, fill: "var(--mb-ink3)", textTransform: "uppercase", letterSpacing: "0.14em" }}>YOU</text>
          </svg>
          <div style={{ flex: 1 }}>
            {c1.india_average != null ? (
              <>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.6, fontWeight: 500, marginBottom: 6 }}>
                  India average for this role: <strong style={{ fontWeight: 800, color: "var(--mb-ink)" }}>{c1.india_average}%</strong>
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.6, fontWeight: 500 }}>
                  You're <strong style={{ fontWeight: 800, color: (c1.risk_score || 0) > c1.india_average ? "var(--mb-red)" : "var(--mb-green)" }}>{Math.abs((c1.risk_score || 0) - c1.india_average)} points {(c1.risk_score || 0) > c1.india_average ? "above" : "below"}</strong> the average.
                </div>
              </>
            ) : peerFallback ? (
              <>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.55, fontWeight: 700, marginBottom: 6 }}>
                  {peerFallback.label}
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", lineHeight: 1.6, fontWeight: 500 }}>
                  {peerFallback.detail}
                </div>
              </>
            ) : (
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink3)", lineHeight: 1.6, fontStyle: "italic" }}>
                Peer benchmark unavailable for this role.
              </div>
            )}
          </div>
        </div>
        {/* Demoted disambiguation footnote — below gauge, small, no longer blocks the punch */}
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", marginBottom: 18, paddingLeft: 4, fontStyle: "italic" }}>
          Different from your overall JobBachao score (top of page) — this measures only automation risk for your role, not your full career safety.
        </div>

        {/* STEP 3 — KG match badge: renders existing kg_match payload from
            get-model-b-analysis. Hidden entirely if absent (no placeholder). */}
        {cardData?.kg_match && (
          <div
            className={
              cardData.kg_match.confidence_label === 'HIGH'
                ? 'inline-flex items-center gap-2 rounded-full border border-[hsl(var(--prophet-green))] bg-[hsl(var(--prophet-green)/0.1)] px-3 py-1 text-xs font-semibold text-[hsl(var(--prophet-green))] mb-4'
                : cardData.kg_match.confidence_label === 'MEDIUM'
                ? 'inline-flex items-center gap-2 rounded-full border border-[hsl(var(--prophet-gold))] bg-[hsl(var(--prophet-gold)/0.1)] px-3 py-1 text-xs font-semibold text-[hsl(var(--prophet-gold))] mb-4'
                : 'inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground mb-4'
            }
          >
            {cardData.kg_match.confidence_label === 'LOW'
              ? `Skill-level peer match unavailable for this role — score reflects role-level norms`
              : `Matched ${cardData.kg_match.matched_count}/${cardData.kg_match.total_count} of your skills · confidence ${cardData.kg_match.confidence_label}`}
          </div>
        )}

        {academicExposure && academicExposure.kind === "mapped" && (
          <div style={{ background: "var(--mb-navy-tint)", border: "1.5px solid var(--mb-navy-tint2)", borderRadius: 12, padding: "13px 16px", marginBottom: 18 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mb-navy)", marginBottom: 6 }}>
              Academic exposure check
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", lineHeight: 1.65, margin: 0, fontWeight: 600 }}>
              Atlas maps this KG role to <strong style={{ color: "var(--mb-ink)", fontWeight: 800 }}>{academicExposure.risk_tier}</strong> AI exposure across {academicExposure.source_count} academic source{academicExposure.source_count === 1 ? "" : "s"}. Matched occupation: {academicExposure.occupations?.[0]?.atlas_title || "occupation mapped"}.
            </p>
          </div>
        )}

        {/* ─────────────── 2. Fear → Anxiety → Hope → Plan narration arc ──────────
            Restored 2026-04-27 after audit found the trio (tough_love /
            hope_bridge / confrontation) had been silently dropped from
            Card1, weakening the emotional impact users explicitly missed.
            Data has always flowed from the LLM (see prompt at
            get-model-b-analysis/index.ts:968-972) — only the rendering
            was missing. Rendered in the exact emotional-arc order from
            mem://ux/emotional-arc:
              fear_hook   → Fear   (the dated threat)
              tough_love  → Anxiety (the cold reframe)
              hope_bridge → Hope    (the named asset)
              confrontation → Plan  (this week's action)
            All blocks render only when the LLM provides them — no
            fabrication, no fallbacks. Tone respects mem://style/
            tone-and-liability-calibration: indicative, not absolute.
        ─────────────────────────────────────────────────────────────────────── */}
        {c1.fear_hook && (
          <div style={{ background: "var(--mb-red-tint)", border: "2px solid rgba(174,40,40,0.2)", borderRadius: 14, padding: "16px 18px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>🚨</span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mb-red)" }}>
                {`THE ${disruptionYear} PROBLEM`}
              </span>
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--mb-red)", lineHeight: 1.7, margin: 0, whiteSpace: "pre-line" }}>{c1.fear_hook}</p>
          </div>
        )}

        {/* tough_love — the cold reframe (Playfair italic, amber) */}
        {c1.tough_love && (
          <div style={{ background: "var(--mb-amber-tint)", border: "1.5px solid rgba(139,90,0,0.22)", borderRadius: 12, padding: "14px 18px", marginBottom: 12 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mb-amber)", marginBottom: 6 }}>
              The honest reframe
            </div>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "var(--mb-ink)", lineHeight: 1.55, margin: 0, fontStyle: "italic" }}>
              {c1.tough_love}
            </p>
          </div>
        )}

        {/* hope_bridge — the named, defensible asset (green) */}
        {c1.hope_bridge && (
          <div style={{ background: "var(--mb-green-tint)", border: "1.5px solid rgba(26,107,60,0.22)", borderRadius: 12, padding: "14px 18px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>🛡️</span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mb-green)" }}>
                What still belongs to you
              </span>
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--mb-ink)", lineHeight: 1.6, margin: 0 }}>
              {c1.hope_bridge}
            </p>
          </div>
        )}

        {/* confrontation — the plan (left-accent banner, calmer than old "DIRECT CHALLENGE") */}
        {c1.confrontation && (
          <div style={{ borderLeft: "4px solid var(--mb-ink)", background: "linear-gradient(90deg, rgba(0,0,0,0.04), transparent)", borderRadius: "0 12px 12px 0", padding: "14px 18px", marginBottom: 18 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mb-ink)", marginBottom: 6 }}>
              Your move this week
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--mb-ink)", lineHeight: 1.6, margin: 0 }}>
              {c1.confrontation}
            </p>
          </div>
        )}

        {/* ─────────────── 3. Boss Perception Simulator ─────────────── */}
        <BossPerceptionSimulator
          role={roleForSim}
          years={u.years_experience || u.years || u.experience}
          riskScore={c1.risk_score || 0}
          tasksAtRisk={c1.tasks_at_risk}
          industry={u.industry}
        />

        {/* ─────────────── 4. Cost of standing still — single rupee-anchored line ─────────────── */}
        {(rupeeCostLine || cost?.decay_narrative) && (
          <>
            <SectionLabel label="The cost of standing still" />
            <div style={{ borderLeft: "4px solid var(--mb-red)", background: "linear-gradient(90deg, var(--mb-red-tint), transparent)", padding: "14px 18px", borderRadius: "0 12px 12px 0", marginBottom: 8 }}>
              {rupeeCostLine && (
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.6, margin: 0 }}>
                  {rupeeCostLine}
                </p>
              )}
              {cost?.decay_narrative && (
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "var(--mb-ink2)", lineHeight: 1.7, margin: rupeeCostLine ? "8px 0 0 0" : 0 }}>
                  {cost.decay_narrative}
                </p>
              )}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", marginBottom: 22, paddingLeft: 4 }}>
              Source: NASSCOM AI Talent Report 2024 + Naukri JobSpeak appraisal compression data for repositioned vs static profiles.
            </div>
          </>
        )}

        {/* ─────────────── 5. What's changing — tasks + ATS + India signal ─────────────── */}

        {/* ATS Section — only renders when scoring pipeline has populated real JD matches */}
        {c1.ats_scores != null && c1.ats_scores.length > 0 && (
          <>
            <SectionLabel label="ATS resume match · 3 target India JDs right now" />
            <div style={{ background: "white", border: "1.5px solid var(--mb-rule)", borderRadius: 16, overflow: "hidden", marginBottom: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1.5px solid var(--mb-rule)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 800, color: "var(--mb-ink)" }}>ATS Resume Match · 3 Target India JDs</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, fontWeight: 800, color: "var(--mb-amber)" }}>{cardData.ats_avg || c1.ats_scores?.[0]?.score || 60}%<span style={{ fontSize: 13, fontWeight: 600, color: "var(--mb-ink3)", marginLeft: 4 }}>avg</span></span>
              </div>
              <div style={{ padding: "18px 20px" }}>
                {(c1.ats_scores || []).map((s: any, i: number) => {
                  const city = (s.city || "all-india").toLowerCase().replace(/\s+/g, "-");
                  const searchUrl = s.search_url || `https://www.naukri.com/jobs-in-${city}?k=${encodeURIComponent(`${s.role} ${s.company}`).replace(/%20/g, "+")}`;
                  return (
                    <div key={i} style={{ marginBottom: i < (c1.ats_scores?.length || 0) - 1 ? 16 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                        <a href={searchUrl} target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, fontSize: 14, color: "var(--mb-navy)", fontWeight: 700, lineHeight: 1.3, fontFamily: "'DM Sans', sans-serif", textDecoration: "none", borderBottom: "1.5px dashed var(--mb-navy-tint2)" }}
                          title={`Search ${s.company} · ${s.role} on Naukri`}
                        >
                          {s.company} · {s.role} ↗
                        </a>
                        <div style={{ width: 90, height: 5, background: "var(--mb-rule)", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
                          <div style={{ height: 5, background: variantColor(s.color), width: `${s.score}%`, borderRadius: 3, transition: "width 0.6s ease" }} />
                        </div>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 800, minWidth: 40, textAlign: "right", color: variantColor(s.color) }}>{s.score}%</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, paddingLeft: 2 }}>
                        <a href={searchUrl} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, fontWeight: 800, padding: "5px 14px", borderRadius: 8, background: "#4A90D9", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32 }}
                        >🔍 Naukri</a>
                        <a href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(`${s.role} ${s.company}`)}&f_TPR=r604800`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, fontWeight: 800, padding: "5px 14px", borderRadius: 8, background: "#0A66C2", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32 }}
                        >💼 LinkedIn</a>
                      </div>
                    </div>
                  );
                })}
                {c1.ats_missing_keywords?.length > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1.5px solid var(--mb-rule)", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                    <span style={{ fontWeight: 800, color: "var(--mb-ink)" }}>⚠️ Missing keywords: </span>
                    {c1.ats_missing_keywords.map((kw: string, i: number) => (
                      <span key={i}><strong style={{ color: "var(--mb-red)", fontWeight: 800 }}>{kw}</strong>{i < c1.ats_missing_keywords.length - 1 ? " · " : ""}</span>
                    ))}
                    <div>
                      <CopyKeywordsButton keywords={c1.ats_missing_keywords} firstName={firstName} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Tasks at risk / safe — capped at 3+3 to avoid pill-soup overload.
            LLM emits exactly 5 each; we surface the 3 highest-priority and
            note the rest in a quiet caption. The full list lives in card3_shield. */}
        <SectionLabel label="What AI is replacing in your role right now" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 8 }}>
          {(c1.tasks_at_risk || []).slice(0, 3).map((t: string, i: number) => (
            <span key={`r${i}`} style={{ fontSize: 13, fontWeight: 700, padding: "6px 16px", borderRadius: 20, border: "1.5px solid rgba(174,40,40,0.25)", color: "var(--mb-red)", background: "var(--mb-red-tint)", fontFamily: "'DM Sans', sans-serif" }}>❌ {t}</span>
          ))}
          {(c1.tasks_safe || []).slice(0, 3).map((t: string, i: number) => (
            <span key={`s${i}`} style={{ fontSize: 13, fontWeight: 700, padding: "6px 16px", borderRadius: 20, border: "1.5px solid rgba(26,107,60,0.25)", color: "var(--mb-green)", background: "var(--mb-green-tint)", fontFamily: "'DM Sans', sans-serif" }}>✅ {t}</span>
          ))}
        </div>
        {((c1.tasks_at_risk?.length || 0) > 3 || (c1.tasks_safe?.length || 0) > 3) && (
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", marginBottom: 22, paddingLeft: 4 }}>
            Showing top 3 of each. Full skill map → Card 3 (Shield).
          </div>
        )}
        {!((c1.tasks_at_risk?.length || 0) > 3 || (c1.tasks_safe?.length || 0) > 3) && (
          <div style={{ marginBottom: 22 }} />
        )}

        {/* India market signal — promoted, no longer buried under stat-grid noise */}
        <InfoBox variant="amber" title={`India market signal — ${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`} body={c1.india_data_insight || ""} />

        {/* hope_bridge intentionally NOT rendered here — Card 1 ends on pressure.
            Card 2 (Market Radar) opens with its own hope_bridge to land the relief beat
            after the user has fully processed the risk. Avoids duplicate green panels. */}

        {/* Social proof */}
        {scanCount && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 14, marginBottom: 14 }}>
            <div style={{ display: "flex" }}>
              {avatars.map((a, i) => (
                <div key={i} style={{ width: 26, height: 26, borderRadius: "50%", background: a.bg, color: a.color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 800, border: "2px solid white", marginLeft: i > 0 ? -6 : 0 }}>{a.initials}</div>
              ))}
            </div>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", fontWeight: 600 }}><strong style={{ fontWeight: 800, color: "var(--mb-ink)" }}>{scanCount}+</strong> professionals checked this month{c1.india_average != null && <> · India avg: <strong style={{ fontWeight: 800, color: "var(--mb-red)" }}>{c1.india_average}%</strong></>}</span>
          </div>
        )}

        {/* Methodology stamp — trust footer */}
        <div style={{ padding: "10px 14px", background: "var(--mb-paper)", border: "1px dashed var(--mb-rule)", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", lineHeight: 1.6, fontWeight: 500 }}>
          <strong style={{ color: "var(--mb-ink2)", fontWeight: 800, letterSpacing: "0.04em" }}>HOW WE CALCULATED THIS:</strong> AI Exposure derived from O*NET task-automation indices, McKinsey & Goldman Sachs occupational AI-impact studies, and your resume's task profile. Disruption year is a directional estimate based on current adoption velocity in your sector — not a guarantee.
        </div>

        {/* Pass C1 (#5) — engine/prompt/KG version trace. Quiet credibility footer. */}
        {cardData?._provenance && (
          <div style={{ marginTop: 6, padding: "6px 10px", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--mb-ink3)", letterSpacing: "0.02em", textAlign: "right" }}>
            engine {cardData._provenance.engine_version} · prompt {cardData._provenance.prompt_version} · KG {cardData._provenance.kg_version}
          </div>
        )}

        <CardNav onBack={onBack} onNext={onNext} nextLabel="Defend your skills →" />
      </CardBody>
    </CardShell>
  );
}

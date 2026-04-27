import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CardShell, CardHead, CardBody, CardNav, Badge, LivePill } from "./SharedUI";
import { supabase } from "@/integrations/supabase/client";
import { normalizeCity, detectExecutive } from "@/lib/jobsTab";
import { detectFamily, applySectorTieBreaker, type Family } from "@/lib/card1-personalization";
import { getVelocityBenchmark, compareToBenchmark } from "@/lib/live-market-benchmarks";

/**
 * LiveMarketCard
 * --------------
 * Renders the deterministic live-market-snapshot payload as a single-screen
 * card with five distinct render states: loading, success-strong,
 * success-partial, executive (skipped), and error/empty.
 *
 * Phase 2B-iii-a: this component is built in isolation. Carousel wiring is
 * Phase 2B-iii-b. A snapshotOverride prop exists ONLY for the preview route
 * to render fixtures without invoking the edge function.
 */

export type LiveMarketSnapshot = {
  posting_count: number;
  fetched_at: string;
  cached: boolean;
  is_executive: boolean;
  error?: string;
  top_tags: Array<{ tag: string; count: number; pct: number }>;
  user_skill_overlap: {
    shown: boolean;
    matched_count: number;
    matched_skills: string[];
    missing_top_tags: string[];
  };
  salary: {
    shown: boolean;
    n_disclosed: number;
    n_total: number;
    median_lpa: number | null;
    p25_lpa: number | null;
    p75_lpa: number | null;
  };
  recency: { same_day_count: number; within_7d_count: number; older_count: number };
  // v2: lets the UI honestly downgrade when Naukri's corpus is polluted
  // for a role (returns adjacent-role listings that would mislead users).
  corpus_relevance: {
    score: number;
    band: "strong" | "partial" | "thin";
    title_overlap_pct: number;
    skill_match_in_top_tags: number;
  };
  source: { name: "Naukri.com"; via: "Apify"; fetched_at: string };
};

export interface LiveMarketCardProps {
  role: string;
  city: string;
  all_skills: string[];
  onPrev?: () => void;
  onNext?: () => void;
  /**
   * Test/preview-only override. When set, the component renders this payload
   * directly and skips the network call. NEVER pass this in production.
   */
  snapshotOverride?: LiveMarketSnapshot;
  /** Test/preview-only forced state. Bypasses query entirely. */
  forceState?: "loading" | "error";
}

/* ── Utilities ── */
function titleCaseTag(tag: string): string {
  return tag.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatLpa(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

function relativeTime(iso?: string): string {
  if (!iso) return "just now";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "just now";
  const seconds = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/* ── Subcomponents ── */
function NavOnlyShell({
  title,
  sub,
  badgeLabel,
  message,
  onPrev,
  onNext,
}: {
  title: string;
  sub: string;
  badgeLabel: string;
  message: string;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <CardShell>
      <CardHead
        badges={<><Badge label={badgeLabel} variant="navy" /></>}
        title={title}
        sub={sub}
      />
      <CardBody>
        <div
          style={{
            background: "var(--mb-paper)",
            border: "1.5px solid var(--mb-rule)",
            borderRadius: 14,
            padding: "20px 22px",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14.5,
            lineHeight: 1.7,
            color: "var(--mb-ink2)",
            fontWeight: 500,
          }}
        >
          {message}
        </div>
        <CardNav onBack={onPrev} onNext={onNext} nextLabel="See your action plan →" />
      </CardBody>
    </CardShell>
  );
}

function LoadingSkeleton({ onPrev, onNext }: { onPrev?: () => void; onNext?: () => void }) {
  const bar = (w: string, h = 14) => (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 6,
        background: "var(--mb-rule)",
        animation: "mbPulse 1.6s ease-in-out infinite",
      }}
    />
  );
  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="Live market · loading" variant="navy" /><LivePill /></>}
        title="Your role's job market — live"
        sub="Pulling the latest postings from Naukri…"
      />
      <CardBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {bar("60%", 28)}
          {bar("85%")}
          <div style={{ height: 18 }} />
          {bar("40%", 16)}
          {bar("100%")}
          {bar("100%")}
          {bar("100%")}
          {bar("90%")}
          <div style={{ height: 18 }} />
          {bar("50%", 16)}
          {bar("70%")}
        </div>
        <CardNav onBack={onPrev} onNext={onNext} nextLabel="See your action plan →" />
      </CardBody>
    </CardShell>
  );
}

/* ── Thin-signal render: corpus is too polluted to show tags honestly.
   Render salary + recency only, with explicit disclosure. This is the
   render state that fixes the original "embarrassment" issue — instead
   of showing irrelevant tags as if they were the user's market, we say
   so plainly and surface only the corpus-agnostic numbers. ── */
function ThinSignalView({
  snapshot,
  role,
  displayCity,
  onPrev,
  onNext,
}: {
  snapshot: LiveMarketSnapshot;
  role: string;
  displayCity: string;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const { posting_count, recency, source, fetched_at, cached } = snapshot;
  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="Live market · thin signal" variant="navy" /><LivePill /></>}
        title="Public boards under-represent this role"
        sub={`We pulled ${posting_count} Naukri posting${posting_count === 1 ? "" : "s"} for ${role} in ${displayCity}, but most don't actually look like ${role} jobs.`}
      />
      <CardBody>
        <div
          style={{
            background: "var(--mb-paper)",
            border: "1.5px solid var(--mb-rule)",
            borderRadius: 14,
            padding: "16px 18px",
            marginBottom: 22,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13.5,
            lineHeight: 1.7,
            color: "var(--mb-ink2)",
            fontWeight: 500,
          }}
        >
          <strong>Why we're hiding most of this card:</strong> Naukri's keyword search returned mostly adjacent-role listings (e.g. sales roles for marketing searches, or junior-tier roles for senior searches). The tag list and the disclosed-salary band would both mislead — Naukri's salary disclosures skew heavily junior and BPO, so a "median" computed from this corpus would be 50–70% below the real market for any senior or specialised role. The one slice that holds up is posting freshness, shown below.
        </div>

        {/* Salary block intentionally removed on the thin branch.
            Expert review (2026-04-27) flagged that Naukri's disclosed-pay
            corpus is dominated by BPO/junior listings — computing a median
            from it for a senior, specialised, or 10y+ role produces numbers
            that are 50–70% below reality (e.g. 4.5 LPA shown for an 11y
            Marketing leader whose true market is 22+ LPA). Better to show
            nothing than a number that destroys trust. A future "Sector
            Pulse" card (hiring/firing/funding news, properly grounded)
            will fill this slot — tracked separately from this layer. */}

        {/* Recency — corpus-agnostic */}
        {(recency.same_day_count + recency.within_7d_count + recency.older_count) > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--mb-ink3)",
                marginBottom: 10,
              }}
            >
              Posting freshness
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink)", lineHeight: 1.7 }}>
              <strong>{recency.same_day_count}</strong> posted today · <strong>{recency.within_7d_count}</strong> this week · <strong>{recency.older_count}</strong> older
            </div>
          </div>
        )}

        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12.5,
            color: "var(--mb-ink3)",
            lineHeight: 1.65,
            paddingTop: 14,
            borderTop: "1px dashed var(--mb-rule)",
            fontStyle: "italic",
          }}
        >
          For senior, niche, or specialized roles like {role}, the real opportunities live on LinkedIn, executive search firms, and direct company applications — not public job boards. See the next card for your matched companies.
        </div>

        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11.5,
            color: "var(--mb-ink3)",
            lineHeight: 1.6,
            paddingTop: 12,
            marginTop: 10,
            borderTop: "1px dashed var(--mb-rule)",
          }}
        >
          Source: {source.name} via {source.via} · fetched {relativeTime(fetched_at)}{cached ? " (cached)" : ""}
        </div>

        <CardNav onBack={onPrev} onNext={onNext} nextLabel="See your action plan →" />
      </CardBody>
    </CardShell>
  );
}

/* ── Main render for success states ── */
function SnapshotView({
  snapshot,
  role,
  displayCity,
  onPrev,
  onNext,
}: {
  snapshot: LiveMarketSnapshot;
  role: string;
  displayCity: string;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const { posting_count, top_tags, user_skill_overlap, salary, recency, source, fetched_at, cached } = snapshot;
  const matchedSet = useMemo(
    () => new Set(user_skill_overlap.matched_skills.map((s) => s.toLowerCase())),
    [user_skill_overlap.matched_skills]
  );
  const overlapShown = user_skill_overlap.shown;

  // We approximate "tag matched" by checking whether the tag appears in matched_skills.
  // The edge function's overlap is computed against the same top-tag list, so this is consistent.
  const tagMatched = (tag: string): boolean =>
    overlapShown && matchedSet.has(tag.toLowerCase());

  const band = snapshot.corpus_relevance?.band ?? "strong";
  const isPartial = band === "partial";
  const isThin = band === "thin";

  // ─── Layer A · #1: suppress the top-tag table when it carries no signal.
  // On partial-band corpora (Naukri returned adjacent roles) AND a tiny
  // sample (≤8 postings) AND the tag percentages are flat (max-min ≤ 5pp,
  // i.e. every row says "1/6 = 17%"), the table is wallpaper pretending
  // to be data. Better to suppress it and lead with Hiring Velocity, which
  // IS reliable on the same dataset.
  const tagPctSpread = top_tags.length > 0
    ? Math.max(...top_tags.map(t => t.pct)) - Math.min(...top_tags.map(t => t.pct))
    : 0;
  const maxTagCount = top_tags.length > 0 ? Math.max(...top_tags.map(t => t.count)) : 0;
  const tagsAreFlat = top_tags.length >= 4 && tagPctSpread <= 5;
  const suppressTags = (isPartial || isThin) && posting_count <= 8 && tagsAreFlat;

  // ─── Layer B · #6: directional benchmark for Hiring Velocity.
  // Reuses Card1's family classifier so a "6 today" volume can be compared
  // against typical Naukri daily volume for that family in this city.
  // Returns null for families where Naukri isn't the right corpus
  // (founder/exec/creator/generic) — the line is then simply omitted.
  const family: Family = useMemo(() => {
    const f = detectFamily(role.toLowerCase());
    return applySectorTieBreaker(f, "");
  }, [role]);
  const velocityBenchmark = useMemo(
    () => getVelocityBenchmark(family, displayCity),
    [family, displayCity],
  );

  // ─── Layer B · #5: skill-overlap anchor.
  // One honest line summarising overlap so the user gets a personal anchor
  // before scanning the table. Only computed when overlap data is shown
  // (i.e. corpus is strong enough that matched_skills is meaningful).
  const skillsOnProfile = user_skill_overlap.matched_count;
  const skillsTotalShown = top_tags.length;

  // ─── Layer A · #3: verdict-driven headline (was a logline before).
  // Title varies by corpus_relevance.band so users see *what we found*,
  // not just *what we measured*. Sub keeps the operational facts.
  const verdictTitle = suppressTags
    ? `Your role's market on Naukri is too thin to read.`
    : isPartial
      ? `Your role's market is mixed — here's the signal that holds up.`
      : isThin
        ? `Live demand for ${role} is sparse this week.`
        : `Live demand for ${role} is real — here's what employers are asking for.`;
  const verdictSub = posting_count > 0
    ? `${posting_count} posting${posting_count === 1 ? "" : "s"} analysed for ${role} in ${displayCity}, in the last 7 days.`
    : `We couldn't pull a live posting set for this role+city right now.`;

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="Live market" variant="navy" /><LivePill /></>}
        title={verdictTitle}
        sub={verdictSub}
      />
      <CardBody>
        {/* Partial-band disclaimer — only when we still show the tag table.
            When the table is suppressed, the headline already carries the
            verdict and a second amber strip would just nag. */}
        {isPartial && !suppressTags && (
          <div
            style={{
              background: "var(--mb-amber-tint, #fef3e7)",
              border: "1.5px solid rgba(196,125,30,0.25)",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 18,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--mb-ink2)",
            }}
          >
            <strong style={{ color: "var(--mb-amber, #c47d1e)" }}>Mixed market.</strong>{" "}
            Naukri's results for "{role}" include adjacent roles. Some tags below may not reflect your specific role.
          </div>
        )}

        {/* Tag-suppressed state — replace the noisy table with a single
            honest line + a navigation prompt to the higher-signal card. */}
        {suppressTags && (
          <div
            style={{
              background: "var(--mb-paper)",
              border: "1.5px solid var(--mb-rule)",
              borderRadius: 14,
              padding: "16px 18px",
              marginBottom: 22,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13.5,
              lineHeight: 1.65,
              color: "var(--mb-ink2)",
              fontWeight: 500,
            }}
          >
            <strong>Why we're hiding the tag list:</strong> Naukri returned {posting_count} posting{posting_count === 1 ? "" : "s"} for {role} in 7 days, and no tag appears in more than {maxTagCount} of them — not enough to call a pattern. On a sample this small, the table would invent precision that isn't there. The numbers below are the slice of this dataset that holds up: hiring velocity and posting freshness.
          </div>
        )}

        {/* Layer B · #4: nav prompt for partial/thin corpora.
            Turns the "we hid stuff" disclaimer into a navigation prompt
            toward the higher-signal next card. Suppressed-tag and
            mixed-market both qualify; strong-band corpora don't need it. */}
        {(suppressTags || (isPartial && !suppressTags) || isThin) && (
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12.5,
              lineHeight: 1.65,
              color: "var(--mb-ink3)",
              fontStyle: "italic",
              marginTop: -8,
              marginBottom: 22,
              paddingLeft: 4,
            }}
          >
            On a sample this thin, the higher-signal channel for {role} is the
            <strong style={{ color: "var(--mb-ink2)", fontStyle: "normal" }}> Best-Fit Companies </strong>
            card next — direct targets beat keyword scrapes for senior or specialised roles.
          </div>
        )}

        {/* Layer B · #5: skill-overlap anchor line. One honest sentence above
            the table giving the user a personal read before scanning rows. */}
        {!suppressTags && top_tags.length > 0 && overlapShown && skillsTotalShown > 0 && (
          <div
            data-testid="skill-overlap-anchor"
            style={{
              marginBottom: 14,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13.5,
              lineHeight: 1.6,
              color: "var(--mb-ink2)",
              fontWeight: 600,
            }}
          >
            {skillsOnProfile === 0
              ? <>None of the top {skillsTotalShown} tags appear on your profile — this is the gap to close first.</>
              : skillsOnProfile >= skillsTotalShown
                ? <>You already cover all {skillsTotalShown} top tags employers are asking for. Lead with these in your headline.</>
                : <><strong>{skillsOnProfile} of {skillsTotalShown}</strong> top tags are already on your profile. The remaining {skillsTotalShown - skillsOnProfile} are where to invest next.</>
            }
          </div>
        )}

        {/* Top tags — suppressed when the table carries no signal (see suppressTags above). */}
        {!suppressTags && top_tags.length > 0 && (
          <div style={{ marginBottom: 26 }}>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--mb-ink3)",
                marginBottom: 14,
              }}
            >
              Top tags employers are asking for
            </div>
            <div
              style={{
                background: "white",
                border: "1.5px solid var(--mb-rule)",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              {top_tags.map((t, i) => (
                <div
                  key={t.tag}
                  style={{
                    display: "grid",
                    gridTemplateColumns: overlapShown ? "1fr auto auto" : "1fr auto",
                    columnGap: 18,
                    alignItems: "center",
                    padding: "12px 16px",
                    borderTop: i === 0 ? "none" : "1px solid var(--mb-rule)",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--mb-ink)" }}>
                    {titleCaseTag(t.tag)}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: "var(--mb-ink2)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.pct}% <span style={{ color: "var(--mb-ink3)", fontWeight: 500 }}>({t.count}/{posting_count})</span>
                  </div>
                  {overlapShown && (
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 800,
                        color: tagMatched(t.tag) ? "var(--mb-green)" : "var(--mb-ink3)",
                        whiteSpace: "nowrap",
                        minWidth: 130,
                        textAlign: "right",
                      }}
                    >
                      {tagMatched(t.tag) ? "✓ on your profile" : "—"}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!overlapShown && (
              <div
                style={{
                  marginTop: 12,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12.5,
                  lineHeight: 1.65,
                  color: "var(--mb-ink3)",
                  fontStyle: "italic",
                }}
              >
                Skill-match not shown — this market's top tags don't cleanly reflect {role} skills. We hide the column rather than show misleading matches.
              </div>
            )}
          </div>
        )}

        {/* Hiring Velocity — replaces salary block (Naukri salary data is unfiltered
            by seniority and misleads senior roles, so we surface posting freshness
            instead, which IS reliable from the same dataset). */}
        {(() => {
          const sameDay = recency?.same_day_count ?? 0;
          const within7d = recency?.within_7d_count ?? 0;
          const older = recency?.older_count ?? 0;
          const categorized = sameDay + within7d + older;
          const fresh = sameDay + within7d;
          const totalPool = posting_count ?? categorized;
          const uncategorized = Math.max(0, (posting_count ?? 0) - categorized);

          // Accuracy guards:
          //  • Need a real sample (≥5 dated postings) before claiming a verdict.
          //    With <5, 2-of-3 fresh = 67% = false "HOT" on noise.
          //  • Naukri "posted today" is dominated by recruiter REPOSTS — same JD
          //    bumped to the top, not a new opening. When same-day dominates a
          //    small pool, downgrade to ACTIVE and label honestly.
          const hasSignal = categorized >= 5;
          const freshPct = categorized > 0 ? Math.round((fresh / categorized) * 100) : 0;
          const sameDayShare = categorized > 0 ? sameDay / categorized : 0;
          const repostNoiseSuspected =
            totalPool <= 10 && sameDay >= 3 && sameDayShare >= 0.5;

          let velocityLabel = "—";
          let velocityColor = "var(--mb-ink2)";
          let velocityNote = `Posting dates weren't parseable for enough listings to judge hiring velocity. ${totalPool} ${totalPool === 1 ? "posting was" : "postings were"} pulled.`;
          // Layer C: one-sentence "so-what" verdict that sits above the
          // big label. Empty string = render nothing (no-signal case).
          let velocityVerdict = "";

          if (hasSignal) {
            if (repostNoiseSuspected) {
              velocityLabel = "ACTIVE";
              velocityColor = "#8B6F1F";
              velocityVerdict = `Looks busy on the surface, but most "today" postings on a pool this small are recruiter reposts of older requisitions. Treat as steady, not urgent.`;
              velocityNote = `${sameDay} of ${categorized} dated postings show "today" — on a small pool this usually reflects recruiter reposts of older requisitions, not new openings. Treat as steady, not urgent.`;
            } else if (freshPct >= 70) {
              velocityLabel = "HOT";
              velocityColor = "#B8341C";
              velocityVerdict = `${role} is in active hiring right now — move this week, not next month.`;
              velocityNote = `${freshPct}% of dated postings are <7 days old — recruiters are actively listing this role. Note Naukri can't distinguish new requisitions from reposts.`;
            } else if (freshPct >= 40) {
              velocityLabel = "ACTIVE";
              velocityColor = "#8B6F1F";
              velocityVerdict = `Steady hiring pulse for ${role} — no urgency, but the door is open. Apply where you fit; don't wait for a flood.`;
              velocityNote = `${freshPct}% of dated postings are <7 days old — a steady, consistent listing pulse.`;
            } else {
              velocityLabel = "COOL";
              velocityColor = "var(--mb-ink2)";
              velocityVerdict = `Hiring is quiet for ${role} this week — focus on direct applications and warm intros, not job-board scrolling.`;
              velocityNote = `Only ${freshPct}% of dated postings are <7 days old — most listings are stale; hiring is not urgent right now.`;
            }
          }



          return (
            <div style={{ marginBottom: 22 }}>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--mb-ink3)",
                  marginBottom: 14,
                }}
              >
                Hiring Velocity
              </div>
              <div
                style={{
                  background: "var(--mb-navy-tint)",
                  border: "1.5px solid var(--mb-navy-tint2)",
                  borderRadius: 14,
                  padding: "18px 20px",
                }}
              >
                {velocityVerdict && (
                  <div
                    data-testid="velocity-verdict"
                    style={{
                      fontFamily: "'PP Editorial New', 'Playfair Display', serif",
                      fontSize: 17,
                      lineHeight: 1.45,
                      color: "var(--mb-ink)",
                      fontWeight: 500,
                      marginBottom: 14,
                      paddingBottom: 14,
                      borderBottom: "1px solid var(--mb-rule)",
                    }}
                  >
                    {velocityVerdict}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: 28,
                    flexWrap: "wrap",
                    alignItems: "baseline",
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 32,
                        fontWeight: 800,
                        color: velocityColor,
                        lineHeight: 1.1,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {velocityLabel}
                    </div>
                    <div
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "var(--mb-ink3)",
                        marginTop: 4,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      Market Pulse
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 18,
                        fontWeight: 700,
                        color: "var(--mb-ink)",
                      }}
                    >
                      {sameDay} <span style={{ fontSize: 13, color: "var(--mb-ink2)" }}>today</span>
                      {" · "}
                      {within7d} <span style={{ fontSize: 13, color: "var(--mb-ink2)" }}>this week</span>
                      {" · "}
                      {older} <span style={{ fontSize: 13, color: "var(--mb-ink2)" }}>older</span>
                    </div>
                    <div
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "var(--mb-ink3)",
                        marginTop: 4,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      Posting Freshness ({totalPool} relevant{uncategorized > 0 ? ` · ${uncategorized} undated` : ""})
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    color: "var(--mb-ink2)",
                    lineHeight: 1.55,
                    paddingTop: 10,
                    borderTop: "1px dashed var(--mb-rule)",
                  }}
                >
                  {velocityNote}
                </div>
                {velocityBenchmark && hasSignal && (
                  <div
                    data-testid="velocity-benchmark"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12.5,
                      color: "var(--mb-ink2)",
                      lineHeight: 1.6,
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: "1px dashed var(--mb-rule)",
                    }}
                  >
                    <strong>Benchmark:</strong> {velocityBenchmark.text}{" "}
                    Today's <strong>{sameDay}</strong> sits <strong>{compareToBenchmark(sameDay, velocityBenchmark)}</strong>.
                  </div>
                )}
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    color: "var(--mb-ink3)",
                    fontStyle: "italic",
                    marginTop: 10,
                    lineHeight: 1.55,
                  }}
                >
                  Salary band hidden — Naukri's disclosed pay isn't filtered by seniority,
                  and showing a junior-skewed range for your level would mislead. Use the
                  Negotiation Anchors in your action plan for level-matched compensation.
                </div>
              </div>
            </div>
          );
        })()}

        {/* Source */}
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11.5,
            color: "var(--mb-ink3)",
            lineHeight: 1.6,
            paddingTop: 14,
            borderTop: "1px dashed var(--mb-rule)",
          }}
        >
          Source: {source.name} via {source.via} · fetched {relativeTime(fetched_at)}{cached ? " (cached)" : ""} · cached for 6h
        </div>

        {(() => {
          // Layer D: verdict-aware CTA. Match the next action to what the
          // card just told the user, instead of a generic "action plan" label.
          // Suppressed/thin → next card is higher-signal; partial → defense plan;
          // strong → turn the live signal into action.
          const ctaLabel = suppressTags || isThin
            ? "See your matched companies →"
            : isPartial
              ? "See your defense plan →"
              : "Turn this into your action plan →";
          return <CardNav onBack={onPrev} onNext={onNext} nextLabel={ctaLabel} />;
        })()}
export default function LiveMarketCard({
  role,
  city,
  all_skills,
  onPrev,
  onNext,
  snapshotOverride,
  forceState,
}: LiveMarketCardProps) {
  const displayCity = useMemo(() => normalizeCity(city), [city]);
  const isExec = useMemo(() => detectExecutive(role), [role]);

  // Skip the network call entirely for executives — server-side gate also exists.
  const enabled = !snapshotOverride && !forceState && !isExec && Boolean(role) && Boolean(city);

  const query = useQuery({
    queryKey: ["live-market-snapshot", role, displayCity, all_skills.length],
    enabled,
    staleTime: 1000 * 60 * 60 * 6, // 6 hours, matches edge function cache TTL
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("live-market-snapshot", {
        body: { role, city: displayCity, all_skills },
      });
      if (error) throw error;
      return data as LiveMarketSnapshot;
    },
  });

  // Forced states (preview only)
  if (forceState === "loading") return <LoadingSkeleton onPrev={onPrev} onNext={onNext} />;
  if (forceState === "error") {
    return (
      <NavOnlyShell
        title="Your role's job market — live"
        sub="We couldn't reach the live posting feed."
        badgeLabel="Live market · unavailable"
        message="Live market data unavailable for this role+city right now. We'll retry on next scan refresh."
        onPrev={onPrev}
        onNext={onNext}
      />
    );
  }

  // Executive — skip
  if (isExec) {
    return (
      <NavOnlyShell
        title="Your market is search-firm-led"
        sub="Public job boards aren't the right instrument for this seniority."
        badgeLabel="Live market · executive"
        message={`${role} roles aren't typically posted on Naukri. Your market is search-firm-led. See the Jobs section below for tailored guidance.`}
        onPrev={onPrev}
        onNext={onNext}
      />
    );
  }

  // Preview override
  const snapshot = snapshotOverride ?? query.data;

  if (!snapshotOverride && query.isLoading) {
    return <LoadingSkeleton onPrev={onPrev} onNext={onNext} />;
  }

  if (!snapshotOverride && query.isError) {
    return (
      <NavOnlyShell
        title="Your role's job market — live"
        sub="We couldn't reach the live posting feed."
        badgeLabel="Live market · unavailable"
        message="Live market data unavailable for this role+city right now. We'll retry on next scan refresh."
        onPrev={onPrev}
        onNext={onNext}
      />
    );
  }

  if (!snapshot) {
    return <LoadingSkeleton onPrev={onPrev} onNext={onNext} />;
  }

  // Server reports executive — render skip
  if (snapshot.is_executive) {
    return (
      <NavOnlyShell
        title="Your market is search-firm-led"
        sub="Public job boards aren't the right instrument for this seniority."
        badgeLabel="Live market · executive"
        message={`${role} roles aren't typically posted on Naukri. Your market is search-firm-led. See the Jobs section below for tailored guidance.`}
        onPrev={onPrev}
        onNext={onNext}
      />
    );
  }

  // Error or empty corpus
  if (snapshot.error || snapshot.posting_count === 0) {
    return (
      <NavOnlyShell
        title="Your role's job market — live"
        sub="We couldn't pull a live posting set for this role+city right now."
        badgeLabel="Live market · unavailable"
        message="Live market data unavailable for this role+city right now. We'll retry on next scan refresh."
        onPrev={onPrev}
        onNext={onNext}
      />
    );
  }

  // v2: route by corpus_relevance band. Thin = the corpus doesn't reflect
  // the user's role; render salary+recency only with explicit disclosure
  // instead of misleading tag list. Strong/partial both fall through to
  // the full SnapshotView (partial adds an inline disclaimer).
  // Defensive default for any cached v1 payload that lacks the field.
  const band = snapshot.corpus_relevance?.band ?? "strong";
  if (band === "thin") {
    return (
      <ThinSignalView
        snapshot={snapshot}
        role={role}
        displayCity={displayCity}
        onPrev={onPrev}
        onNext={onNext}
      />
    );
  }

  return (
    <SnapshotView
      snapshot={snapshot}
      role={role}
      displayCity={displayCity}
      onPrev={onPrev}
      onNext={onNext}
    />
  );
}

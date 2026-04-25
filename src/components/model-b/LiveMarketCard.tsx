import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CardShell, CardHead, CardBody, CardNav, Badge, LivePill } from "./SharedUI";
import { supabase } from "@/integrations/supabase/client";
import { normalizeCity, detectExecutive } from "@/lib/jobsTab";

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
  const { posting_count, top_tags, user_skill_overlap, salary, source, fetched_at, cached } = snapshot;
  const matchedSet = useMemo(
    () => new Set(user_skill_overlap.matched_skills.map((s) => s.toLowerCase())),
    [user_skill_overlap.matched_skills]
  );
  const overlapShown = user_skill_overlap.shown;

  // We approximate "tag matched" by checking whether the tag appears in matched_skills.
  // The edge function's overlap is computed against the same top-tag list, so this is consistent.
  const tagMatched = (tag: string): boolean =>
    overlapShown && matchedSet.has(tag.toLowerCase());

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="Live market" variant="navy" /><LivePill /></>}
        title="Your role's job market — live"
        sub={
          posting_count > 0
            ? `${posting_count} posting${posting_count === 1 ? "" : "s"} analyzed for ${role} in ${displayCity}, in the last 7 days.`
            : `We couldn't pull a live posting set for this role+city right now.`
        }
      />
      <CardBody>
        {/* Top tags */}
        {top_tags.length > 0 && (
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
                Skill-match not shown — this market's top tags don't cleanly reflect a {role}'s skills. We hide the column rather than show misleading matches.
              </div>
            )}
          </div>
        )}

        {/* Salary */}
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
            Salary
          </div>
          {salary.shown ? (
            <div
              style={{
                background: "var(--mb-navy-tint)",
                border: "1.5px solid var(--mb-navy-tint2)",
                borderRadius: 14,
                padding: "18px 20px",
              }}
            >
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--mb-ink2)",
                  marginBottom: 10,
                }}
              >
                Disclosed pay across {salary.n_disclosed} of {salary.n_total} postings
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 28,
                  flexWrap: "wrap",
                  alignItems: "baseline",
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 32,
                      fontWeight: 800,
                      color: "var(--mb-navy)",
                      lineHeight: 1.1,
                    }}
                  >
                    {salary.median_lpa} <span style={{ fontSize: 16, fontWeight: 700, color: "var(--mb-ink2)" }}>LPA</span>
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
                    Median
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
                    {salary.p25_lpa} – {salary.p75_lpa} <span style={{ fontSize: 13, color: "var(--mb-ink2)" }}>LPA</span>
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
                    Range (P25–P75)
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13.5,
                color: "var(--mb-ink3)",
                fontStyle: "italic",
                lineHeight: 1.65,
              }}
            >
              Salary disclosure too sparse to compute. Most postings hide pay.
            </div>
          )}
        </div>

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

        <CardNav onBack={onPrev} onNext={onNext} nextLabel="See your action plan →" />
      </CardBody>
    </CardShell>
  );
}

/* ── Public component ── */
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

/**
 * Layer C regression net for LiveMarketCard.
 *
 * Locks in the "so-what" verdict line that sits at the top of the
 * Hiring Velocity strip. One sentence telling the user what to DO,
 * before they read the numbers.
 *
 * Variants:
 *  HOT       — fresh ≥70%, big sample → "move this week"
 *  ACTIVE    — fresh 40–69%           → "steady pulse, door open"
 *  ACTIVE*   — repost-noise suspected → "looks busy but reposts"
 *  COOL      — fresh <40%             → "quiet — direct apply, not scrolling"
 *  No signal — verdict omitted entirely
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LiveMarketCard, { type LiveMarketSnapshot } from "@/components/model-b/LiveMarketCard";
import { r1Fixture } from "@/components/model-b/liveMarketFixtures";

function renderCard(snapshot: LiveMarketSnapshot, role = "Senior Software Engineer") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LiveMarketCard
        role={role}
        city="Bangalore"
        all_skills={[]}
        snapshotOverride={snapshot}
      />
    </QueryClientProvider>
  );
}

function makeSnapshot(over: Partial<LiveMarketSnapshot>): LiveMarketSnapshot {
  return { ...r1Fixture, ...over };
}

describe("LiveMarketCard — Layer C: velocity 'so-what' verdict", () => {
  it("renders HOT verdict (move this week) when freshness ≥70% on a real sample", () => {
    // Need: freshPct ≥ 70 AND not repost-noise-suspected.
    // Repost-noise trips when sameDayShare ≥ 85% AND within7d === 0, OR small pool ≤10.
    // Use a balanced fresh mix (40 same-day + 30 within_7d on a 70-pool) so:
    //   freshPct = 100% (HOT), sameDayShare = 57% (<85%, safe), pool = 70 (>10, safe).
    const snap = makeSnapshot({
      posting_count: 70,
      recency: { same_day_count: 40, within_7d_count: 30, older_count: 0 },
    });
    renderCard(snap);
    const verdict = screen.getByTestId("velocity-verdict");
    expect(verdict.textContent).toMatch(/active hiring right now/i);
    expect(verdict.textContent).toMatch(/move this week/i);
  });

  it("renders ACTIVE (steady pulse) verdict when freshness lands 40–69%", () => {
    const snap = makeSnapshot({
      posting_count: 30,
      recency: { same_day_count: 5, within_7d_count: 10, older_count: 15 }, // 50% fresh
    });
    renderCard(snap);
    const verdict = screen.getByTestId("velocity-verdict");
    expect(verdict.textContent).toMatch(/steady hiring pulse/i);
    expect(verdict.textContent).toMatch(/door is open/i);
  });

  it("renders the repost-noise variant when same-day dominates a small pool", () => {
    const snap = makeSnapshot({
      posting_count: 6,
      recency: { same_day_count: 5, within_7d_count: 1, older_count: 0 }, // ≥50% same-day, pool ≤10
    });
    renderCard(snap);
    const verdict = screen.getByTestId("velocity-verdict");
    expect(verdict.textContent).toMatch(/recruiter reposts/i);
    expect(verdict.textContent).toMatch(/steady, not urgent/i);
  });

  it("renders COOL verdict (quiet — direct apply) when freshness <40%", () => {
    const snap = makeSnapshot({
      posting_count: 30,
      recency: { same_day_count: 1, within_7d_count: 4, older_count: 25 }, // ~17% fresh
    });
    renderCard(snap);
    const verdict = screen.getByTestId("velocity-verdict");
    expect(verdict.textContent).toMatch(/quiet/i);
    expect(verdict.textContent).toMatch(/direct applications/i);
  });

  it("omits the verdict entirely when there's no real signal (<5 dated postings)", () => {
    const snap = makeSnapshot({
      posting_count: 3,
      recency: { same_day_count: 1, within_7d_count: 1, older_count: 1 }, // categorized=3, hasSignal=false
    });
    renderCard(snap);
    expect(screen.queryByTestId("velocity-verdict")).toBeNull();
  });
});

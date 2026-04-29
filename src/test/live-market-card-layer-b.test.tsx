/**
 * Layer B regression net for LiveMarketCard.
 *
 * Locks in:
 *  B#5 — Skill-overlap anchor line renders above the tag table when overlap
 *        data is shown, summarising X-of-Y match honestly.
 *  B#6 — Hiring-velocity benchmark line renders inside the velocity strip
 *        when we have a confident family/city benchmark and a real signal
 *        (≥5 dated postings).
 *  Negative — neither anchor nor benchmark renders on tag-suppressed
 *        partial-tiny-flat fixtures (no signal to anchor against).
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LiveMarketCard from "@/components/model-b/LiveMarketCard";
import {
  r1Fixture,
  tinyFlatPartialFixture,
} from "@/components/model-b/liveMarketFixtures";

function renderCard(
  snapshot: typeof r1Fixture,
  role = "Senior Software Engineer",
  city = "Bangalore",
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LiveMarketCard
        role={role}
        city={city}
        all_skills={[]}
        snapshotOverride={snapshot}
      />
    </QueryClientProvider>
  );
}

describe("LiveMarketCard — Layer B#5: skill-overlap anchor", () => {
  it("renders the X-of-Y anchor line above the tag table when overlap is shown", () => {
    renderCard(r1Fixture);
    const anchor = screen.getByTestId("skill-overlap-anchor");
    expect(anchor).toBeInTheDocument();
    // R1: matched_count=4, top_tags.length=8
    expect(anchor.textContent).toMatch(/4 of 8/);
    expect(anchor.textContent).toMatch(/already on your profile/i);
  });

  it("does NOT render the anchor when tag table is suppressed", () => {
    renderCard(tinyFlatPartialFixture);
    expect(screen.queryByTestId("skill-overlap-anchor")).toBeNull();
  });
});

describe("LiveMarketCard — Layer B#6: hiring-velocity benchmark", () => {
  it("renders a directional benchmark line for an eng role in a tier-1 metro", () => {
    renderCard(r1Fixture, "Senior Software Engineer", "Bangalore");
    const bench = screen.getByTestId("velocity-benchmark");
    expect(bench).toBeInTheDocument();
    // Must include both the directional range syntax and the comparison verdict.
    expect(bench.textContent).toMatch(/~\d+–\d+\/day/);
    expect(bench.textContent).toMatch(/typical daily band/i);
  });

  it("suppresses the benchmark on repost-noise corpora to avoid contradicting the STEADY verdict", () => {
    // Round-5 fix (D, 2026-04-29): tinyFlatPartialFixture is 6 same-day / 0
    // within-7d / 0 older — sameDayShare=100%, our new repost-noise rule
    // (sameDayShare ≥85% AND within7d===0) flags this as recruiter spam and
    // shows "STEADY · treat as steady, not urgent". Rendering "above typical
    // band" alongside "treat as steady" was the contradiction the bug report
    // (Bug D, screenshot 2) flagged. Benchmark is intentionally hidden here.
    renderCard(tinyFlatPartialFixture);
    expect(screen.queryByTestId("velocity-benchmark")).toBeNull();
  });
});

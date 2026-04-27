/**
 * Layer A regression net for LiveMarketCard.
 *
 * What it locks in:
 *  1. When the corpus is partial-band AND the sample is tiny (≤8) AND every
 *     tag is flat (max-min ≤ 5pp), the noisy tag table is suppressed and a
 *     single honest "why we're hiding it" line is rendered instead.
 *  2. The verdict-driven headline replaces the generic "Your role's job
 *     market — live" logline. It varies by corpus_relevance.band.
 *  3. When suppression fires, Hiring Velocity becomes the first content
 *     unit (i.e. it appears before any tag-table DOM would have).
 *  4. Strong-band corpora are NOT affected — the regular table still renders.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LiveMarketCard from "@/components/model-b/LiveMarketCard";
import {
  r1Fixture,
  r3Fixture,
  tinyFlatPartialFixture,
} from "@/components/model-b/liveMarketFixtures";

const baseProps = {
  role: "Digital Marketing Manager | Growth & Demand Generation Leader",
  city: "India",
  all_skills: [],
};

function renderCard(snapshot: typeof tinyFlatPartialFixture) {
  // Disable retries so any accidental network call fails fast (the override
  // path should bypass the query entirely, but the hook still mounts).
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LiveMarketCard {...baseProps} snapshotOverride={snapshot} />
    </QueryClientProvider>
  );
}

describe("LiveMarketCard — Layer A: tag-table suppression", () => {
  it("suppresses the tag table when partial + tiny + flat (screenshot scenario)", () => {
    renderCard(tinyFlatPartialFixture);
    // The "Top tags employers are asking for" header must NOT appear.
    expect(screen.queryByText(/Top tags employers are asking for/i)).toBeNull();
    // Suppression copy MUST appear.
    expect(screen.getByText(/Why we're hiding the tag list/i)).toBeInTheDocument();
    // None of the screenshot's tag names should be rendered as table rows.
    expect(screen.queryByText("Team Handling")).toBeNull();
    expect(screen.queryByText("Linkedin Marketing")).toBeNull();
  });

  it("renders the verdict headline when suppression fires", () => {
    renderCard(tinyFlatPartialFixture);
    expect(
      screen.getByRole("heading", { name: /too thin to read/i })
    ).toBeInTheDocument();
    // The old generic logline must NOT be the headline anymore.
    expect(
      screen.queryByRole("heading", { name: /^Your role's job market — live$/i })
    ).toBeNull();
  });

  it("promotes Hiring Velocity above the (now absent) tag block", () => {
    renderCard(tinyFlatPartialFixture);
    const suppressionLine = screen.getByText(/Why we're hiding the tag list/i);
    const velocityLabel = screen.getByText(/Hiring Velocity/i);
    // Velocity must come AFTER the suppression line (suppression is the
    // replacement for the table; velocity follows it). And critically it
    // must come BEFORE any tag-row text would have rendered.
    const order = suppressionLine.compareDocumentPosition(velocityLabel);
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("does NOT suppress when corpus is strong-band (R1 Java, 50 postings)", () => {
    renderCard(r1Fixture);
    expect(
      screen.getByText(/Top tags employers are asking for/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Why we're hiding the tag list/i)).toBeNull();
    // Strong-band verdict headline.
    expect(
      screen.getByRole("heading", { name: /Live demand for .* is real/i })
    ).toBeInTheDocument();
  });

  it("does NOT suppress when partial-band but the sample is healthy (R3, 50 postings, varied pcts)", () => {
    renderCard(r3Fixture);
    // R3 is partial but with 50 postings and a wide tag-pct spread (44→18),
    // the tag table is still informative — keep it, keep the disclaimer.
    expect(
      screen.getByText(/Top tags employers are asking for/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Mixed market/i)).toBeInTheDocument();
    // Partial-band verdict headline (mixed-market variant, NOT the
    // "too thin to read" suppression variant).
    expect(
      screen.getByRole("heading", { name: /market is mixed/i })
    ).toBeInTheDocument();
  });
});

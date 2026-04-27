/**
 * Salary-suppression regression net.
 *
 * Trust hazard (flagged by expert review 2026-04-27):
 *   Naukri's disclosed-pay corpus skews BPO/junior. Computing a median
 *   from it for a senior, specialised, or 10y+ role produces numbers
 *   that are 50–70% below reality (a real screenshot showed 4.5 LPA
 *   for an 11y Marketing leader whose true band is 22+ LPA).
 *
 * This file pins the rule: NO salary number is rendered anywhere on
 * the Live Market card, on any branch (thin / partial / strong),
 * regardless of how confident the snapshot's salary block looks.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LiveMarketCard, { type LiveMarketSnapshot } from "@/components/model-b/LiveMarketCard";
import {
  r1Fixture,
  r3Fixture,
  r2ThinFixture,
  tinyFlatPartialFixture,
} from "@/components/model-b/liveMarketFixtures";

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

// Patterns that would betray a salary leak. Whitelist anything legitimate
// elsewhere on the card (we mention "Negotiation Anchors" and "salary band
// hidden — Naukri's disclosed pay isn't filtered by seniority" as DISCLOSURE
// copy, not as numbers; those are fine).
const SALARY_NUMBER_PATTERNS: RegExp[] = [
  /\d+(\.\d+)?\s*LPA/i,           // "4.5 LPA", "15 LPA"
  /LPA\s*median/i,                 // header for the old salary block
  /P25\s*[–-]\s*P75/i,             // percentile range label
  /Salary across the broader corpus/i, // old block heading
  /postings disclosed pay/i,       // old block subtitle
];

function assertNoSalaryNumbers(html: string) {
  for (const pattern of SALARY_NUMBER_PATTERNS) {
    expect(html, `Salary leak via pattern ${pattern}`).not.toMatch(pattern);
  }
}

describe("LiveMarketCard — salary suppression (trust guardrail)", () => {
  it("renders no salary numbers on the strong-band branch (R1)", () => {
    const { container } = renderCard(r1Fixture);
    assertNoSalaryNumbers(container.innerHTML);
  });

  it("renders no salary numbers on the partial-band branch (R3)", () => {
    const { container } = renderCard(r3Fixture);
    assertNoSalaryNumbers(container.innerHTML);
  });

  it("renders no salary numbers on the thin-band branch (R2 — the original screenshot scenario)", () => {
    const { container } = renderCard(r2ThinFixture);
    assertNoSalaryNumbers(container.innerHTML);
  });

  it("renders no salary numbers on the partial-tiny-flat branch (tinyFlatPartialFixture)", () => {
    const { container } = renderCard(tinyFlatPartialFixture);
    assertNoSalaryNumbers(container.innerHTML);
  });

  it("ignores even an aggressively confident salary payload — never renders the number", () => {
    // Construct a snapshot where the edge function (or a future regression)
    // tries to push a fully-disclosed, narrow-band salary. The component
    // must STILL refuse to render it.
    const aggressiveSnap: LiveMarketSnapshot = {
      ...r2ThinFixture,
      salary: { shown: true, n_disclosed: 50, n_total: 50, median_lpa: 4.5, p25_lpa: 3.3, p75_lpa: 10.5 },
    };
    const { container } = renderCard(aggressiveSnap);
    assertNoSalaryNumbers(container.innerHTML);
  });
});

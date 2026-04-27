/**
 * Layer E guardrail tests for SectorPulse.
 * Locks in: untrusted-domain URLs are dropped, empty beats → component
 * renders nothing, trusted beats render with signal labels.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SectorPulse from "@/components/model-b/SectorPulse";

function renderPulse(pulseOverride: any, role = "Senior Software Engineer") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SectorPulse role={role} city="Bangalore" pulseOverride={pulseOverride} />
    </QueryClientProvider>
  );
}

const goodBeat = {
  headline: "Razorpay opens new Bangalore engineering hub with 200 hires",
  source_name: "Inc42",
  source_url: "https://inc42.com/buzz/razorpay-bangalore-hub",
  published_at: new Date(Date.now() - 2 * 86400_000).toISOString(),
  signal: "hiring" as const,
  company: "Razorpay",
};

describe("SectorPulse — Layer E guardrails", () => {
  it("renders nothing when beats array is empty", () => {
    const { container } = renderPulse({
      beats: [], window_days: 14, fetched_at: new Date().toISOString(),
      cached: false, sector_label: "Tech & Engineering",
    });
    expect(container.innerHTML).toBe("");
  });

  it("drops beats with untrusted source URLs (defense-in-depth)", () => {
    renderPulse({
      beats: [
        goodBeat,
        { ...goodBeat, source_url: "https://random-blog-spam.xyz/article", source_name: "Spam" },
      ],
      window_days: 14, fetched_at: new Date().toISOString(),
      cached: false, sector_label: "Tech & Engineering",
    });
    const beats = screen.getAllByTestId("sector-pulse-beat");
    expect(beats).toHaveLength(1);
    expect(beats[0].getAttribute("href")).toContain("inc42.com");
  });

  it("renders trusted beats with signal label and source", () => {
    renderPulse({
      beats: [goodBeat],
      window_days: 14, fetched_at: new Date().toISOString(),
      cached: false, sector_label: "Tech & Engineering",
    });
    expect(screen.getByTestId("sector-pulse")).toBeInTheDocument();
    expect(screen.getByText(/HIRING/)).toBeInTheDocument();
    expect(screen.getByText(/Inc42/)).toBeInTheDocument();
  });

  it("renders nothing for unmapped families (founder/exec/creator/generic)", () => {
    const { container } = renderPulse({
      beats: [goodBeat], window_days: 14, fetched_at: new Date().toISOString(),
      cached: false, sector_label: "",
    }, "Founder & CEO");
    expect(container.innerHTML).toBe("");
  });
});

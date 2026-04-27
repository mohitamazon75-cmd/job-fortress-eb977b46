import { describe, it, expect } from "vitest";
import { decideAttribution } from "@/components/model-b/quote-attribution";

describe("decideAttribution", () => {
  it("suppresses everything when quote is empty", () => {
    const r = decideAttribution("", "McKinsey");
    expect(r.showQuote).toBe(false);
    expect(r.showSource).toBe(false);
  });

  it("suppresses everything when quote is trivially short", () => {
    const r = decideAttribution("Yes.", "McKinsey");
    expect(r.showQuote).toBe(false);
  });

  it("keeps quote, drops source when source is empty", () => {
    const r = decideAttribution("AI is reshaping the white-collar workforce.", "");
    expect(r.showQuote).toBe(true);
    expect(r.showSource).toBe(false);
  });

  it("renders trusted publisher source as-is", () => {
    const r = decideAttribution("AI will displace 300M jobs.", "Goldman Sachs Research, 2024");
    expect(r.showQuote).toBe(true);
    expect(r.showSource).toBe(true);
    expect(r.source).toContain("Goldman Sachs");
  });

  it("renders NASSCOM (Indian source) as-is", () => {
    const r = decideAttribution("AI talent demand grew 40% YoY.", "NASSCOM AI Talent Report 2024");
    expect(r.showQuote).toBe(true);
    expect(r.showSource).toBe(true);
  });

  it("drops generic 'AI Researcher' attribution", () => {
    const r = decideAttribution("AI is changing everything.", "AI Researcher");
    expect(r.showQuote).toBe(true);
    expect(r.showSource).toBe(false);
  });

  it("drops generic 'Senior Industry Analyst' attribution", () => {
    const r = decideAttribution("Marketing roles are at risk.", "Senior Industry Analyst");
    expect(r.showQuote).toBe(true);
    expect(r.showSource).toBe(false);
  });

  it("keeps named-person + org attribution (comma form)", () => {
    const r = decideAttribution("This is a watershed moment.", "Jane Doe, Head of AI, Infosys");
    expect(r.showQuote).toBe(true);
    expect(r.showSource).toBe(true);
  });

  it("keeps a capitalised multi-word entity", () => {
    const r = decideAttribution("The market is shifting.", "Sundar Pichai");
    expect(r.showQuote).toBe(true);
    expect(r.showSource).toBe(true);
  });

  it("drops a single vague lowercase word", () => {
    const r = decideAttribution("AI will replace many jobs.", "experts");
    expect(r.showQuote).toBe(true);
    expect(r.showSource).toBe(false);
  });

  it("handles null/undefined safely", () => {
    const r = decideAttribution(null, undefined);
    expect(r.showQuote).toBe(false);
    expect(r.showSource).toBe(false);
  });
});

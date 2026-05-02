// Tests for reconstructRewrittenResume — pure helper, B2.2.1
//
// Heuristic conditions this fixture set is calibrated against:
//   1. null / undefined / non-object → "" (zero throw)
//   2. Missing optional fields → silently dropped (no "undefined" leak)
//   3. Non-string fields where strings expected → coerced to "" (no crash)
//   4. Array fields with mixed garbage → only valid strings kept
//   5. experience_bullets must use weaponized_bullet (NOT original_framing)
//   6. context prefix joined with ": " when present
//   7. Headline skills + strategic keywords joined with ", "
//   8. Real-shape Weaponizer JSON → resume-like text long enough for det matcher

import { describe, it, expect } from "vitest";
import { reconstructRewrittenResume } from "@/lib/reconstruct-rewritten-resume";

describe("reconstructRewrittenResume", () => {
  it("returns '' for null / undefined / non-object", () => {
    expect(reconstructRewrittenResume(null)).toBe("");
    expect(reconstructRewrittenResume(undefined)).toBe("");
    expect(reconstructRewrittenResume("string" as any)).toBe("");
    expect(reconstructRewrittenResume(42 as any)).toBe("");
  });

  it("returns '' when all fields missing or empty", () => {
    expect(reconstructRewrittenResume({})).toBe("");
    expect(reconstructRewrittenResume({ professional_summary: "" })).toBe("");
    expect(reconstructRewrittenResume({ professional_summary: "   " })).toBe("");
  });

  it("includes only present fields (no undefined leakage)", () => {
    const out = reconstructRewrittenResume({
      linkedin_headline: "Senior PM · Fintech",
      professional_summary: "Drove ₹50Cr ARR.",
    });
    expect(out).toContain("Senior PM");
    expect(out).toContain("₹50Cr ARR");
    expect(out).not.toContain("undefined");
  });

  it("coerces non-string scalar fields to empty without throwing", () => {
    const out = reconstructRewrittenResume({
      linkedin_headline: 123 as any,
      professional_summary: { foo: "bar" } as any,
      cover_letter_hook: "Real hook here",
    });
    expect(out).toBe("Real hook here");
  });

  it("filters garbage from string-array fields", () => {
    const out = reconstructRewrittenResume({
      key_skills_section: {
        headline_skills: ["SQL", "", null, "Python", 42, "  "] as any,
        strategic_keywords: ["A/B Testing", undefined, "  Roadmapping  "] as any,
      },
    });
    expect(out).toContain("SQL, Python");
    expect(out).toContain("A/B Testing, Roadmapping");
    expect(out).not.toContain("null");
    expect(out).not.toContain("undefined");
  });

  it("uses weaponized_bullet (NOT original_framing) for experience", () => {
    const out = reconstructRewrittenResume({
      experience_bullets: [
        {
          context: "Razorpay",
          original_framing: "Was responsible for payments",
          weaponized_bullet: "Architected ₹120Cr payment rails",
        },
      ],
    });
    expect(out).toContain("Architected ₹120Cr");
    expect(out).not.toContain("Was responsible");
  });

  it("joins context + bullet with ': ' when context present", () => {
    const out = reconstructRewrittenResume({
      experience_bullets: [
        { context: "Acme Corp", weaponized_bullet: "Scaled team to 12" },
      ],
    });
    expect(out).toContain("Acme Corp: Scaled team to 12");
  });

  it("emits bullet alone when context is missing", () => {
    const out = reconstructRewrittenResume({
      experience_bullets: [
        { weaponized_bullet: "Closed ₹2Cr deal" },
      ],
    });
    expect(out).toContain("Closed ₹2Cr deal");
    expect(out).not.toContain(": Closed");
  });

  it("skips experience entries with no weaponized_bullet", () => {
    const out = reconstructRewrittenResume({
      experience_bullets: [
        { context: "Skip me", original_framing: "old text" },
        { context: "Keep me", weaponized_bullet: "Real bullet" },
      ],
    });
    expect(out).toContain("Keep me: Real bullet");
    expect(out).not.toContain("Skip me");
    expect(out).not.toContain("old text");
  });

  it("includes new_sections sample_entries with title prefix", () => {
    const out = reconstructRewrittenResume({
      new_sections_to_add: [
        {
          section_title: "AI Augmentation Projects",
          sample_entries: ["Built RAG pipeline", "Deployed Cursor team-wide"],
        },
      ],
    });
    expect(out).toContain("AI Augmentation Projects: Built RAG pipeline; Deployed Cursor team-wide");
  });

  it("produces resume-like text >200 chars on a realistic Weaponizer payload", () => {
    const out = reconstructRewrittenResume({
      linkedin_headline: "Senior Product Manager · Fintech & B2B SaaS · Ex-Razorpay · Scaled 3 products to ₹50Cr ARR",
      professional_summary: "Senior PM with 8 years in Indian fintech. Led 12-person cross-functional team to ship payment infrastructure processing ₹120Cr/month. Specialised in 0-to-1 product launches and AI-augmented customer ops.",
      key_skills_section: {
        headline_skills: ["Product Strategy", "A/B Testing", "SQL", "Roadmapping", "Stakeholder Management", "AI Tools"],
        strategic_keywords: ["UPI", "PCI-DSS", "Fintech", "B2B SaaS", "Razorpay", "Naukri"],
      },
      experience_bullets: [
        { context: "Razorpay", weaponized_bullet: "Architected ₹120Cr/month payment rails serving 50K+ Indian SMBs, reducing failure rate by 38%." },
        { context: "Paytm", weaponized_bullet: "Spearheaded UPI 2.0 rollout across 3 BUs, capturing 22% market share in 9 months." },
      ],
      cover_letter_hook: "Looking for a Director PM role where I can ship payment infra at India scale.",
    });
    expect(out.length).toBeGreaterThan(200);
    expect(out).toContain("Razorpay");
    expect(out).toContain("UPI 2.0");
    expect(out).toContain("Product Strategy");
  });
});

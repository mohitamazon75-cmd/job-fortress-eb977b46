import { describe, it, expect } from "vitest";
import { pickMondayMove, isActionable } from "@/components/model-b/MondayMoveCard";

describe("MondayMoveCard.isActionable", () => {
  it("rejects vague verdict closers", () => {
    expect(isActionable("One revenue outcome you own.")).toBe(false);
    expect(isActionable("A skill you actually use.")).toBe(false);
    expect(isActionable("The future is uncertain.")).toBe(false);
  });

  it("accepts concrete actions with a verb + anchor", () => {
    expect(isActionable("Open Naukri and search for Product Manager roles.")).toBe(true);
    expect(isActionable("Send 5 cold emails on Monday morning.")).toBe(true);
    expect(isActionable("Finish one LangChain tutorial end-to-end.")).toBe(true);
  });

  it("rejects sentences with no verb", () => {
    expect(isActionable("Strong fundamentals in marketing.")).toBe(false);
  });
});

describe("MondayMoveCard.pickMondayMove", () => {
  it("prefers server-computed monday_move over any other source", () => {
    const cd = {
      monday_move: { action: "Send 3 cold emails by Friday.", hinglish: "Test hinglish.", source: "Server", why: "Test why" },
      card4_pivot: { adjacent_roles: [{ role: "AI Product Manager" }] },
    };
    const m = pickMondayMove(cd);
    expect(m.action).toBe("Send 3 cold emails by Friday.");
    expect(m.source).toBe("Server");
    expect(m.why).toBe("Test why");
  });

  it("falls back to client picker when server monday_move is missing", () => {
    const cd = { card4_pivot: { adjacent_roles: [{ role: "AI Product Manager" }] } };
    const m = pickMondayMove(cd);
    expect(m.action).toContain("AI Product Manager");
  });

  it("ignores empty server monday_move and falls through", () => {
    const cd = {
      monday_move: { action: "" },
      card4_pivot: { adjacent_roles: [{ role: "Growth PM" }] },
    };
    const m = pickMondayMove(cd);
    expect(m.action).toContain("Growth PM");
  });

  it("prefers a pivot role over the verdict closer", () => {
    const cd = {
      card1_risk: { confrontation: "You are exposed. One revenue outcome you own." },
      card4_pivot: { adjacent_roles: [{ role: "AI Product Manager" }] },
    };
    const m = pickMondayMove(cd);
    expect(m.action).toContain("AI Product Manager");
    expect(m.source).toBe("From your pivot paths");
  });

  it("falls through vague verdict to a critical-gap shield skill", () => {
    const cd = {
      card1_risk: { confrontation: "Risk is rising. One revenue outcome you own." },
      card3_shield: { skills: [{ name: "Excel", tier: "best-in-class" }, { name: "LangChain", tier: "critical-gap" }] },
    };
    const m = pickMondayMove(cd);
    expect(m.action).toContain("LangChain");
    expect(m.source).toBe("From your skill shield");
  });

  it("uses survival diet when no pivot/shield present", () => {
    const cd = { weekly_survival_diet: { items: [{ skill: "Prompt Engineering" }] } };
    const m = pickMondayMove(cd);
    expect(m.action).toContain("Prompt Engineering");
    expect(m.source).toBe("From your survival diet");
  });

  it("uses verdict closer ONLY if it passes the actionable filter", () => {
    const cd = { card1_risk: { confrontation: "You are exposed. Send 3 cold emails on Monday morning." } };
    const m = pickMondayMove(cd);
    expect(m.action).toBe("Send 3 cold emails on Monday morning.");
    expect(m.source).toBe("From your risk verdict");
  });

  it("rejects vague verdict closer and goes to default", () => {
    const cd = { card1_risk: { confrontation: "You are exposed. One revenue outcome you own." } };
    const m = pickMondayMove(cd);
    expect(m.source).toBe("Default action");
    expect(m.action).toContain("Naukri");
  });

  it("default action uses role from profile when present", () => {
    const cd = { profile: { role: "Digital Marketing Manager" } };
    const m = pickMondayMove(cd);
    expect(m.action).toContain("Digital Marketing Manager");
    expect(m.source).toBe("Default action");
  });

  it("safe default when nothing is present", () => {
    const m = pickMondayMove({});
    expect(m.action).toContain("Naukri");
    expect(m.hinglish).toContain("Naukri");
    expect(m.source).toBe("Default action");
  });

  it("never returns an empty action string", () => {
    const cases = [null, undefined, {}, { card1_risk: {} }, { weekly_survival_diet: { items: [] } }];
    for (const cd of cases) {
      const m = pickMondayMove(cd as any);
      expect(m.action.length).toBeGreaterThan(10);
      expect(m.hinglish.length).toBeGreaterThan(5);
    }
  });
});

// ─── Pass C3 (2026-04-30): pivot field-name drift fix ─────────────────
// Calibrated against: producer (get-model-b-analysis) emits the post-filter
// array under `card4_pivot.pivots`. Before C3, MondayMoveCard only read
// `adjacent_roles` / `paths`, so for ALL real scans this branch silently
// skipped to skill/diet defaults. Locks in the canonical field as priority 1
// while keeping legacy aliases as fallback (additive, Rule 2).
describe("MondayMoveCard.pickMondayMove — Pass C3 canonical pivots field", () => {
  it("reads card4_pivot.pivots (the field actually emitted by the edge fn)", () => {
    const cd = {
      card4_pivot: { pivots: [{ role: "Director of Strategic Partnerships" }] },
    };
    const m = pickMondayMove(cd);
    expect(m.action).toContain("Director of Strategic Partnerships");
    expect(m.source).toBe("From your pivot paths");
  });

  it("prefers .pivots over legacy .adjacent_roles when both exist", () => {
    const cd = {
      card4_pivot: {
        pivots: [{ role: "VP Sales" }],
        adjacent_roles: [{ role: "Junior Marketer" }],
      },
    };
    const m = pickMondayMove(cd);
    expect(m.action).toContain("VP Sales");
    expect(m.action).not.toContain("Junior Marketer");
  });

  it("falls back to .adjacent_roles when .pivots is empty (post-filter wipe)", () => {
    // The filter dropped every same-family pivot for a non-exec — empty array.
    // Legacy alias still wins so we don't regress old fixtures.
    const cd = {
      card4_pivot: {
        pivots: [],
        adjacent_roles: [{ role: "Product Manager" }],
      },
    };
    const m = pickMondayMove(cd);
    expect(m.action).toContain("Product Manager");
  });

  it("falls back to .paths when neither .pivots nor .adjacent_roles populated", () => {
    const cd = { card4_pivot: { paths: [{ role: "Customer Success Lead" }] } };
    const m = pickMondayMove(cd);
    expect(m.action).toContain("Customer Success Lead");
  });

  it("falls through to skill shield when card4_pivot.pivots is empty AND no aliases", () => {
    // Calibrated against: post-filter exec on declining family with 0 same-family
    // execs surviving. Should NOT fabricate a pivot — should use the next priority.
    const cd = {
      card4_pivot: { pivots: [] },
      card3_shield: { skills: [{ name: "Python", tier: "critical-gap" }] },
    };
    const m = pickMondayMove(cd);
    expect(m.source).toBe("From your skill shield");
    expect(m.action).toContain("Python");
  });
});


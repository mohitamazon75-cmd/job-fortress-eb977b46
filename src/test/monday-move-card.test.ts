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

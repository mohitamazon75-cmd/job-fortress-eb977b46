import { describe, it, expect } from "vitest";
import { pickMondayMove } from "@/components/model-b/MondayMoveCard";

describe("MondayMoveCard.pickMondayMove", () => {
  it("uses the last sentence of card1 confrontation when present", () => {
    const cd = { card1_risk: { confrontation: "You are exposed. Do this. Fix that this week. One case study." } };
    const m = pickMondayMove(cd);
    expect(m.action).toBe("One case study.");
    expect(m.source).toBe("From your risk verdict");
    expect(m.hinglish).toMatch(/Monday/);
  });

  it("falls back to weekly survival diet day-1 item", () => {
    const cd = { weekly_survival_diet: { items: [{ skill: "Prompt Engineering" }] } };
    const m = pickMondayMove(cd);
    expect(m.action).toContain("Prompt Engineering");
    expect(m.source).toBe("From your survival diet");
  });

  it("falls back to a critical-gap shield skill", () => {
    const cd = { card3_shield: { skills: [{ name: "Excel", tier: "best-in-class" }, { name: "LangChain", tier: "critical-gap" }] } };
    const m = pickMondayMove(cd);
    expect(m.action).toContain("LangChain");
    expect(m.source).toBe("From your skill shield");
  });

  it("falls back to a pivot role", () => {
    const cd = { card4_pivot: { adjacent_roles: [{ role: "AI Product Manager" }] } };
    const m = pickMondayMove(cd);
    expect(m.action).toContain("AI Product Manager");
    expect(m.action).toContain("Naukri");
  });

  it("provides a safe default when nothing is present", () => {
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

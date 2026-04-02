/**
 * LLM-02 REGRESSION SUITE — Step 3 JSON schema validation
 * ─────────────────────────────────────────────────────────
 * Validates the validateStep3() shape-checker from enrich-report edge function.
 * Replicates the exact logic to unit-test it without needing an edge function call.
 *
 * Covers:
 *  - Valid payload passes all checks
 *  - Each individual missing/invalid field triggers rejection
 *  - indianFoodSwaps shape validation (array, length, nested fields)
 *  - urgencyLevel enum exhaustion
 *  - doctorReferralTriggers type safety
 *  - Whitespace-only strings (trim edge case)
 *  - Empty arrays
 *  - Partial objects
 *  - null / undefined / non-object inputs
 */
import { describe, it, expect } from "vitest";

// ─── Exact replica of validateStep3() from enrich-report/index.ts ─────────────
function validateStep3(parsed: unknown): parsed is Record<string, unknown> {
  if (!parsed || typeof parsed !== "object") return false;
  const p = parsed as Record<string, unknown>;
  const VALID_URGENCY = ["immediate", "high", "moderate", "low"];
  if (typeof p.topPriority !== "string" || !p.topPriority.trim()) return false;
  if (typeof p.timeframe !== "string" || !p.timeframe.trim()) return false;
  if (!Array.isArray(p.indianFoodSwaps) || p.indianFoodSwaps.length === 0) return false;
  for (const swap of p.indianFoodSwaps) {
    if (!swap || typeof swap !== "object") return false;
    const s = swap as Record<string, unknown>;
    if (typeof s.avoid !== "string" || typeof s.replace !== "string" || typeof s.reason !== "string") return false;
  }
  if (!VALID_URGENCY.includes(p.urgencyLevel as string)) return false;
  if (!Array.isArray(p.doctorReferralTriggers) || p.doctorReferralTriggers.length === 0) return false;
  if (p.doctorReferralTriggers.some((t: unknown) => typeof t !== "string")) return false;
  if (typeof p.weeklyMilestone !== "string" || !p.weeklyMilestone.trim()) return false;
  return true;
}

// ─── Valid canonical payload ─────────────────────────────────────────────────
const VALID_PAYLOAD = {
  topPriority: "Increase iron intake through ragi and green leafy vegetables daily",
  timeframe: "6-10 weeks of consistent dietary change",
  indianFoodSwaps: [
    { avoid: "White rice at lunch", replace: "Ragi roti", reason: "Ragi has 3x more iron than wheat and improves haemoglobin" },
    { avoid: "Packaged juice", replace: "Amla juice", reason: "Vitamin C in amla triples iron absorption from plant sources" },
    { avoid: "Tea with meals", replace: "Water or lassi", reason: "Tannins in tea block iron absorption by 50% when drunk with food" },
  ],
  urgencyLevel: "high",
  doctorReferralTriggers: [
    "If pallor persists beyond 8 weeks despite dietary changes",
    "If child's focus problems worsen after 4 weeks of intervention",
  ],
  weeklyMilestone: "Check if child can read for 25 uninterrupted minutes by week 4",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LLM-02 — Step 3 JSON shape validator", () => {

  describe("Valid payload", () => {
    it("canonical valid payload passes validation", () => {
      expect(validateStep3(VALID_PAYLOAD)).toBe(true);
    });

    it("single food swap is valid (length=1 is minimum)", () => {
      const p = {
        ...VALID_PAYLOAD,
        indianFoodSwaps: [{ avoid: "Tea", replace: "Water", reason: "Blocks iron" }],
      };
      expect(validateStep3(p)).toBe(true);
    });

    it("single doctorReferralTrigger is valid (length=1 is minimum)", () => {
      const p = { ...VALID_PAYLOAD, doctorReferralTriggers: ["See doctor if pallor"] };
      expect(validateStep3(p)).toBe(true);
    });

    it("all 4 urgencyLevel enum values pass", () => {
      for (const level of ["immediate", "high", "moderate", "low"]) {
        expect(validateStep3({ ...VALID_PAYLOAD, urgencyLevel: level })).toBe(true);
      }
    });
  });

  describe("Non-object inputs", () => {
    it("null → false", () => expect(validateStep3(null)).toBe(false));
    it("undefined → false", () => expect(validateStep3(undefined)).toBe(false));
    it("string → false", () => expect(validateStep3("some string")).toBe(false));
    it("number → false", () => expect(validateStep3(42)).toBe(false));
    it("array → false", () => expect(validateStep3([])).toBe(false));
    it("empty object → false", () => expect(validateStep3({})).toBe(false));
  });

  describe("topPriority validation", () => {
    it("missing topPriority → false", () => {
      const { topPriority, ...rest } = VALID_PAYLOAD;
      expect(validateStep3(rest)).toBe(false);
    });
    it("empty string topPriority → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, topPriority: "" })).toBe(false);
    });
    it("whitespace-only topPriority → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, topPriority: "   " })).toBe(false);
    });
    it("number topPriority → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, topPriority: 123 })).toBe(false);
    });
  });

  describe("timeframe validation", () => {
    it("missing timeframe → false", () => {
      const { timeframe, ...rest } = VALID_PAYLOAD;
      expect(validateStep3(rest)).toBe(false);
    });
    it("empty timeframe → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, timeframe: "" })).toBe(false);
    });
    it("whitespace-only timeframe → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, timeframe: "  \t  " })).toBe(false);
    });
  });

  describe("indianFoodSwaps validation", () => {
    it("missing indianFoodSwaps → false", () => {
      const { indianFoodSwaps, ...rest } = VALID_PAYLOAD;
      expect(validateStep3(rest)).toBe(false);
    });
    it("empty array → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, indianFoodSwaps: [] })).toBe(false);
    });
    it("non-array → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, indianFoodSwaps: "ragi" })).toBe(false);
    });
    it("array with null item → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, indianFoodSwaps: [null] })).toBe(false);
    });
    it("array with string item → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, indianFoodSwaps: ["ragi roti"] })).toBe(false);
    });
    it("swap missing 'avoid' field → false", () => {
      const badSwap = { replace: "Ragi", reason: "Iron source" };
      expect(validateStep3({ ...VALID_PAYLOAD, indianFoodSwaps: [badSwap] })).toBe(false);
    });
    it("swap missing 'replace' field → false", () => {
      const badSwap = { avoid: "White rice", reason: "High GI" };
      expect(validateStep3({ ...VALID_PAYLOAD, indianFoodSwaps: [badSwap] })).toBe(false);
    });
    it("swap missing 'reason' field → false", () => {
      const badSwap = { avoid: "White rice", replace: "Ragi" };
      expect(validateStep3({ ...VALID_PAYLOAD, indianFoodSwaps: [badSwap] })).toBe(false);
    });
    it("swap with number 'avoid' → false", () => {
      const badSwap = { avoid: 42, replace: "Ragi", reason: "Iron" };
      expect(validateStep3({ ...VALID_PAYLOAD, indianFoodSwaps: [badSwap] })).toBe(false);
    });
    it("first swap valid, second swap invalid → entire payload fails", () => {
      const mixed = [
        { avoid: "Tea", replace: "Water", reason: "Blocks iron" },
        { avoid: "Rice", replace: 999, reason: "test" }, // number replace
      ];
      expect(validateStep3({ ...VALID_PAYLOAD, indianFoodSwaps: mixed })).toBe(false);
    });
  });

  describe("urgencyLevel validation", () => {
    it("missing urgencyLevel → false", () => {
      const { urgencyLevel, ...rest } = VALID_PAYLOAD;
      expect(validateStep3(rest)).toBe(false);
    });
    it("'critical' is not a valid urgencyLevel → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, urgencyLevel: "critical" })).toBe(false);
    });
    it("'urgent' is not a valid urgencyLevel → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, urgencyLevel: "urgent" })).toBe(false);
    });
    it("empty string urgencyLevel → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, urgencyLevel: "" })).toBe(false);
    });
    it("uppercase 'HIGH' is not valid (case-sensitive) → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, urgencyLevel: "HIGH" })).toBe(false);
    });
  });

  describe("doctorReferralTriggers validation", () => {
    it("missing doctorReferralTriggers → false", () => {
      const { doctorReferralTriggers, ...rest } = VALID_PAYLOAD;
      expect(validateStep3(rest)).toBe(false);
    });
    it("empty array → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, doctorReferralTriggers: [] })).toBe(false);
    });
    it("array with number → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, doctorReferralTriggers: [42] })).toBe(false);
    });
    it("array with null → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, doctorReferralTriggers: [null] })).toBe(false);
    });
    it("mixed valid + invalid → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, doctorReferralTriggers: ["valid", 99] })).toBe(false);
    });
    it("non-array string → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, doctorReferralTriggers: "see doctor" })).toBe(false);
    });
  });

  describe("weeklyMilestone validation", () => {
    it("missing weeklyMilestone → false", () => {
      const { weeklyMilestone, ...rest } = VALID_PAYLOAD;
      expect(validateStep3(rest)).toBe(false);
    });
    it("empty string → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, weeklyMilestone: "" })).toBe(false);
    });
    it("whitespace-only → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, weeklyMilestone: "   " })).toBe(false);
    });
    it("number → false", () => {
      expect(validateStep3({ ...VALID_PAYLOAD, weeklyMilestone: 7 })).toBe(false);
    });
  });

  describe("JSON string parsing (simulates actual edge function flow)", () => {
    it("valid JSON string round-trips through parse + validate", () => {
      const json = JSON.stringify(VALID_PAYLOAD);
      const parsed = JSON.parse(json);
      expect(validateStep3(parsed)).toBe(true);
    });

    it("LLM markdown fence stripping works before validation", () => {
      const fenced = "```json\n" + JSON.stringify(VALID_PAYLOAD) + "\n```";
      const cleaned = fenced.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      expect(validateStep3(JSON.parse(cleaned))).toBe(true);
    });

    it("malformed JSON triggers parse error (not validate)", () => {
      expect(() => JSON.parse("{bad json}")).toThrow();
    });
  });
});

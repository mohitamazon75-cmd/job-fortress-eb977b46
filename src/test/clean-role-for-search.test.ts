import { describe, it, expect } from "vitest";
import { cleanRoleForSearch } from "@/lib/clean-role-for-search";

describe("cleanRoleForSearch", () => {
  describe("falsy / non-string input", () => {
    it("returns fallback for undefined", () => {
      expect(cleanRoleForSearch(undefined)).toBe("professional");
    });
    it("returns fallback for null", () => {
      expect(cleanRoleForSearch(null)).toBe("professional");
    });
    it("returns fallback for non-string", () => {
      expect(cleanRoleForSearch(42 as unknown)).toBe("professional");
    });
    it("returns fallback for empty string", () => {
      expect(cleanRoleForSearch("")).toBe("professional");
    });
    it("returns fallback for whitespace-only", () => {
      expect(cleanRoleForSearch("   ")).toBe("professional");
    });
    it("respects custom fallback", () => {
      expect(cleanRoleForSearch("", "manager")).toBe("manager");
    });
  });

  describe("delimiter splitting (the core P1-Fix-D bug)", () => {
    // These exact strings were observed in production scans on 2026-05-02
    // and produced 0 Adzuna results before the fix.
    it("splits on pipe", () => {
      expect(cleanRoleForSearch("Senior Manager | Strategic Accounts")).toBe("Senior Manager");
    });
    it("splits on slash", () => {
      expect(cleanRoleForSearch("Software Engineer / Backend")).toBe("Software Engineer");
    });
    it("splits on ampersand", () => {
      expect(cleanRoleForSearch("Marketing & Growth")).toBe("Marketing");
    });
    it("splits on en-dash", () => {
      expect(cleanRoleForSearch("Senior Manager – BD")).toBe("Senior Manager");
    });
    it("splits on em-dash", () => {
      expect(cleanRoleForSearch("Director — Strategy")).toBe("Director");
    });
    it("splits on hyphen", () => {
      expect(cleanRoleForSearch("Marketing Manager - B2B SaaS")).toBe("Marketing Manager");
    });
    it("splits on parenthesis", () => {
      expect(cleanRoleForSearch("Account Executive (Enterprise)")).toBe("Account Executive");
    });
    it("splits on bracket", () => {
      expect(cleanRoleForSearch("Product Manager [Growth]")).toBe("Product Manager");
    });
    it("splits on comma", () => {
      expect(cleanRoleForSearch("CTO, India")).toBe("CTO");
    });
    it("handles the worst-case real example", () => {
      expect(
        cleanRoleForSearch("Senior Manager – BD | Strategic Accounts (Pune)"),
      ).toBe("Senior Manager");
    });
  });

  describe("decoration word stripping", () => {
    it("strips trailing 'professional'", () => {
      expect(cleanRoleForSearch("Marketing Professional")).toBe("Marketing");
    });
    it("strips trailing 'specialist'", () => {
      expect(cleanRoleForSearch("Tax Specialist")).toBe("Tax");
    });
    it("strips trailing 'consultant'", () => {
      expect(cleanRoleForSearch("HR Consultant")).toBe("HR");
    });
    it("strips trailing 'generalist'", () => {
      expect(cleanRoleForSearch("HR Generalist")).toBe("HR");
    });
    it("does NOT strip when role IS a decoration word", () => {
      // "Consultant" alone is a valid role title — don't kill it
      expect(cleanRoleForSearch("Consultant")).toBe("Consultant");
    });
    it("does NOT strip leading occurrence", () => {
      expect(cleanRoleForSearch("Specialist Counsel")).toBe("Specialist Counsel");
    });
    it("strips decoration with trailing punctuation", () => {
      expect(cleanRoleForSearch("Marketing Professional.")).toBe("Marketing");
    });
  });

  describe("whitespace + length normalisation", () => {
    it("collapses internal whitespace", () => {
      expect(cleanRoleForSearch("Software   Engineer")).toBe("Software Engineer");
    });
    it("trims surrounding whitespace", () => {
      expect(cleanRoleForSearch("  Data Analyst  ")).toBe("Data Analyst");
    });
    it("caps very long input at 80 chars", () => {
      const long = "Senior ".repeat(20) + "Engineer";
      const result = cleanRoleForSearch(long);
      expect(result.length).toBeLessThanOrEqual(80);
    });
    it("returns fallback on single-char results", () => {
      expect(cleanRoleForSearch("A | foo")).toBe("professional");
    });
  });

  describe("idempotence (clean output passes through unchanged)", () => {
    const cleanRoles = [
      "Software Engineer",
      "Marketing Manager",
      "CTO",
      "Data Scientist",
      "Account Executive",
    ];
    for (const r of cleanRoles) {
      it(`is idempotent for "${r}"`, () => {
        expect(cleanRoleForSearch(cleanRoleForSearch(r))).toBe(r);
      });
    }
  });
});

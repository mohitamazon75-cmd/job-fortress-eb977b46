import { describe, it, expect } from "vitest";
import { buildAnswer } from "@/components/model-b/CopyInterviewAnswer";

describe("CopyInterviewAnswer.buildAnswer", () => {
  it("includes the gap title and role in the STAR template", () => {
    const out = buildAnswer("Cloud architecture", "Backend Engineer");
    expect(out).toContain("Cloud architecture");
    expect(out).toContain("Backend Engineer");
    expect(out).toContain("SITUATION");
    expect(out).toContain("TASK");
    expect(out).toContain("ACTION");
    expect(out).toContain("RESULT");
  });

  it("personalizes the header when firstName is provided", () => {
    const out = buildAnswer("ML Ops", "Data Scientist", "Farheen");
    expect(out).toContain("Interview answer template — Farheen");
  });

  it("falls back to a generic header when firstName is missing or blank", () => {
    expect(buildAnswer("ML Ops", "Data Scientist")).toContain("Interview answer template\n");
    expect(buildAnswer("ML Ops", "Data Scientist", "   ")).toContain("Interview answer template\n");
  });

  it("uses a safe role placeholder when role is empty", () => {
    const out = buildAnswer("AI safety", "");
    expect(out).toContain("your role");
  });

  it("always ends with the JobBachao source attribution", () => {
    const out = buildAnswer("anything", "anyone");
    expect(out.trim().endsWith("jobbachao.com career scan")).toBe(true);
  });
});

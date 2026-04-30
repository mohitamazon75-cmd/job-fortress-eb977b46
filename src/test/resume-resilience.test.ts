import { describe, it, expect, beforeEach } from "vitest";

// We can't import the Deno edge module directly into vitest because of
// `Deno.env.get`. Inline-replicate the pure helpers under test instead.
// This is the same pattern used by other edge-fn unit tests in this repo
// (e.g. referral-templates.test.ts) — pure logic gets locked here.

// ─────────────────────────────────────────────────────────────────
// Replica of extractRoleFromOcrText from resume-ocr-fallback.ts
// (pure function, no Deno dependencies)
// ─────────────────────────────────────────────────────────────────
function extractRoleFromOcrText(text: string): string | null {
  if (!text || typeof text !== "string") return null;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const labelPatterns = [
    /^(?:current\s+role|current\s+title|job\s+title|title|position|designation)\s*[:\-—]\s*(.+)$/i,
  ];

  for (const line of lines.slice(0, 30)) {
    for (const pattern of labelPatterns) {
      const m = line.match(pattern);
      if (m && m[1]) {
        const candidate = m[1].trim().replace(/[.,;|].*$/, "").trim();
        if (candidate.length >= 3 && candidate.length <= 80) return candidate;
      }
    }
  }

  const roleWords = /\b(manager|engineer|developer|analyst|consultant|director|lead|architect|designer|specialist|head|founder|cto|ceo|cfo|coo|vp|president|associate|senior|principal|staff|junior|intern)\b/i;
  for (const line of lines.slice(1, 5)) {
    if (line.length >= 3 && line.length <= 80 && roleWords.test(line)) {
      if (/@/.test(line) || /https?:\/\//.test(line) || /^\+?\d[\d\s\-()]{6,}$/.test(line)) continue;
      return line.replace(/[.,;|].*$/, "").trim();
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────
// Replica of the Affinda circuit breaker state machine
// (pure logic from affinda-parser.ts)
// ─────────────────────────────────────────────────────────────────
const AFFINDA_BREAKER_THRESHOLD = 5;
const AFFINDA_BREAKER_COOLDOWN_MS = 5 * 60 * 1000;

function makeBreaker() {
  const state = { consecutiveFailures: 0, openUntilMs: 0 };
  return {
    isOpen: () => Date.now() < state.openUntilMs,
    recordSuccess: () => { state.consecutiveFailures = 0; state.openUntilMs = 0; },
    recordFailure: () => {
      state.consecutiveFailures += 1;
      if (state.consecutiveFailures >= AFFINDA_BREAKER_THRESHOLD) {
        state.openUntilMs = Date.now() + AFFINDA_BREAKER_COOLDOWN_MS;
      }
    },
    state: () => ({ ...state }),
  };
}

function isRetryable(status: number | null, errName?: string): boolean {
  if (errName === "AbortError") return true;
  if (status === null) return true;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────
describe("extractRoleFromOcrText", () => {
  it("returns null for empty/null input", () => {
    expect(extractRoleFromOcrText("")).toBeNull();
    expect(extractRoleFromOcrText(null as any)).toBeNull();
    expect(extractRoleFromOcrText(undefined as any)).toBeNull();
  });

  it("extracts role from 'Current Role:' label", () => {
    const text = "John Doe\nCurrent Role: Senior Manager - Business Development\nMumbai";
    expect(extractRoleFromOcrText(text)).toBe("Senior Manager - Business Development");
  });

  it("extracts role from 'Title:' label case-insensitively", () => {
    const text = "Jane Smith\ntitle: Engineering Manager\nBangalore";
    expect(extractRoleFromOcrText(text)).toBe("Engineering Manager");
  });

  it("extracts role from 'Designation:' label", () => {
    const text = "Designation: Principal Architect\n";
    expect(extractRoleFromOcrText(text)).toBe("Principal Architect");
  });

  it("falls back to line 2 if it looks like a job title", () => {
    const text = "Abhinav Bhattacharya\nSenior Manager Business Development\nMumbai, India\nabhinav@example.com";
    expect(extractRoleFromOcrText(text)).toBe("Senior Manager Business Development");
  });

  it("ignores email lines in fallback", () => {
    const text = "Name\nabhinav@example.com\nSoftware Engineer at Google";
    // line 2 is email (skipped), line 3 has 'engineer' role word and is short enough
    expect(extractRoleFromOcrText(text)).toBe("Software Engineer at Google");
  });

  it("ignores URL lines in fallback", () => {
    const text = "Name\nhttps://linkedin.com/in/abhinav\nLead Data Scientist";
    expect(extractRoleFromOcrText(text)).toBe("Lead Data Scientist");
  });

  it("ignores phone-only lines in fallback", () => {
    const text = "Name\n+91 98765 43210\nProduct Manager";
    expect(extractRoleFromOcrText(text)).toBe("Product Manager");
  });

  it("returns null when no role pattern matches", () => {
    const text = "Random text\nWith no job title hints\nJust some content";
    expect(extractRoleFromOcrText(text)).toBeNull();
  });

  it("rejects roles that are too short (<3 chars)", () => {
    const text = "Role: AB";
    expect(extractRoleFromOcrText(text)).toBeNull();
  });

  it("rejects roles that are too long (>80 chars)", () => {
    const longRole = "A".repeat(85);
    const text = `Role: ${longRole}`;
    expect(extractRoleFromOcrText(text)).toBeNull();
  });

  it("strips trailing punctuation/separators", () => {
    const text = "Title: Senior Engineer, Backend Team";
    expect(extractRoleFromOcrText(text)).toBe("Senior Engineer");
  });
});

describe("Affinda circuit breaker", () => {
  let breaker: ReturnType<typeof makeBreaker>;

  beforeEach(() => {
    breaker = makeBreaker();
  });

  it("starts closed", () => {
    expect(breaker.isOpen()).toBe(false);
    expect(breaker.state().consecutiveFailures).toBe(0);
  });

  it("opens after threshold consecutive failures", () => {
    for (let i = 0; i < AFFINDA_BREAKER_THRESHOLD; i++) breaker.recordFailure();
    expect(breaker.isOpen()).toBe(true);
    expect(breaker.state().consecutiveFailures).toBe(AFFINDA_BREAKER_THRESHOLD);
  });

  it("stays closed below threshold", () => {
    for (let i = 0; i < AFFINDA_BREAKER_THRESHOLD - 1; i++) breaker.recordFailure();
    expect(breaker.isOpen()).toBe(false);
  });

  it("resets on success", () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();
    expect(breaker.state().consecutiveFailures).toBe(0);
    expect(breaker.isOpen()).toBe(false);
  });

  it("reopens after success then more failures", () => {
    for (let i = 0; i < AFFINDA_BREAKER_THRESHOLD; i++) breaker.recordFailure();
    expect(breaker.isOpen()).toBe(true);
    breaker.recordSuccess();
    expect(breaker.isOpen()).toBe(false);
    for (let i = 0; i < AFFINDA_BREAKER_THRESHOLD; i++) breaker.recordFailure();
    expect(breaker.isOpen()).toBe(true);
  });
});

describe("isRetryable classifier", () => {
  it("retries timeouts (AbortError)", () => {
    expect(isRetryable(null, "AbortError")).toBe(true);
  });

  it("retries network errors (status=null)", () => {
    expect(isRetryable(null)).toBe(true);
  });

  it("retries 429 rate-limit", () => {
    expect(isRetryable(429)).toBe(true);
  });

  it("retries 5xx server errors", () => {
    expect(isRetryable(500)).toBe(true);
    expect(isRetryable(502)).toBe(true);
    expect(isRetryable(503)).toBe(true);
    expect(isRetryable(504)).toBe(true);
  });

  it("does NOT retry 4xx client errors (auth/quota/bad req)", () => {
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable(401)).toBe(false);
    expect(isRetryable(403)).toBe(false);
    expect(isRetryable(404)).toBe(false);
    expect(isRetryable(422)).toBe(false);
  });

  it("does NOT retry 2xx (caller shouldn't ask, but be safe)", () => {
    expect(isRetryable(200)).toBe(false);
  });
});

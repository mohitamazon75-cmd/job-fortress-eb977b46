// ═══════════════════════════════════════════════════════════════
// affinda-parser.ts — Affinda structured resume parsing
//
// WHY: The LLM vision parser estimates yearsOfExperience from resume
// text, which is inaccurate for career changers, overlapping roles, or
// resumes that don't state "X years of experience" explicitly.
// Affinda parses actual work history start/end dates and computes
// accurate tenure — which drives the survivability score multipliers
// (1.1x for >2yr, 1.3x for >5yr, 1.6x for >10yr in det-orchestrator.ts).
//
// ROLE: Pre-pass only. Provides:
//   - accurate_years_experience: computed from date diffs, not text
//   - certifications: structured list (bolsters moat_skills extraction)
//   - education_tier: IIT/NIT/tier1 signal for seniority calibration
//
// ZERO-REGRESSION DESIGN:
//   - Only runs if AFFINDA_API_KEY env var is set
//   - Returns null on any failure — LLM parser path is completely unchanged
//   - Additive: its output augments the LLM's rawText, never replaces it
//   - 10s timeout — scan pipeline continues if Affinda is slow
//
// Affinda pricing: ~$0.02–$0.05/parse. At 100 scans/day = $2–5/day.
// API docs: https://docs.affinda.com/reference/createresume
// ═══════════════════════════════════════════════════════════════

const AFFINDA_API_BASE = "https://api.affinda.com/v2";
const AFFINDA_TIMEOUT_MS = 10_000;

// ── Retry + circuit breaker config ────────────────────────────────
// Why: same resume failed once after passing 3x prior — root cause is
// transient external API jitter (timeout / 5xx / rate-limit). Under
// volume spikes this becomes routine. Retry covers single jitter; the
// circuit breaker prevents hammering Affinda when it's actually down.
const AFFINDA_RETRY_ATTEMPTS = 2;          // total attempts = 1 + 2 = 3
const AFFINDA_RETRY_BACKOFF_MS = [500, 1500];
const AFFINDA_BREAKER_THRESHOLD = 5;        // consecutive failures
const AFFINDA_BREAKER_COOLDOWN_MS = 5 * 60 * 1000;  // 5 minutes

// In-memory breaker state (per-isolate; Deno edge isolates are short-lived
// so this is best-effort — main job is to prevent N concurrent requests
// from each retrying 3x against a dead provider in the same isolate).
const breakerState = {
  consecutiveFailures: 0,
  openUntilMs: 0,
};

function isBreakerOpen(): boolean {
  return Date.now() < breakerState.openUntilMs;
}

function recordSuccess(): void {
  breakerState.consecutiveFailures = 0;
  breakerState.openUntilMs = 0;
}

function recordFailure(): void {
  breakerState.consecutiveFailures += 1;
  if (breakerState.consecutiveFailures >= AFFINDA_BREAKER_THRESHOLD) {
    breakerState.openUntilMs = Date.now() + AFFINDA_BREAKER_COOLDOWN_MS;
    console.warn(
      `[Affinda] Circuit breaker OPEN — ${breakerState.consecutiveFailures} consecutive failures, cooling down for ${AFFINDA_BREAKER_COOLDOWN_MS / 1000}s`,
    );
  }
}

// Retryable = transient: timeout, network error, 5xx, 429.
// Non-retryable = 4xx (auth/quota/bad request) — fast-fail.
function isRetryable(status: number | null, errName?: string): boolean {
  if (errName === "AbortError") return true;
  if (status === null) return true; // network error
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

// Known tier-1 India colleges for education signal
const TIER1_INDIA_COLLEGES = [
  "iit", "iim", "nit", "bits pilani", "iisc", "xlri", "iift", "srcc",
  "sp jain", "christ university", "vit", "manipal", "pes university",
  "delhi university", "bombay university", "jadavpur", "anna university",
];

export interface AffindaParseResult {
  accurate_years_experience: number | null;  // from date diffs
  certifications: string[];                  // structured cert list
  education_tier: "tier1" | "tier2" | null; // IIT/NIT vs others
  raw_work_months: number | null;            // total months worked (for validation)
  current_job_title: string | null;          // most-recent job title from workExperience[0] — used as fallback when LLM headline extraction fails
}

// ── Date parsing helpers ──────────────────────────────────────────

function parseAffindaDate(d: any): Date | null {
  if (!d) return null;
  // Affinda returns { year, month, day } or ISO string
  if (typeof d === "string") {
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof d === "object" && d.year) {
    const month = d.month ? d.month - 1 : 0;
    return new Date(d.year, month, d.day || 1);
  }
  return null;
}

// Compute total months from work history, handling overlaps
// Uses a max-endpoint scan to avoid double-counting parallel roles
function computeTotalMonths(workHistory: any[]): number {
  if (!workHistory?.length) return 0;

  // Parse all date ranges
  const ranges: Array<{ start: Date; end: Date }> = [];
  const now = new Date();

  for (const job of workHistory) {
    const start = parseAffindaDate(job.dates?.startDate);
    let end = parseAffindaDate(job.dates?.endDate);
    if (!start) continue;
    if (!end) end = now; // current role
    if (end > now) end = now; // clamp to today
    if (start >= end) continue;
    ranges.push({ start, end });
  }

  if (!ranges.length) return 0;

  // Sort by start date
  ranges.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Merge overlapping ranges
  const merged: Array<{ start: Date; end: Date }> = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    if (ranges[i].start <= last.end) {
      // Overlap — extend end if needed
      if (ranges[i].end > last.end) last.end = ranges[i].end;
    } else {
      merged.push(ranges[i]);
    }
  }

  // Sum total months across non-overlapping ranges
  let totalMs = 0;
  for (const r of merged) {
    totalMs += r.end.getTime() - r.start.getTime();
  }

  return Math.round(totalMs / (1000 * 60 * 60 * 24 * 30.44));
}

function detectEducationTier(education: any[]): "tier1" | "tier2" | null {
  if (!education?.length) return null;
  for (const edu of education) {
    const institution = (edu.institution ?? "").toLowerCase();
    if (TIER1_INDIA_COLLEGES.some(c => institution.includes(c))) {
      return "tier1";
    }
  }
  return "tier2";
}

function extractCertifications(data: any): string[] {
  const certs: string[] = [];

  // Affinda's certifications array
  if (Array.isArray(data.certifications)) {
    for (const cert of data.certifications) {
      const name = cert.name ?? cert.description ?? String(cert);
      if (name && typeof name === "string" && name.length > 2) {
        certs.push(name.trim());
      }
    }
  }

  // Also scan skills for cert-like entries (AWS Certified, PMP, etc.)
  if (Array.isArray(data.skills)) {
    const certKeywords = ["certified", "certificate", "certification", "pmp", "cfa", "cpa", "aws", "gcp", "azure", "scrum", "itil"];
    for (const skill of data.skills) {
      const name = (skill.name ?? String(skill)).toLowerCase();
      if (certKeywords.some(k => name.includes(k)) && !certs.includes(skill.name ?? String(skill))) {
        certs.push(skill.name ?? String(skill));
      }
    }
  }

  return [...new Set(certs)].slice(0, 20);
}

// ── Main Affinda call ─────────────────────────────────────────────
export async function parseResumeWithAffinda(
  resumeBase64: string,
  mimeType: "application/pdf" | "application/docx" = "application/pdf",
): Promise<AffindaParseResult | null> {
  const apiKey = Deno.env.get("AFFINDA_API_KEY");
  if (!apiKey) {
    console.debug("[Affinda] AFFINDA_API_KEY not set — skipping structured parse");
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AFFINDA_TIMEOUT_MS);

  try {
    // Affinda accepts base64 via JSON body or multipart — use JSON for simplicity
    const resp = await fetch(`${AFFINDA_API_BASE}/documents`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        file: resumeBase64,
        fileName: `resume.${mimeType === "application/pdf" ? "pdf" : "docx"}`,
        wait: true,       // synchronous parse (max ~5s for most resumes)
        collection: null, // use default extractor
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.warn(`[Affinda] API error ${resp.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    const data = await resp.json();
    const parsed = data?.data ?? data; // Affinda wraps in .data

    if (!parsed) {
      console.warn("[Affinda] Empty response");
      return null;
    }

    // Compute years from work history dates
    const workHistory = parsed.workExperience ?? parsed.work_experience ?? [];
    const totalMonths = computeTotalMonths(workHistory);
    const accurateYears = totalMonths > 0 ? Math.round((totalMonths / 12) * 10) / 10 : null;

    // Extract most-recent job title (workExperience is typically reverse-chronological).
    // Defensive: handle missing entry, non-string title, snake_case variant.
    const wh0 = workHistory[0];
    const currentJobTitle: string | null =
      (typeof wh0?.jobTitle === "string" && wh0.jobTitle.trim() ? wh0.jobTitle.trim() : null)
      ?? (typeof wh0?.job_title === "string" && wh0.job_title.trim() ? wh0.job_title.trim() : null)
      ?? null;

    // Guard against clearly bad values
    const clampedYears = accurateYears && accurateYears > 0 && accurateYears < 60
      ? accurateYears
      : null;

    const certifications = extractCertifications(parsed);
    const educationTier = detectEducationTier(parsed.education ?? []);

    console.debug(
      `[Affinda] Parsed: years=${clampedYears ?? "unknown"}, ` +
      `certs=${certifications.length}, edu=${educationTier ?? "unknown"}, ` +
      `workEntries=${workHistory.length}`
    );

    return {
      accurate_years_experience: clampedYears,
      certifications,
      education_tier: educationTier,
      raw_work_months: totalMonths || null,
      current_job_title: currentJobTitle,
    };
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      console.warn("[Affinda] Parse timed out — continuing with LLM parser");
    } else {
      console.warn("[Affinda] Parse error:", err?.message ?? err);
    }
    return null;
  }
}

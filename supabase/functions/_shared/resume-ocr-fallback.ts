// ═══════════════════════════════════════════════════════════════
// resume-ocr-fallback.ts — Last-resort PDF text extraction via
// Gemini Vision (multimodal).
//
// WHY: For scans where:
//   • Affinda failed (down/timeout/breaker open), AND
//   • Primary Gemini text-extract returned empty/malformed JSON, AND
//   • No prior artifact exists for this user+filename
// …we still need SOME text so Agent1 has input. Without this, the
// scan dies and the user sees a generic "couldn't parse" error.
//
// CONTRACT:
//   - Input: base64-encoded PDF bytes
//   - Output: string of extracted text (may be partial), or null on failure
//   - Uses Gemini 2.5 Flash via Lovable AI gateway (cheap + fast)
//   - 25s timeout (longer than primary because OCR-style extraction)
//
// ZERO REGRESSION: Only invoked from buildAffindaFallback as the LAST
// resort BEFORE artifact_cache (so cached fallback still wins for
// returning users). Failure → null → caller proceeds to artifact_cache
// → final fail-closed. No code path is removed.
// ═══════════════════════════════════════════════════════════════

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OCR_TIMEOUT_MS = 25_000;
const OCR_MODEL = "google/gemini-2.5-flash";

const OCR_SYSTEM_PROMPT =
  "You are a PDF text extractor. Extract ALL readable text from this resume document, " +
  "preserving order top-to-bottom. Include name, contact info, all job titles with " +
  "company names and dates, all bullet points, all skills, all education entries, " +
  "and all certifications. Return ONLY the extracted plain text — no markdown, " +
  "no commentary, no JSON wrapping. If the document is unreadable, return the literal " +
  "string 'EXTRACTION_FAILED'.";

export interface OcrFallbackResult {
  text: string;
  charCount: number;
  letterCount: number;
}

/**
 * Last-resort OCR via Gemini Vision. Returns null on any failure
 * or low-quality output (so caller can chain to artifact_cache).
 */
export async function extractResumeTextViaVisionOcr(
  resumeBase64: string,
  apiKey: string,
): Promise<OcrFallbackResult | null> {
  if (!apiKey || !resumeBase64) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
    const resp = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OCR_MODEL,
        messages: [
          { role: "system", content: OCR_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract all text from this resume PDF." },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${resumeBase64}`,
                },
              },
            ],
          },
        ],
        temperature: 0,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.warn(`[OCR-Fallback] Gateway error ${resp.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content.trim() : "";

    if (!text || text === "EXTRACTION_FAILED") {
      console.warn("[OCR-Fallback] Empty or EXTRACTION_FAILED returned by Vision model");
      return null;
    }

    // Quality gate (matches lovable-stack-overflow heuristic):
    // <500 chars or <100 letters means we got noise/garbage, not text.
    const letterCount = (text.match(/[a-zA-Z]/g) ?? []).length;
    if (text.length < 500 || letterCount < 100) {
      console.warn(`[OCR-Fallback] Low-quality output: ${text.length} chars, ${letterCount} letters — discarding`);
      return null;
    }

    console.log(`[OCR-Fallback] Vision OCR succeeded: ${text.length} chars, ${letterCount} letters`);
    return { text, charCount: text.length, letterCount };
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      console.warn("[OCR-Fallback] Vision OCR timed out");
    } else {
      console.warn("[OCR-Fallback] Vision OCR error:", err?.message ?? err);
    }
    return null;
  }
}

/**
 * Heuristic to extract a job title from OCR'd resume text. Used
 * when Vision returns text but we still need a roleSource. Looks for
 * common resume patterns: "Title: X", "Current Role: X", first line
 * after the name, etc. Returns null if nothing confident is found.
 *
 * Pure function — exported for testability.
 */
export function extractRoleFromOcrText(text: string): string | null {
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

  // Fallback: if line 2 or 3 looks like a job title (has common role words)
  // and is short enough, use it. Common pattern: "Name\nRole\nLocation".
  const roleWords = /\b(manager|engineer|developer|analyst|consultant|director|lead|architect|designer|specialist|head|founder|cto|ceo|cfo|coo|vp|president|associate|senior|principal|staff|junior|intern)\b/i;
  for (const line of lines.slice(1, 5)) {
    if (line.length >= 3 && line.length <= 80 && roleWords.test(line)) {
      // Sanity: must not be an email, URL, phone, or all-caps shouting
      if (/@/.test(line) || /https?:\/\//.test(line) || /^\+?\d[\d\s\-()]{6,}$/.test(line)) continue;
      return line.replace(/[.,;|].*$/, "").trim();
    }
  }

  return null;
}

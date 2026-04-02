/**
 * Integration Test — enrich-report: 3-step clinical synthesis pipeline
 *
 * Auth strategy:
 *   Primary:  Service role key (SUPABASE_SERVICE_ROLE_KEY) — creates + confirms
 *             a fresh disposable test user per run, deletes after.
 *   Fallback: Pre-seeded CI user (PIPELINE_TEST_EMAIL / PIPELINE_TEST_PASS env vars)
 *             whose email is already confirmed in the database.
 *
 * Pipeline assertions:
 *  ✓ HTTP 200
 *  ✓ clinicalNarrative  — non-empty string, references ≥3 clinical domains (Step 1)
 *  ✓ parentSummary      — ≤200 words, jargon-free (Step 2, Golden Standard)
 *  ✓ structuredIntervention JSON shape:
 *      topPriority · timeframe · urgencyLevel · indianFoodSwaps[≥1] · doctorReferralTriggers
 *  ✓ enrichment         — legacy compat object (interventions, weeklyActions, etc.)
 *  ✓ generatedAt        — ISO 8601 timestamp
 *  ✓ model              — string containing "gemini"
 *  ✓ Cache hit          — second identical call returns cached:true with all 3 keys
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
// Also load test-specific credentials if .env.test exists
try { await import("https://deno.land/std@0.224.0/dotenv/load.ts"); } catch { /* ok */ }
const _testEnvPath = new URL(".env.test", import.meta.url).pathname;
try {
  const raw = await Deno.readTextFile(_testEnvPath).catch(() => "");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && m[2].trim()) Deno.env.set(m[1], m[2].trim());
  }
} catch { /* .env.test is optional */ }
import {
  assertEquals,
  assertExists,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const PROJECT_ID  = Deno.env.get("VITE_SUPABASE_PROJECT_ID")!;
const ANON_KEY    = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? null;

// Optional: pre-seeded CI credentials (confirm email manually or via DB update)
const CI_EMAIL = Deno.env.get("PIPELINE_TEST_EMAIL") ?? null;
const CI_PASS  = Deno.env.get("PIPELINE_TEST_PASS")  ?? null;

const SUPABASE_URL = `https://${PROJECT_ID}.supabase.co`;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/enrich-report`;

// ─── Full realistic payload (7-year-old Indian vegetarian boy, Pune) ─────────
const FULL_PAYLOAD = {
  reportSummary: `
Arjun is a 7-year-old vegetarian boy from Pune (Tier 1 city).
Physical: balance 28th percentile, coordination 55th, endurance 48th.
Cognitive: attention 32nd percentile, memory 61st, processing 44th, reasoning 58th.
Nutritional: iron 21st percentile, calcium 38th, protein 52nd, vitamin D 19th.
Wellbeing: anxiety index 48, stress 42, emotional wellbeing 55th percentile.
Screen time: 4 hours/day. Outdoor play: 20 min/day.
Diet: dal 3x/week, ragi rarely, minimal leafy greens, daily dairy.
  `.trim(),
  childAge: 7,
  childGender: "male",
  dietType: "vegetarian",
  topConcerns: [
    { domain: "Nutrition", metric: "iron",      score: 21 },
    { domain: "Nutrition", metric: "vitaminD",  score: 19 },
    { domain: "Cognitive", metric: "attention", score: 32 },
    { domain: "Physical",  metric: "balance",   score: 28 },
  ],
  hiddenPatterns: [
    {
      title: "Iron-Dopamine-Attention Link",
      probability: 76,
      description: "Sub-optimal iron (21st percentile) + attention (32nd) matches the iron→dopamine→PFC pathway (Lozoff 2006).",
    },
    {
      title: "Vitamin D – Bone & Immune Gap",
      probability: 68,
      description: "Vitamin D at 19th percentile with <30 min outdoor play; IAP 2017 bone mineralisation risk.",
    },
  ],
  risks: [
    { name: "Iron Deficiency",         riskProbability: 71, preventability: 88 },
    { name: "Vitamin D Insufficiency", riskProbability: 64, preventability: 92 },
    { name: "Attention difficulties",  riskProbability: 44, preventability: 75 },
  ],
  algorithmOutputs: {
    phenotypicProfile: { label: "Developing Explorer", description: "Strong memory; attention and nutrition need focus." },
    latentHealthScore: { lhs: 47 },
    bayesianPosteriors: [
      { condition: "Iron deficiency",         posterior: 0.71, prior: 0.35 },
      { condition: "Vitamin D insufficiency", posterior: 0.64, prior: 0.30 },
    ],
    patternActivations: [
      { pattern: "Iron-Dopamine-PFC",    confidence: 0.76 },
      { pattern: "Screen-Attention Loop", confidence: 0.58 },
    ],
    mediationResults: [{ mediator: "iron", outcome: "attention", effect: -0.32 }],
    developmentalAge: { physical: 6.4, cognitive: 7.2, overall: 6.8 },
    convergenceScore: 0.74,
    topInterventions: [
      { id: "iron-vit-c",    priority: "immediate", label: "Add Vitamin C with every iron-rich meal" },
      { id: "outdoor-play",  priority: "high",      label: "30 min outdoor play before 10am for Vitamin D" },
      { id: "screen-limits", priority: "moderate",  label: "Cap screen time at 1 hour/day" },
    ],
  },
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────
interface TestSession {
  userId?: string;
  accessToken: string;
  disposable: boolean; // if true, delete user after test
}

async function signIn(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return data?.access_token ?? null;
}

async function getSession(): Promise<TestSession | null> {
  // Strategy 1: service role → create fresh confirmed test user
  if (SERVICE_KEY) {
    const ts    = Date.now();
    const email = `pipeline-ci-${ts}@kidvital-test.invalid`;
    const pass  = `CiPass${ts}!`;

    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY },
      body: JSON.stringify({ email, password: pass, email_confirm: true }),
    });
    const created = await createRes.json();
    if (created.id) {
      const token = await signIn(email, pass);
      if (token) {
        console.log(`[auth] Disposable user created: ${email.slice(0, 20)}… → token OK`);
        return { userId: created.id, accessToken: token, disposable: true };
      }
    }
    console.warn("[auth] Service role user creation failed:", JSON.stringify(created).slice(0, 100));
  }

  // Strategy 2: pre-seeded CI credentials in env
  if (CI_EMAIL && CI_PASS) {
    const token = await signIn(CI_EMAIL, CI_PASS);
    if (token) {
      console.log(`[auth] Signed in with CI credentials: ${CI_EMAIL}`);
      return { accessToken: token, disposable: false };
    }
    console.warn("[auth] CI credentials sign-in failed");
  }

  console.warn("[auth] No auth strategy succeeded — pipeline tests will be skipped gracefully");
  return null;
}

async function cleanupSession(session: TestSession | null): Promise<void> {
  if (!session?.disposable || !session.userId || !SERVICE_KEY) return;
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${session.userId}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY },
  });
  console.log(`[teardown] Deleted disposable user ${session.userId.slice(0, 8)}…`);
}

// ─── Test 1: Full 3-step pipeline ─────────────────────────────────────────────
Deno.test({
  name: "enrich-report [pipeline]: 3-step synthesis returns clinicalNarrative + parentSummary + structuredIntervention",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const session = await getSession();
    if (!session) {
      console.warn("⚠ Skipping: no authenticated session available (add SUPABASE_SERVICE_ROLE_KEY or PIPELINE_TEST_EMAIL to .env)");
      return;
    }

    try {
      console.log("\n[pipeline] Calling enrich-report — Arjun, 7yo, vegetarian, Pune…");
      const t0 = Date.now();

      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.accessToken}`,
          "apikey": ANON_KEY,
        },
        body: JSON.stringify(FULL_PAYLOAD),
      });

      const elapsed = Date.now() - t0;
      console.log(`[pipeline] HTTP ${res.status} in ${elapsed}ms`);

      if (res.status === 429) { await res.text(); console.warn("⚠ Rate limit — skip assertions"); return; }
      if (res.status === 402) { await res.text(); console.warn("⚠ AI credits — skip assertions"); return; }

      const body = await res.json();
      assertEquals(res.status, 200, `Expected 200: ${JSON.stringify(body).slice(0, 300)}`);
      console.log(`✓ HTTP 200 ${body.cached ? "(cache hit)" : "(live 3-step generation)"}`);

      // ── All top-level keys ────────────────────────────────────────────────
      for (const key of ["clinicalNarrative", "parentSummary", "structuredIntervention", "enrichment", "generatedAt", "model"]) {
        assertExists((body as Record<string, unknown>)[key], `Missing top-level key: '${key}'`);
      }
      console.log("✓ All 6 top-level keys present");

      const { clinicalNarrative, parentSummary, structuredIntervention, enrichment, generatedAt, model } = body;

      // ─────────────────────────────────────────────────────────────────────
      // STEP 1 — clinicalNarrative (Gemini Pro)
      // ─────────────────────────────────────────────────────────────────────
      assert(typeof clinicalNarrative === "string" && clinicalNarrative.length >= 50,
        `clinicalNarrative must be ≥50 chars (got ${clinicalNarrative?.length ?? 0})`);

      const clinTerms = ["iron","attention","vitamin","physical","cognitive","nutrition","development","percentile","deficiency","risk"];
      const termsHit  = clinTerms.filter(t => (clinicalNarrative as string).toLowerCase().includes(t));
      assert(termsHit.length >= 3,
        `clinicalNarrative must reference ≥3 clinical terms; found: [${termsHit.join(", ")}]`);
      console.log(`✓ Step 1 clinicalNarrative: ${(clinicalNarrative as string).length} chars — terms: ${termsHit.join(", ")}`);

      // ─────────────────────────────────────────────────────────────────────
      // STEP 2 — parentSummary (Gemini Flash, parent-friendly)
      // ─────────────────────────────────────────────────────────────────────
      assert(typeof parentSummary === "string" && parentSummary.length >= 20,
        `parentSummary must be ≥20 chars`);

      const wordCount = (parentSummary as string).trim().split(/\s+/).length;
      assert(wordCount <= 200, `parentSummary must be ≤200 words (got ${wordCount})`);
      console.log(`✓ Step 2 parentSummary: ${wordCount} words`);

      // Golden Standard: jargon-free
      const jargon = ["Bayesian posterior","phenotypic","latent health score","bioavailability matrix","algorithm output","p-value"];
      const jFound  = jargon.filter(j => (parentSummary as string).toLowerCase().includes(j.toLowerCase()));
      assertEquals(jFound.length, 0, `parentSummary contains jargon: ${jFound.join(", ")}`);
      console.log("✓ Step 2 parentSummary: jargon-free (Golden Standard ✓)");

      // ─────────────────────────────────────────────────────────────────────
      // STEP 3 — structuredIntervention (Gemini Flash, JSON)
      // ─────────────────────────────────────────────────────────────────────
      assert(typeof structuredIntervention === "object" && structuredIntervention !== null,
        "structuredIntervention must be a JSON object (not a parseError)");
      assert(!("parseError" in (structuredIntervention as object)),
        `structuredIntervention JSON parse failed: ${JSON.stringify(structuredIntervention).slice(0, 200)}`);

      // topPriority
      assert(typeof structuredIntervention.topPriority === "string" && structuredIntervention.topPriority.length > 5,
        "topPriority must be a non-empty string");
      console.log(`✓ topPriority: "${(structuredIntervention.topPriority as string).slice(0, 70)}"`);

      // timeframe
      assert(typeof structuredIntervention.timeframe === "string" && structuredIntervention.timeframe.length > 0,
        "timeframe must be a non-empty string");
      console.log(`✓ timeframe: "${structuredIntervention.timeframe}"`);

      // urgencyLevel
      const VALID_URGENCY = ["immediate","high","moderate","low"];
      assert(VALID_URGENCY.includes(structuredIntervention.urgencyLevel),
        `urgencyLevel must be one of [${VALID_URGENCY.join("|")}], got: "${structuredIntervention.urgencyLevel}"`);
      console.log(`✓ urgencyLevel: "${structuredIntervention.urgencyLevel}"`);

      // indianFoodSwaps
      assert(Array.isArray(structuredIntervention.indianFoodSwaps) && structuredIntervention.indianFoodSwaps.length >= 1,
        "indianFoodSwaps must be a non-empty array");
      for (let i = 0; i < Math.min(structuredIntervention.indianFoodSwaps.length, 3); i++) {
        const s = structuredIntervention.indianFoodSwaps[i];
        assertExists(s.avoid,   `indianFoodSwaps[${i}].avoid missing`);
        assertExists(s.replace, `indianFoodSwaps[${i}].replace missing`);
        assertExists(s.reason,  `indianFoodSwaps[${i}].reason missing`);
        console.log(`✓ foodSwap[${i}]: "${s.avoid}" → "${s.replace}"`);
      }

      // doctorReferralTriggers
      assert(Array.isArray(structuredIntervention.doctorReferralTriggers) && structuredIntervention.doctorReferralTriggers.length >= 1,
        "doctorReferralTriggers must be a non-empty array");
      console.log(`✓ doctorReferralTriggers (${structuredIntervention.doctorReferralTriggers.length}): "${structuredIntervention.doctorReferralTriggers[0]}"`);

      // ── enrichment (legacy compat) ────────────────────────────────────────
      assert(typeof enrichment === "object" && enrichment !== null, "enrichment must be an object");
      if (!(enrichment as Record<string,unknown>).parseError) {
        const legacyKeys = ["interventions","weeklyActions","doctorReferral","encouragement"];
        const present = legacyKeys.filter(k => k in (enrichment as object));
        assert(present.length >= 2, `enrichment missing legacy keys; found: ${present.join(", ")}`);
        console.log(`✓ enrichment (legacy compat): ${present.join(", ")}`);
      } else {
        console.warn("⚠ enrichment JSON parseError — raw text (non-blocking)");
      }

      // ── generatedAt & model ───────────────────────────────────────────────
      assert(!isNaN(Date.parse(generatedAt as string)), `generatedAt invalid ISO 8601: "${generatedAt}"`);
      assert((model as string).toLowerCase().includes("gemini"), `model should identify Gemini: "${model}"`);
      console.log(`✓ generatedAt: ${generatedAt} | model: ${model}`);

      console.log(`\n✅ Full 3-step pipeline PASSED (${elapsed}ms)${body.cached ? " via cache" : " via live AI"}`);

    } finally {
      await cleanupSession(session);
    }
  },
});

// ─── Test 2: Cache round-trip ─────────────────────────────────────────────────
Deno.test({
  name: "enrich-report [pipeline]: repeat identical call returns cached:true with all 3 pipeline keys",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const session = await getSession();
    if (!session) { console.warn("⚠ Skipping cache test — no auth."); return; }

    // Deterministic short payload → same cache key both calls
    const payload = {
      reportSummary: "Cache-regression: 8-year-old vegetarian girl, iron 25th, calcium 40th percentile.",
      childAge: 8, childGender: "female", dietType: "vegetarian",
      topConcerns: [{ domain: "Nutrition", metric: "iron", score: 25 }],
      hiddenPatterns: [], risks: [], algorithmOutputs: {},
    };
    const h = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.accessToken}`,
      "apikey": ANON_KEY,
    };

    try {
      // Call 1
      const r1 = await fetch(FUNCTION_URL, { method: "POST", headers: h, body: JSON.stringify(payload) });
      if (r1.status === 429 || r1.status === 402) { await r1.text(); console.warn(`⚠ Skip (${r1.status})`); return; }
      const b1 = await r1.json();
      assertEquals(r1.status, 200, `Call 1 expected 200, got ${r1.status}`);
      console.log(`[cache] Call 1: ${b1.cached ? "HIT" : "live"}`);

      // Call 2 — must return cached:true
      const r2 = await fetch(FUNCTION_URL, { method: "POST", headers: h, body: JSON.stringify(payload) });
      const b2 = await r2.json();
      assertEquals(r2.status, 200, `Call 2 expected 200, got ${r2.status}`);
      assertEquals(b2.cached, true, `Call 2 must be cached:true`);

      // All 3 pipeline keys must survive the cache round-trip
      for (const key of ["clinicalNarrative", "parentSummary", "structuredIntervention"]) {
        assertExists((b2 as Record<string,unknown>)[key], `Cache hit missing key: '${key}'`);
      }
      console.log("✅ Cache round-trip PASSED — all 3 pipeline keys intact in cached response");

    } finally {
      await cleanupSession(session);
    }
  },
});

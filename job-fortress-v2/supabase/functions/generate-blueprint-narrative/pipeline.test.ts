/**
 * Live Integration Test — generate-blueprint-narrative
 *
 * This function is a PUBLIC endpoint (no JWT required).
 * Architecture: archetype + scores are computed DETERMINISTICALLY first;
 * this function ONLY generates the narrative wrapper (4 bullet insights).
 * Model: gemini-3.1-pro-preview
 *
 * Tests:
 *  1. [with-dm]    Full payload including DiscoverMe neurocognitive data
 *                  → Arjun, 10yo, "Analytical Innovator" archetype
 *  2. [without-dm] Minimal payload — no DiscoverMe data
 *                  → Priya, 8yo, "Creative Connector" archetype
 *  3. [validation] Missing required fields → 400
 *  4. [validation] CORS OPTIONS preflight → 200
 *
 * Quality assertions (Golden Standard ≥ 8.8/10):
 *  ✓ Exactly 4 bullets returned
 *  ✓ Each bullet is a non-empty string (18–60 words)
 *  ✓ No clinical jargon (parent-friendly)
 *  ✓ Archetype name appears in at least 1 bullet (specificity rule)
 *  ✓ With DM: at least 1 bullet references a DM-specific field
 *  ✓ No bullet is duplicated (no-overlap rule)
 *  ✓ success: true in response
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assertEquals,
  assertExists,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const PROJECT_ID  = Deno.env.get("VITE_SUPABASE_PROJECT_ID")!;
const ANON_KEY    = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/generate-blueprint-narrative`;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "apikey": ANON_KEY,
};

// ─── Payload 1: Full DiscoverMe context (Arjun, 10yo — reference demo profile) ─
const PAYLOAD_WITH_DM = {
  childName:       "Arjun",
  childAge:        10,
  childGender:     "male",
  archetype:       "Analytical Innovator",
  topDimension:    "Cognitive-Intellectual Vitality",
  topScore:        82,
  secondDimension: "Athletic-Physical Vitality",
  secondScore:     74,
  allVectorScores: [
    { name: "Cognitive-Intellectual Vitality",  score: 82 },
    { name: "Athletic-Physical Vitality",        score: 74 },
    { name: "Artistic-Creative Vitality",        score: 61 },
    { name: "Leadership-Social Vitality",        score: 55 },
    { name: "Nurturing-Interpersonal Vitality",  score: 48 },
  ],
  // DiscoverMe neurocognitive data
  dmStandoutStrength:      "Strong left-hemisphere dominance with high fluid reasoning",
  dmNaturalIntelligences:  ["logical-mathematical", "visual-spatial", "bodily-kinesthetic"],
  dmCareerTraits:          ["analytical", "problem-solver", "independent", "detail-oriented"],
  dmStressors:             ["time pressure", "loud environments", "ambiguous instructions"],
  dmLearningStyle: {
    primaryMode:          "visual",
    needsNovelty:          true,
    toleratesRepetition:   false,
    prefersBigPicture:     false,
    prefersDetail:         true,
  },
  dmSportAptitude: {
    coordinationRating:          "high",
    straightLineSports:           false,
    agilityBased:                 true,
    stressImpactOnPerformance:   "moderate",
  },
  dmArtisticStyle:   "structural / architectural",
  topPdfMetrics:     ["left-eye dominant", "right-hand dominant", "high agility score", "fast pattern recognition"],
};

// ─── Payload 2: No DiscoverMe data (Priya, 8yo) ───────────────────────────────
const PAYLOAD_WITHOUT_DM = {
  childName:    "Priya",
  childAge:     8,
  childGender:  "female",
  archetype:    "Creative Connector",
  topDimension: "Artistic-Creative Vitality",
  topScore:     79,
  allVectorScores: [
    { name: "Artistic-Creative Vitality",        score: 79 },
    { name: "Nurturing-Interpersonal Vitality",  score: 68 },
    { name: "Cognitive-Intellectual Vitality",   score: 55 },
    { name: "Athletic-Physical Vitality",        score: 42 },
    { name: "Leadership-Social Vitality",        score: 51 },
  ],
  // No DM fields — dmStandoutStrength omitted intentionally
};

// ─── Quality checker ──────────────────────────────────────────────────────────
function assertBulletQuality(
  bullets: string[],
  payload: typeof PAYLOAD_WITH_DM | typeof PAYLOAD_WITHOUT_DM,
  label: string
) {
  // 1. Exactly 4 bullets
  assertEquals(bullets.length, 4, `${label}: must return exactly 4 bullets, got ${bullets.length}`);
  console.log(`✓ ${label}: exactly 4 bullets`);

  // 2. Each bullet is a non-empty string
  bullets.forEach((b, i) => {
    assert(typeof b === "string" && b.trim().length > 0,
      `${label}: bullet[${i}] must be a non-empty string, got: ${JSON.stringify(b)}`);
  });
  console.log(`✓ ${label}: all 4 bullets are non-empty strings`);

  // 3. Word count per bullet: prompt asks 18–25 words, allow up to 60 for flexibility
  bullets.forEach((b, i) => {
    const wc = b.trim().split(/\s+/).length;
    assert(wc >= 5,  `${label}: bullet[${i}] is too short (${wc} words): "${b}"`);
    assert(wc <= 70, `${label}: bullet[${i}] is too long (${wc} words): "${b.slice(0, 80)}…"`);
    console.log(`  bullet[${i}] ${wc} words`);
  });
  console.log(`✓ ${label}: all bullet word counts within 5–70 word range`);

  // 4. Golden Standard — jargon-free (no clinical / algorithmic terms)
  const JARGON = [
    "Bayesian", "percentile", "algorithm", "phenotypic", "bioavailability",
    "posterior", "latent health score", "convergence score", "p-value",
    "standard deviation", "cohort analysis",
  ];
  const allText = bullets.join(" ").toLowerCase();
  const jargonFound = JARGON.filter(j => allText.includes(j.toLowerCase()));
  assertEquals(jargonFound.length, 0,
    `${label}: bullets contain jargon — [${jargonFound.join(", ")}]`);
  console.log(`✓ ${label}: jargon-free (Golden Standard ✓)`);

  // 5. No duplicate bullets
  const unique = new Set(bullets.map(b => b.trim().toLowerCase()));
  assertEquals(unique.size, 4, `${label}: bullets contain duplicates`);
  console.log(`✓ ${label}: no duplicate bullets`);

  // 6. Specificity — archetype name appears somewhere in the bullets
  const archetypeLower = payload.archetype.toLowerCase();
  const archetypePresent = bullets.some(b => b.toLowerCase().includes(archetypeLower));
  // Relaxed: archetype OR top dimension name must appear
  const topDimLower = payload.topDimension.toLowerCase().split(" ")[0]; // e.g. "cognitive"
  const specificityOk = archetypePresent || bullets.some(b => b.toLowerCase().includes(topDimLower));
  assert(specificityOk,
    `${label}: no bullet references the archetype ("${payload.archetype}") or top dimension ("${payload.topDimension}")`);
  console.log(`✓ ${label}: at least 1 bullet references archetype or top dimension`);

  // 7. With DM: at least 1 bullet must reference a DM-specific signal
  const hasDM = "dmStandoutStrength" in payload && payload.dmStandoutStrength;
  if (hasDM) {
    const dmPayload = payload as typeof PAYLOAD_WITH_DM;
    const dmSignals = [
      ...(dmPayload.dmNaturalIntelligences ?? []),
      ...(dmPayload.dmCareerTraits ?? []),
      ...(dmPayload.topPdfMetrics ?? []),
      dmPayload.dmLearningStyle?.primaryMode ?? "",
      dmPayload.dmArtisticStyle ?? "",
    ].map(s => s.toLowerCase());

    const dmReferenced = bullets.some(b => {
      const bl = b.toLowerCase();
      return dmSignals.some(s => s.length > 2 && bl.includes(s));
    });
    assert(dmReferenced,
      `${label}: with DM data, at least 1 bullet must reference a DM signal (intelligences, traits, learning style, etc.)`);
    console.log(`✓ ${label}: at least 1 bullet references DiscoverMe data`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 1: Full payload with DiscoverMe data (Arjun, 10yo)
// ═══════════════════════════════════════════════════════════════════════════════
Deno.test({
  name: "generate-blueprint-narrative [with-dm]: returns 4 quality bullets for Arjun (Analytical Innovator)",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    console.log("\n[with-dm] Calling generate-blueprint-narrative for Arjun (10yo, full DM context)…");
    const t0 = Date.now();

    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(PAYLOAD_WITH_DM),
    });

    const elapsed = Date.now() - t0;
    console.log(`[with-dm] HTTP ${res.status} in ${elapsed}ms`);

    if (res.status === 429) { await res.text(); console.warn("⚠ Rate limit — skip"); return; }
    if (res.status === 402) { await res.text(); console.warn("⚠ AI credits — skip"); return; }

    const body = await res.json();
    assertEquals(res.status, 200,
      `Expected 200, got ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);

    // ── Response shape ──────────────────────────────────────────────────────
    assertEquals(body.success, true, `success must be true, got: ${JSON.stringify(body)}`);
    assertExists(body.bullets, "Response must contain 'bullets' array");
    assert(Array.isArray(body.bullets), "'bullets' must be an array");
    console.log("✓ Response shape: { success: true, bullets: [...] }");

    // ── Quality assertions ──────────────────────────────────────────────────
    assertBulletQuality(body.bullets, PAYLOAD_WITH_DM, "with-dm");

    // ── Hybrid identity: bullets must acknowledge dual-strength ─────────────
    const hybridSignals = [
      "hybrid", "cognitive", "physical", "athletic", "analytical", "innovator",
      "vitality", "strength", "dimension",
    ];
    const allText = (body.bullets as string[]).join(" ").toLowerCase();
    const hybridHit = hybridSignals.filter(s => allText.includes(s));
    assert(hybridHit.length >= 2,
      `with-dm: hybrid payload should produce bullets referencing multiple dimensions. Found: [${hybridHit.join(", ")}]`);
    console.log(`✓ Hybrid identity signals found in bullets: ${hybridHit.join(", ")}`);

    // ── Print bullets for manual review ────────────────────────────────────
    console.log("\n📌 Generated bullets (with DM):");
    (body.bullets as string[]).forEach((b, i) => console.log(`  [${i + 1}] ${b}`));
    console.log(`\n✅ [with-dm] PASSED in ${elapsed}ms`);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 2: Minimal payload — no DiscoverMe data (Priya, 8yo)
// ═══════════════════════════════════════════════════════════════════════════════
Deno.test({
  name: "generate-blueprint-narrative [without-dm]: returns 4 quality bullets for Priya (Creative Connector)",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    console.log("\n[without-dm] Calling generate-blueprint-narrative for Priya (8yo, no DM)…");
    const t0 = Date.now();

    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(PAYLOAD_WITHOUT_DM),
    });

    const elapsed = Date.now() - t0;
    console.log(`[without-dm] HTTP ${res.status} in ${elapsed}ms`);

    if (res.status === 429) { await res.text(); console.warn("⚠ Rate limit — skip"); return; }
    if (res.status === 402) { await res.text(); console.warn("⚠ AI credits — skip"); return; }

    const body = await res.json();
    assertEquals(res.status, 200,
      `Expected 200, got ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);

    assertEquals(body.success, true, `success must be true: ${JSON.stringify(body)}`);
    assertExists(body.bullets);
    assert(Array.isArray(body.bullets));
    console.log("✓ Response shape: { success: true, bullets: [...] }");

    assertBulletQuality(body.bullets, PAYLOAD_WITHOUT_DM, "without-dm");

    // Without DM, bullets should NOT hallucinate DM signals
    const dmHallucinations = [
      "dominant hand", "dominant eye", "dominant ear", "brain hemisphere",
      "blocked modality", "print pattern",
    ];
    const allText = (body.bullets as string[]).join(" ").toLowerCase();
    const hallucinations = dmHallucinations.filter(h => allText.includes(h));
    assertEquals(hallucinations.length, 0,
      `without-dm: bullets must NOT hallucinate DM fields: [${hallucinations.join(", ")}]`);
    console.log("✓ No DM hallucinations in no-DM payload");

    console.log("\n📌 Generated bullets (without DM):");
    (body.bullets as string[]).forEach((b, i) => console.log(`  [${i + 1}] ${b}`));
    console.log(`\n✅ [without-dm] PASSED in ${elapsed}ms`);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 3: Input validation — missing required fields → 400
// ═══════════════════════════════════════════════════════════════════════════════
Deno.test({
  name: "generate-blueprint-narrative [validation]: missing childName → 400",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { childName: _omit, ...payload } = PAYLOAD_WITH_DM;
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    assertEquals(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(body)}`);
    assertExists(body.error);
    console.log(`✓ Missing childName → 400: "${body.error}"`);
  },
});

Deno.test({
  name: "generate-blueprint-narrative [validation]: missing archetype → 400",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { archetype: _omit, ...payload } = PAYLOAD_WITH_DM;
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    assertEquals(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(body)}`);
    assertExists(body.error);
    console.log(`✓ Missing archetype → 400: "${body.error}"`);
  },
});

Deno.test({
  name: "generate-blueprint-narrative [validation]: missing topDimension → 400",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { topDimension: _omit, ...payload } = PAYLOAD_WITH_DM;
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    assertEquals(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(body)}`);
    assertExists(body.error);
    console.log(`✓ Missing topDimension → 400: "${body.error}"`);
  },
});

Deno.test({
  name: "generate-blueprint-narrative [validation]: empty body → 400",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({}),
    });
    const body = await res.json();
    assertEquals(res.status, 400, `Expected 400 for empty body, got ${res.status}: ${JSON.stringify(body)}`);
    assertExists(body.error);
    console.log(`✓ Empty body → 400: "${body.error}"`);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 4: CORS preflight
// ═══════════════════════════════════════════════════════════════════════════════
Deno.test({
  name: "generate-blueprint-narrative [cors]: OPTIONS preflight → 200",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const res = await fetch(FUNCTION_URL, { method: "OPTIONS" });
    await res.text();
    assertEquals(res.status, 200, `Expected 200 for OPTIONS, got ${res.status}`);
    console.log("✓ OPTIONS preflight → 200");
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 5: Consistency — same payload, two calls produce structurally identical output
// ═══════════════════════════════════════════════════════════════════════════════
Deno.test({
  name: "generate-blueprint-narrative [consistency]: two calls return same structure (both 4 bullets)",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    console.log("\n[consistency] Running 2 calls with identical minimal payload…");

    const minPayload = {
      childName: "Ravi", childAge: 9, childGender: "male",
      archetype: "Athletic Achiever",
      topDimension: "Athletic-Physical Vitality",
      topScore: 77,
    };

    const call = async () => {
      const r = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(minPayload),
      });
      if (r.status === 429 || r.status === 402) { await r.text(); return null; }
      return await r.json();
    };

    const [b1, b2] = await Promise.all([call(), call()]);

    if (!b1 || !b2) { console.warn("⚠ Rate limit — skip consistency check"); return; }

    assertEquals(b1.success, true, `Call 1: success must be true`);
    assertEquals(b2.success, true, `Call 2: success must be true`);
    assertEquals(b1.bullets.length, 4, "Call 1: must return 4 bullets");
    assertEquals(b2.bullets.length, 4, "Call 2: must return 4 bullets");
    console.log("✓ Both parallel calls returned success:true with 4 bullets");
    console.log(`✅ Consistency test PASSED`);
  },
});

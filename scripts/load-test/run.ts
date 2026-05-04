/**
 * Load test for JobBachao prod edge functions.
 *
 * Two phases:
 *   PHASE 1 — `create-scan` burst: cheap insert path + rate-limit/dedupe behavior.
 *             Measures whether the front door survives a burst (10/25/50 concurrent).
 *   PHASE 2 — `process-scan` LIMITED burst: end-to-end LLM pipeline against 5 prebaked
 *             scan IDs with LinkedIn URLs. Measures p50/p95 + failure modes under
 *             real LLM/Apify/DB contention.
 *
 * Anonymous (no auth header). Each scan uses a unique LinkedIn URL to avoid the
 * 10-second dedupe collapse. Costs ~₹50-150 per full run.
 *
 * Usage:  bun run scripts/load-test/run.ts [phase1|phase2|all] [concurrency]
 */
const SUPABASE_URL = "https://dlpeirtuaxydoyzwzdyz.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRscGVpcnR1YXh5ZG95end6ZHl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMTkwNTEsImV4cCI6MjA4NzU5NTA1MX0.A-IvlBe3U5Sheq991dF_ep_RpqFlS_dvM0hskTHQPsw";

const BASE = `${SUPABASE_URL}/functions/v1`;

// Real public LinkedIn URLs that have failed/succeeded in past tests.
// Using a mix to get a realistic failure-rate signal, not just happy-path.
const LINKEDIN_POOL = [
  "https://www.linkedin.com/in/williamhgates/",
  "https://www.linkedin.com/in/satyanadella/",
  "https://www.linkedin.com/in/sundarpichai/",
  "https://www.linkedin.com/in/jeffweiner08/",
  "https://www.linkedin.com/in/parag-agrawal-816b1b1/",
  "https://www.linkedin.com/in/reidhoffman/",
  "https://www.linkedin.com/in/shantanunarayen/",
  "https://www.linkedin.com/in/ariannahuffington/",
];

interface Result {
  ok: boolean;
  status: number;
  ms: number;
  scanId?: string;
  error?: string;
  errorCode?: string;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = performance.now();
  const result = await fn();
  return { result, ms: Math.round(performance.now() - t0) };
}

async function callCreateScan(linkedinUrl: string): Promise<Result> {
  try {
    const { result: res, ms } = await timed(() =>
      fetch(`${BASE}/create-scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          linkedinUrl,
          country: "IN",
          industry: "Technology",
          dpdpConsentGiven: true,
        }),
      })
    );
    const text = await res.text();
    let parsed: any = {};
    try {
      parsed = JSON.parse(text);
    } catch { /* keep text */ }
    return {
      ok: res.ok,
      status: res.status,
      ms,
      scanId: parsed?.id,
      error: res.ok ? undefined : parsed?.error || text.slice(0, 200),
      errorCode: parsed?.code,
    };
  } catch (e: any) {
    return { ok: false, status: 0, ms: 0, error: e?.message || String(e) };
  }
}

async function callProcessScan(scanId: string): Promise<Result> {
  try {
    const { result: res, ms } = await timed(() =>
      fetch(`${BASE}/process-scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ scanId }),
      })
    );
    const text = await res.text();
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch {}
    return {
      ok: res.ok,
      status: res.status,
      ms,
      scanId,
      error: res.ok ? undefined : parsed?.error || parsed?.code || text.slice(0, 200),
      errorCode: parsed?.code || parsed?.error_code,
    };
  } catch (e: any) {
    return { ok: false, status: 0, ms: 0, scanId, error: e?.message || String(e) };
  }
}

function pct(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100));
  return sorted[idx];
}

function summarize(label: string, results: Result[]) {
  const ok = results.filter((r) => r.ok);
  const bad = results.filter((r) => !r.ok);
  const lats = results.map((r) => r.ms).filter((m) => m > 0);
  const errBuckets: Record<string, number> = {};
  for (const r of bad) {
    const key = r.errorCode || `HTTP_${r.status}` || "unknown";
    errBuckets[key] = (errBuckets[key] || 0) + 1;
  }
  console.log(`\n=== ${label} ===`);
  console.log(`  total=${results.length}  ok=${ok.length}  fail=${bad.length}  success_rate=${((ok.length / results.length) * 100).toFixed(1)}%`);
  console.log(`  latency p50=${pct(lats, 50)}ms  p95=${pct(lats, 95)}ms  p99=${pct(lats, 99)}ms  max=${Math.max(...lats, 0)}ms`);
  if (Object.keys(errBuckets).length > 0) {
    console.log(`  error breakdown:`);
    for (const [k, v] of Object.entries(errBuckets).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k}: ${v}`);
    }
  }
  if (bad.length > 0 && bad.length <= 5) {
    console.log(`  sample errors:`);
    for (const b of bad.slice(0, 3)) console.log(`    [${b.status}] ${b.error?.slice(0, 120)}`);
  }
}

async function phase1(concurrency: number) {
  console.log(`\n>>> PHASE 1: ${concurrency} concurrent create-scan calls`);
  const tasks: Promise<Result>[] = [];
  for (let i = 0; i < concurrency; i++) {
    // unique-ish URL per call to bypass the 10s dedupe collapse
    const url = `${LINKEDIN_POOL[i % LINKEDIN_POOL.length]}?lt=${Date.now()}-${i}`;
    tasks.push(callCreateScan(url));
  }
  const results = await Promise.all(tasks);
  summarize(`PHASE 1 — create-scan x${concurrency}`, results);
  return results;
}

async function phase2(concurrency: number) {
  console.log(`\n>>> PHASE 2: ${concurrency} concurrent process-scan (real LLM burn)`);
  // Step A: create scans serially first so we have valid scanIds (avoid mixing)
  const createResults: Result[] = [];
  for (let i = 0; i < concurrency; i++) {
    const url = `${LINKEDIN_POOL[i % LINKEDIN_POOL.length]}?lt=${Date.now()}-p2-${i}`;
    createResults.push(await callCreateScan(url));
  }
  const validIds = createResults.filter((r) => r.ok && r.scanId).map((r) => r.scanId!);
  console.log(`  created ${validIds.length}/${concurrency} scans for processing`);
  if (validIds.length === 0) {
    console.log(`  ABORT: no valid scan IDs to process`);
    return [];
  }
  // Step B: fire process-scan in parallel
  const processResults = await Promise.all(validIds.map((id) => callProcessScan(id)));
  summarize(`PHASE 2 — process-scan x${validIds.length}`, processResults);
  return processResults;
}

const phase = Deno.args[0] || "all";
const conc = Number(Deno.args[1] || 10);

console.log(`Load test starting — phase=${phase} concurrency=${conc}`);
console.log(`Target: ${BASE}`);
const startWall = Date.now();

if (phase === "phase1" || phase === "all") {
  await phase1(conc);
}
if (phase === "phase2" || phase === "all") {
  await phase2(Math.min(conc, 10)); // cap LLM burn at 10 per run
}

console.log(`\nTotal wall time: ${Math.round((Date.now() - startWall) / 1000)}s`);

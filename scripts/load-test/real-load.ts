/**
 * REAL load test against full process-scan pipeline.
 *
 * Steps:
 *   1. Sign up throwaway test user via supabase.auth.signUp (gets a real anon JWT)
 *   2. Create 10 scans serially (anon-rate-limit safe under user_id auth)
 *   3. Fire all 10 process-scan calls in parallel (real LLM burn, ~₹500-1500)
 *   4. Poll DB every 5s until all complete or fail
 *   5. Print honest p50/p95/p99, error breakdown, agent-stage failures
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://dlpeirtuaxydoyzwzdyz.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRscGVpcnR1YXh5ZG95end6ZHl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMTkwNTEsImV4cCI6MjA4NzU5NTA1MX0.A-IvlBe3U5Sheq991dF_ep_RpqFlS_dvM0hskTHQPsw";
const BASE = `${SUPABASE_URL}/functions/v1`;

const CONCURRENCY = Number(process.argv[2] || 10);

// Mix: 5 LinkedIn URLs (Apify path) + 5 manual industry-only (no LinkedIn, fastest path)
const LINKEDIN_POOL = [
  "https://www.linkedin.com/in/satyanadella/",
  "https://www.linkedin.com/in/sundarpichai/",
  "https://www.linkedin.com/in/williamhgates/",
  "https://www.linkedin.com/in/jeffweiner08/",
  "https://www.linkedin.com/in/reidhoffman/",
];

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- Step 1: Auth ----------
const testEmail = `loadtest+${Date.now()}@jobbachao-test.local`;
const testPassword = `LoadTest!${Date.now()}`;
console.log(`[1/4] Signing up throwaway user: ${testEmail}`);

const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
  email: testEmail,
  password: testPassword,
  options: { emailRedirectTo: `${SUPABASE_URL}` },
});
if (signUpErr || !signUp.session?.access_token) {
  // Fall back: try sign in (in case auto-confirm is off but session is given)
  console.error(`signUp error: ${signUpErr?.message}`);
  process.exit(1);
}
const jwt = signUp.session.access_token;
const userId = signUp.user!.id;
console.log(`    ✅ user=${userId} jwt=${jwt.slice(0, 20)}...`);

// ---------- Step 2: Create scans serially ----------
console.log(`\n[2/4] Creating ${CONCURRENCY} scans serially under this user...`);
const scans: Array<{ id: string; token: string; linkedin: string; tCreate: number }> = [];
for (let i = 0; i < CONCURRENCY; i++) {
  const linkedin = `${LINKEDIN_POOL[i % LINKEDIN_POOL.length]}?lt=${Date.now()}-${i}`;
  const t0 = performance.now();
  const res = await fetch(`${BASE}/create-scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      linkedinUrl: linkedin,
      country: "IN",
      industry: "Technology",
      yearsExperience: "5-10",
      userId,
      dpdpConsentGiven: true,
    }),
  });
  const ms = Math.round(performance.now() - t0);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.id) {
    console.log(`    ❌ ${i + 1}/${CONCURRENCY} HTTP ${res.status}: ${body.error || "?"}`);
    continue;
  }
  scans.push({ id: body.id, token: body.accessToken, linkedin, tCreate: ms });
  console.log(`    ✅ ${i + 1}/${CONCURRENCY} ${body.id.slice(0, 8)} (${ms}ms)`);
}
if (scans.length === 0) {
  console.error("\nNo scans created — aborting.");
  process.exit(1);
}

// ---------- Step 3: Fire process-scan in parallel ----------
console.log(`\n[3/4] Firing ${scans.length} process-scan in PARALLEL (real LLM burn)...`);
const fireStart = Date.now();

const fireResults = await Promise.all(
  scans.map(async (s) => {
    const t0 = performance.now();
    try {
      const res = await fetch(`${BASE}/process-scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${jwt}`,
          "x-scan-access-token": s.token,
        },
        body: JSON.stringify({ scanId: s.id }),
      });
      const text = await res.text();
      const ms = Math.round(performance.now() - t0);
      let parsed: any = {};
      try { parsed = JSON.parse(text); } catch {}
      return {
        scanId: s.id,
        ok: res.ok,
        httpStatus: res.status,
        ms,
        body: parsed,
        error: res.ok ? null : (parsed?.error || text.slice(0, 200)),
      };
    } catch (e: any) {
      return {
        scanId: s.id,
        ok: false,
        httpStatus: 0,
        ms: Math.round(performance.now() - t0),
        error: e?.message || String(e),
      };
    }
  })
);
const fireWall = Date.now() - fireStart;
console.log(`    Wall time for parallel fire: ${Math.round(fireWall / 1000)}s`);
for (const r of fireResults) {
  console.log(`    ${r.ok ? "✅" : "❌"} ${r.scanId.slice(0, 8)} | HTTP ${r.httpStatus} | ${r.ms}ms${r.error ? ` | ${r.error.slice(0, 80)}` : ""}`);
}

// ---------- Step 4: Poll DB for terminal status ----------
console.log(`\n[4/4] Polling DB until all scans reach terminal status (max 5 min)...`);
const sb2 = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
});
const ids = scans.map((s) => s.id);
const startPoll = Date.now();
const TIMEOUT_MS = 5 * 60 * 1000;
let lastSummary = "";

while (Date.now() - startPoll < TIMEOUT_MS) {
  const { data: rows, error: dbErr } = await sb2
    .from("scans")
    .select("id, scan_status, error_message, error_code, created_at, updated_at")
    .in("id", ids);
  if (dbErr) {
    console.log(`    DB error: ${dbErr.message}`);
    await new Promise((r) => setTimeout(r, 5000));
    continue;
  }
  const buckets: Record<string, number> = {};
  for (const r of rows || []) buckets[r.scan_status] = (buckets[r.scan_status] || 0) + 1;
  const summary = Object.entries(buckets).map(([k, v]) => `${k}=${v}`).join(" ");
  if (summary !== lastSummary) {
    console.log(`    [+${Math.round((Date.now() - startPoll) / 1000)}s] ${summary}`);
    lastSummary = summary;
  }
  const terminal = (rows || []).every((r) => r.scan_status === "complete" || r.scan_status === "error" || r.scan_status === "failed");
  if (terminal) break;
  await new Promise((r) => setTimeout(r, 5000));
}

// ---------- Final report ----------
console.log(`\n=================== FINAL REPORT ===================`);
const { data: finalRows } = await sb2
  .from("scans")
  .select("id, scan_status, error_message, error_code, created_at, updated_at, final_json_report")
  .in("id", ids);

const completed: any[] = [];
const failed: any[] = [];
const stuck: any[] = [];
for (const r of finalRows || []) {
  const elapsed = new Date(r.updated_at).getTime() - new Date(r.created_at).getTime();
  if (r.scan_status === "complete") completed.push({ ...r, elapsed });
  else if (r.scan_status === "error" || r.scan_status === "failed") failed.push({ ...r, elapsed });
  else stuck.push(r);
}

const lats = completed.map((c) => c.elapsed).sort((a, b) => a - b);
const p = (q: number) => (lats.length ? lats[Math.min(lats.length - 1, Math.floor(lats.length * q))] : 0);

console.log(`\nConcurrency requested: ${CONCURRENCY}`);
console.log(`Scans created:         ${scans.length}`);
console.log(`Completed (✅):         ${completed.length} / ${scans.length} (${((completed.length / scans.length) * 100).toFixed(0)}%)`);
console.log(`Failed (❌):            ${failed.length}`);
console.log(`Stuck/processing (🟡): ${stuck.length}`);
if (lats.length) {
  console.log(`\nEnd-to-end latency (DB created→updated, completed only):`);
  console.log(`  p50=${Math.round(p(0.5)/1000)}s  p95=${Math.round(p(0.95)/1000)}s  p99=${Math.round(p(0.99)/1000)}s  max=${Math.round(p(1)/1000)}s`);
}

if (failed.length) {
  console.log(`\nFailure breakdown:`);
  const codeBuckets: Record<string, number> = {};
  for (const f of failed) {
    const k = f.error_code || (f.error_message?.slice(0, 40) ?? "unknown");
    codeBuckets[k] = (codeBuckets[k] || 0) + 1;
  }
  for (const [k, v] of Object.entries(codeBuckets).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v}× ${k}`);
  }
  console.log(`\nFailure samples:`);
  for (const f of failed.slice(0, 5)) {
    console.log(`  ${f.id.slice(0, 8)} [${f.error_code || "?"}] ${f.error_message?.slice(0, 120) || ""}`);
  }
}

if (stuck.length) {
  console.log(`\nStuck scans (still processing past 5min):`);
  for (const s of stuck) console.log(`  ${s.id.slice(0, 8)} | ${s.scan_status}`);
}

console.log(`\nTest user: ${testEmail}`);
console.log(`Done.`);

// Phase 2 standalone — fire process-scan against existing scan IDs
const SUPABASE_URL = "https://dlpeirtuaxydoyzwzdyz.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRscGVpcnR1YXh5ZG95end6ZHl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMTkwNTEsImV4cCI6MjA4NzU5NTA1MX0.A-IvlBe3U5Sheq991dF_ep_RpqFlS_dvM0hskTHQPsw";
const BASE = `${SUPABASE_URL}/functions/v1`;

const SCANS: Array<{ id: string; token: string }> = [
  { id: "343d051a-f68e-4ed2-962c-619b7110991d", token: "fb01b25c28b48537d1ccf8f55e45cb40bc4ac807b5109da5aabe1b1b7db2f539" },
  { id: "db6726d8-acf3-4f62-b0f6-42d7333f8687", token: "3ca17ae8127ab33dac30fdf7e2383e1aa9ee59f67f5a807d32b9a9e9ecc624eb" },
  { id: "e9ef868e-bb2e-462a-b25b-227dd579d10c", token: "4f88e69aaa29a4b73b1208bb897cde4994c2df4e4717df3b4a2af4e29f89e9bb" },
  { id: "00ec0fff-817f-49e6-89c6-844b3483e618", token: "f1389b1e50933a6421f17c64cdb2d618872fc3ed4bda0559dd884e8fa9a869cc" },
  { id: "637ff4ce-c6de-4e08-b9b8-20eefc4b631b", token: "e1e029fd063ef2c191e0e31824a12c68b5c01d9de8dcc8a1665f53ff8a8f39f0" },
];

async function fire(scanId: string) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE}/process-scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ scanId }),
    });
    const text = await res.text();
    const ms = Math.round(performance.now() - t0);
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch {}
    return { scanId, ok: res.ok, status: res.status, ms, code: parsed?.code || parsed?.error_code, error: res.ok ? null : (parsed?.error || text.slice(0, 150)) };
  } catch (e: any) {
    return { scanId, ok: false, status: 0, ms: Math.round(performance.now() - t0), error: e?.message };
  }
}

console.log(`>>> Phase 2: ${SCAN_IDS.length} concurrent process-scan calls (real LLM)`);
const t0 = Date.now();
const results = await Promise.all(SCAN_IDS.map(fire));
console.log(`Wall time: ${Math.round((Date.now() - t0) / 1000)}s\n`);
for (const r of results) {
  console.log(`  ${r.ok ? "✅" : "❌"} ${r.scanId.slice(0, 8)} | ${r.status} | ${r.ms}ms${r.code ? ` | ${r.code}` : ""}${r.error ? ` | ${r.error}` : ""}`);
}
const ok = results.filter(r => r.ok);
const lats = results.map(r => r.ms);
console.log(`\nsuccess=${ok.length}/${results.length}  p50=${[...lats].sort((a,b)=>a-b)[Math.floor(lats.length/2)]}ms  max=${Math.max(...lats)}ms`);

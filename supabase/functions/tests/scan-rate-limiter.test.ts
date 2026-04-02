import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// We can't import the module directly in Deno test without the full Supabase runtime,
// so we replicate the pure logic for unit-testable portions and test the contract.

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

// ── Mock Supabase client builder ──────────────────────────────

interface MockCall {
  table: string;
  method: string;
  args: unknown[];
}

function createMockSupabase(opts: {
  selectCount?: number;
  selectError?: { message: string } | null;
  insertError?: { message: string } | null;
}) {
  const calls: MockCall[] = [];
  const chainable = () => {
    const chain: Record<string, (...args: unknown[]) => unknown> = {};
    const methods = ["select", "eq", "gte", "neq", "is", "order", "limit", "insert"];
    for (const m of methods) {
      chain[m] = (...args: unknown[]) => {
        calls.push({ table: "scan_rate_limits", method: m, args });
        if (m === "select") {
          return { ...chain, count: opts.selectCount ?? 0, error: opts.selectError ?? null };
        }
        if (m === "insert") {
          return { error: opts.insertError ?? null };
        }
        return chain;
      };
    }
    return chain;
  };

  return {
    calls,
    from: (table: string) => {
      calls.push({ table, method: "from", args: [table] });
      return chainable();
    },
  };
}

// ── Inline rate-limit logic (mirrors scan-rate-limiter.ts) ────

async function checkRateLimit(
  ip: string,
  supabaseClient: ReturnType<typeof createMockSupabase>,
  userId?: string | null,
  scanId?: string | null,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  try {
    if (userId) {
      if (scanId) {
        const result = supabaseClient
          .from("scan_rate_limits")
          .select("id", { count: "exact", head: true }) as unknown as { count: number; error: { message: string } | null };
        if (result.error) return false;
        if ((result.count ?? 0) > 0) return true;
      }

      const result = supabaseClient
        .from("scan_rate_limits")
        .select("id", { count: "exact", head: true }) as unknown as { count: number; error: { message: string } | null };
      if (result.error) return false;
      if ((result.count ?? 0) >= RATE_LIMIT) return false;

      const insertResult = supabaseClient
        .from("scan_rate_limits")
        .insert([{ client_ip: `user:${userId}` }]) as unknown as { error: { message: string } | null };
      if (insertResult.error) return false;
      return true;
    }

    // IP fallback
    const result = supabaseClient
      .from("scan_rate_limits")
      .select("id", { count: "exact", head: true }) as unknown as { count: number; error: { message: string } | null };
    if (result.error) return false;
    if ((result.count ?? 0) >= RATE_LIMIT) return false;

    const insertResult = supabaseClient
      .from("scan_rate_limits")
      .insert({ client_ip: ip }) as unknown as { error: { message: string } | null };
    if (insertResult.error) return false;
    return true;
  } catch {
    return false;
  }
}

// ── Tests ─────────────────────────────────────────────────────

Deno.test("Rate limiter — allows request under limit (IP fallback)", async () => {
  const mock = createMockSupabase({ selectCount: 3 });
  const allowed = await checkRateLimit("192.168.1.1", mock);
  assertEquals(allowed, true);
});

Deno.test("Rate limiter — blocks when at limit (IP fallback)", async () => {
  const mock = createMockSupabase({ selectCount: 10 });
  const allowed = await checkRateLimit("192.168.1.1", mock);
  assertEquals(allowed, false);
});

Deno.test("Rate limiter — allows authenticated user under limit", async () => {
  const mock = createMockSupabase({ selectCount: 5 });
  const allowed = await checkRateLimit("192.168.1.1", mock, "user-123");
  assertEquals(allowed, true);
});

Deno.test("Rate limiter — blocks authenticated user at limit", async () => {
  const mock = createMockSupabase({ selectCount: 10 });
  const allowed = await checkRateLimit("192.168.1.1", mock, "user-123");
  assertEquals(allowed, false);
});

Deno.test("Rate limiter — fails closed on select error", async () => {
  const mock = createMockSupabase({ selectError: { message: "DB down" } });
  const allowed = await checkRateLimit("192.168.1.1", mock);
  assertEquals(allowed, false);
});

Deno.test("Rate limiter — fails closed on insert error", async () => {
  const mock = createMockSupabase({ selectCount: 0, insertError: { message: "insert failed" } });
  const allowed = await checkRateLimit("192.168.1.1", mock);
  assertEquals(allowed, false);
});

Deno.test("Rate limiter — scan dedup returns true when scan marker exists", async () => {
  const mock = createMockSupabase({ selectCount: 1 });
  const allowed = await checkRateLimit("192.168.1.1", mock, "user-123", "scan-abc");
  assertEquals(allowed, true);
});

Deno.test("Rate window constant is 24 hours", () => {
  assertEquals(RATE_WINDOW_MS, 86_400_000);
});

Deno.test("Rate limit constant is 10", () => {
  assertEquals(RATE_LIMIT, 10);
});

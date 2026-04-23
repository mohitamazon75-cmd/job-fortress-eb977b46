// ═══════════════════════════════════════════════════════════════
// Circuit Breaker — module-level breaker for external dependencies
//
// Prevents cascade failures when an upstream (Tavily, Adzuna, india-jobs,
// etc.) is down or slow. After N consecutive failures, the breaker OPENS
// for COOLDOWN_MS — subsequent calls short-circuit immediately and return
// `false` so callers can use their fallback path without burning latency
// or quota on a known-failed dependency.
//
// Usage:
//   import { CircuitBreaker } from "../_shared/circuit-breaker.ts";
//   const indiaJobsBreaker = new CircuitBreaker("india-jobs", { threshold: 3, cooldownMs: 60_000 });
//
//   if (!indiaJobsBreaker.canAttempt()) { /* skip — use fallback */ }
//   try { await callDependency(); indiaJobsBreaker.recordSuccess(); }
//   catch (e) { indiaJobsBreaker.recordFailure(); throw e; }
// ═══════════════════════════════════════════════════════════════

interface BreakerOptions {
  threshold?: number;       // consecutive failures before opening (default 3)
  cooldownMs?: number;      // how long to stay open (default 60_000)
}

export class CircuitBreaker {
  readonly name: string;
  private threshold: number;
  private cooldownMs: number;
  private failureCount = 0;
  private openedAt: number | null = null;

  constructor(name: string, opts: BreakerOptions = {}) {
    this.name = name;
    this.threshold = opts.threshold ?? 3;
    this.cooldownMs = opts.cooldownMs ?? 60_000;
  }

  /** Returns true if a call should be attempted, false if breaker is open. */
  canAttempt(): boolean {
    if (this.openedAt === null) return true;
    if (Date.now() - this.openedAt > this.cooldownMs) {
      // Cooldown elapsed — half-open: allow one trial call.
      console.log(`[circuit-breaker:${this.name}] half-open, allowing trial call`);
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    if (this.openedAt !== null) {
      console.log(`[circuit-breaker:${this.name}] closed after recovery`);
    }
    this.failureCount = 0;
    this.openedAt = null;
  }

  recordFailure(): void {
    this.failureCount++;
    if (this.failureCount >= this.threshold && this.openedAt === null) {
      this.openedAt = Date.now();
      console.warn(`[circuit-breaker:${this.name}] OPEN after ${this.failureCount} failures (cooldown ${this.cooldownMs}ms)`);
    }
  }

  get isOpen(): boolean { return this.openedAt !== null && Date.now() - this.openedAt <= this.cooldownMs; }
}

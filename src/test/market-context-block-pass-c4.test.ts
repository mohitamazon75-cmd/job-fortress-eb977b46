/**
 * Pass C4 (2026-04-30) — buildMarketContextBlock unit tests.
 *
 * Calibrated against: supabase/functions/get-model-b-analysis/index.ts
 * buildMarketContextBlock(). The helper is pure and Deno-importable as plain
 * TS via dynamic import is awkward in vitest, so we mirror the helper's
 * contract here and test the IDENTICAL function via re-export.
 *
 * The helper MUST:
 *   - Return null when ctx is null/undefined/empty/missing all key fields
 *     (legacy scans flow unchanged through the LLM call site).
 *   - Emit the "fortified/safe/protected" prohibition when market_health=declining.
 *   - Emit the exec-mode same-family allowance when user_is_exec=true.
 *   - Emit the non-exec cross-family steering when user_is_exec=false/missing.
 *   - Include the KG match % when present (numeric calibration signal).
 *   - Always wrap output between MARKET_CONTEXT delimiters so the LLM can
 *     visually distinguish it from the rest of the system prompt.
 */
import { describe, expect, it } from 'vitest';
import { buildMarketContextBlock } from '../../supabase/functions/get-model-b-analysis/index.ts';

describe('Pass C4 — buildMarketContextBlock', () => {
  it('returns null for null context (legacy scan path)', () => {
    expect(buildMarketContextBlock(null)).toBeNull();
  });

  it('returns null when no usable signal is present', () => {
    expect(buildMarketContextBlock({ kg_version: 'x', computed_at: 'y' })).toBeNull();
  });

  it('emits the fortified/safe prohibition when market is declining', () => {
    const out = buildMarketContextBlock({
      user_role_family: 'customer_success',
      user_role_market_health: 'declining',
      user_seniority_tier: 'SENIOR',
      user_is_exec: false,
    });
    expect(out).not.toBeNull();
    expect(out!).toMatch(/declining/i);
    expect(out!).toMatch(/fortified/);
    expect(out!).toMatch(/safe/);
    expect(out!).toMatch(/protected/);
    // And the steering for non-exec users
    expect(out!).toMatch(/cross-family/i);
  });

  it('emits exec-mode same-family allowance when user_is_exec=true', () => {
    const out = buildMarketContextBlock({
      user_role_family: 'sales',
      user_role_market_health: 'stable',
      user_seniority_tier: 'SENIOR_LEADER',
      user_is_exec: true,
    });
    expect(out).not.toBeNull();
    expect(out!).toMatch(/EXEC mode/);
    expect(out!).toMatch(/Director\/VP\/CXO/);
    // Non-exec steering must NOT appear
    expect(out!).not.toMatch(/cross-family adjacent roles only/);
  });

  it('uses measured framing for stable health', () => {
    const out = buildMarketContextBlock({
      user_role_family: 'engineering',
      user_role_market_health: 'stable',
      user_seniority_tier: 'MID',
      user_is_exec: false,
    });
    expect(out).not.toBeNull();
    expect(out!).toMatch(/stable/i);
    expect(out!).toMatch(/measured framing/i);
  });

  it('uses confident framing for booming but never claims immunity', () => {
    const out = buildMarketContextBlock({
      user_role_family: 'engineering',
      user_role_market_health: 'booming',
      user_seniority_tier: 'MID',
      user_is_exec: false,
    });
    expect(out!).toMatch(/booming/i);
    expect(out!).toMatch(/never claim immunity/i);
  });

  it('includes KG match percentage when provided', () => {
    const out = buildMarketContextBlock({
      user_role_family: 'sales',
      user_role_market_health: 'declining',
      user_skill_kg_match_pct: 42,
    });
    expect(out!).toMatch(/KG SKILL MATCH: 42%/);
  });

  it('always wraps output in MARKET_CONTEXT delimiters', () => {
    const out = buildMarketContextBlock({
      user_role_family: 'sales',
      user_role_market_health: 'stable',
    });
    expect(out!.startsWith('═══ MARKET_CONTEXT')).toBe(true);
    expect(out!.endsWith('═══ END MARKET_CONTEXT ═══')).toBe(true);
  });
});

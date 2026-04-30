/**
 * Pass C4 (2026-04-30) — Pure helper that renders the deterministic
 * AnalysisContext into a MARKET_CONTEXT system message for the LLM.
 *
 * Lives in src/lib/ (not supabase/functions/_shared/) so vitest can import
 * it without pulling Deno-only globals. The Deno mirror lives at
 * supabase/functions/_shared/market-context-block.ts and re-exports this.
 *
 * Calibrated against:
 *   - src/lib/analysis-context.ts AnalysisContext shape
 *   - src/test/golden-scans/_fixtures.ts persona expectations
 *   - C2 invariant in golden-scan-suite.test.ts (no fortified/safe copy on declining)
 *
 * The block MUST stay under ~500 tokens and only carry contradiction-prevention
 * signal — narrative copy belongs in buildSystemPrompt(), not here.
 */

export function buildMarketContextBlock(
  ctx: Record<string, unknown> | null | undefined,
): string | null {
  if (!ctx || typeof ctx !== 'object') return null;
  const family = (ctx as any).user_role_family;
  const health = (ctx as any).user_role_market_health;
  const tier = (ctx as any).user_seniority_tier;
  const isExec = (ctx as any).user_is_exec === true;
  const kgMatch = (ctx as any).user_skill_kg_match_pct;

  // Skip if we have no usable signal — avoid emitting an empty rule block.
  if (!family && !health && !tier) return null;

  const healthLine = health
    ? (() => {
        const h = String(health).toLowerCase();
        if (h === 'declining') {
          return 'MARKET HEALTH: declining. NEVER use the words "fortified", "safe", "protected", "secure", or "future-proof" in any headline, subline, or verdict. Frame as "under significant disruption pressure" or "exposed". Pivots in this same family MUST NOT be recommended as safe harbors.';
        }
        if (h === 'booming') {
          return 'MARKET HEALTH: booming. You may use confident framing, but never claim immunity. Pivots are about acceleration, not rescue.';
        }
        return 'MARKET HEALTH: stable. Use measured framing — neither alarm nor false safety.';
      })()
    : null;

  const familyLine = family
    ? `USER ROLE FAMILY: ${family}. ${
        isExec
          ? 'EXEC mode: same-family vertical pivots (Director/VP/CXO within this family) ARE valid recommendations. Do NOT push to junior cross-family roles.'
          : 'Non-exec: same-family pivots are NOT pivots — recommend cross-family adjacent roles only.'
      }`
    : null;

  const tierLine = tier ? `SENIORITY: ${tier}.` : null;
  const matchLine =
    typeof kgMatch === 'number'
      ? `KG SKILL MATCH: ${kgMatch}% — calibrate confidence accordingly.`
      : null;

  const lines = [
    '═══ MARKET_CONTEXT (deterministic, computed by engine — DO NOT contradict) ═══',
    familyLine,
    healthLine,
    tierLine,
    matchLine,
    '═══ END MARKET_CONTEXT ═══',
  ].filter((l): l is string => typeof l === 'string' && l.length > 0);

  return lines.join('\n');
}

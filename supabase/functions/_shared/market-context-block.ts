// Deno mirror of src/lib/market-context-block.ts. Inlined (not re-exported)
// because Deno edge functions cannot reach into src/. Keep both files in sync.
// The pure helper has zero IO and zero deps — drift is caught by the vitest
// suite at src/test/market-context-block-pass-c4.test.ts.

export function buildMarketContextBlock(
  ctx: Record<string, unknown> | null | undefined,
): string | null {
  if (!ctx || typeof ctx !== "object") return null;
  const family = (ctx as any).user_role_family;
  const health = (ctx as any).user_role_market_health;
  const tier = (ctx as any).user_seniority_tier;
  const isExec = (ctx as any).user_is_exec === true;
  const kgMatch = (ctx as any).user_skill_kg_match_pct;

  if (!family && !health && !tier) return null;

  const healthLine = health
    ? (() => {
        const h = String(health).toLowerCase();
        if (h === "declining") {
          return 'MARKET HEALTH: declining. NEVER use the words "fortified", "safe", "protected", "secure", or "future-proof" in any headline, subline, or verdict. Frame as "under significant disruption pressure" or "exposed". Pivots in this same family MUST NOT be recommended as safe harbors.';
        }
        if (h === "booming") {
          return "MARKET HEALTH: booming. You may use confident framing, but never claim immunity. Pivots are about acceleration, not rescue.";
        }
        return "MARKET HEALTH: stable. Use measured framing — neither alarm nor false safety.";
      })()
    : null;

  const familyLine = family
    ? `USER ROLE FAMILY: ${family}. ${
        isExec
          ? "EXEC mode: same-family vertical pivots (Director/VP/CXO within this family) ARE valid recommendations. Do NOT push to junior cross-family roles."
          : "Non-exec: same-family pivots are NOT pivots — recommend cross-family adjacent roles only."
      }`
    : null;

  const tierLine = tier ? `SENIORITY: ${tier}.` : null;
  const matchLine =
    typeof kgMatch === "number"
      ? `KG SKILL MATCH: ${kgMatch}% — calibrate confidence accordingly.`
      : null;

  const lines = [
    "═══ MARKET_CONTEXT (deterministic, computed by engine — DO NOT contradict) ═══",
    familyLine,
    healthLine,
    tierLine,
    matchLine,
    "═══ END MARKET_CONTEXT ═══",
  ].filter((l): l is string => typeof l === "string" && l.length > 0);

  return lines.join("\n");
}

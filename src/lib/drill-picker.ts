// Pure helper for Story Bank Drill Mode random story picker.
// Extracted from StoryBankWidget for testability. No React, no I/O.
//
// Contract:
//  - Returns null if pool is empty (caller must guard before invoking).
//  - When excludeId is provided AND >1 story exists, the excluded story
//    is removed from the candidate pool (prevents "next story" landing
//    on the same one we're already drilling).
//  - When excludeId is provided but pool has only 1 story, returns that
//    one story (better to repeat than crash or return null).
//  - rng is injectable for deterministic testing; defaults to Math.random.

export interface DrillCandidate {
  id: string;
}

export function pickRandomDrillStory<T extends DrillCandidate>(
  stories: T[],
  excludeId?: string | null,
  rng: () => number = Math.random
): T | null {
  if (!stories || stories.length === 0) return null;

  const pool =
    excludeId && stories.length > 1
      ? stories.filter((s) => s.id !== excludeId)
      : stories;

  if (pool.length === 0) return null;

  const idx = Math.floor(rng() * pool.length);
  // Guard against rng() returning exactly 1.0 (spec says [0,1) but be safe).
  const safeIdx = Math.min(idx, pool.length - 1);
  return pool[safeIdx];
}

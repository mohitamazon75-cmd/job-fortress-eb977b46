import { describe, it, expect } from 'vitest';
import { pickRandomDrillStory } from '@/lib/drill-picker';

const stories = [
  { id: 'a', title: 'Alpha' },
  { id: 'b', title: 'Beta' },
  { id: 'c', title: 'Charlie' },
];

describe('pickRandomDrillStory', () => {
  it('returns null on empty pool', () => {
    expect(pickRandomDrillStory([])).toBeNull();
  });

  it('returns null when stories is undefined-like (defensive)', () => {
    // @ts-expect-error — testing defensive null/undefined handling
    expect(pickRandomDrillStory(null)).toBeNull();
    // @ts-expect-error
    expect(pickRandomDrillStory(undefined)).toBeNull();
  });

  it('returns the only story when pool has 1', () => {
    const result = pickRandomDrillStory([stories[0]]);
    expect(result).toEqual(stories[0]);
  });

  it('returns the only story even if it matches excludeId (better than null)', () => {
    // Heuristic: pool.length === 1, excludeId provided → exclude is ignored,
    // because returning null would crash the drill UI on legitimate single-story users.
    const result = pickRandomDrillStory([stories[0]], 'a');
    expect(result).toEqual(stories[0]);
  });

  it('with excludeId on multi-story pool: never returns the excluded story', () => {
    // Heuristic: stories.length > 1 AND excludeId set → filter out excludeId
    // BEFORE picking. Run 100 trials with real rng to assert exclusion.
    for (let i = 0; i < 100; i++) {
      const result = pickRandomDrillStory(stories, 'a');
      expect(result?.id).not.toBe('a');
      expect(['b', 'c']).toContain(result?.id);
    }
  });

  it('without excludeId: any story can be picked', () => {
    // Inject deterministic rng to verify each index reachable.
    expect(pickRandomDrillStory(stories, null, () => 0)?.id).toBe('a');
    expect(pickRandomDrillStory(stories, null, () => 0.5)?.id).toBe('b');
    expect(pickRandomDrillStory(stories, null, () => 0.9999)?.id).toBe('c');
  });

  it('handles rng returning exactly 1.0 without index overflow', () => {
    // Math.random spec is [0,1) but injected rng might violate; clamp to last.
    const result = pickRandomDrillStory(stories, null, () => 1.0);
    expect(result?.id).toBe('c');
  });

  it('handles rng returning 0 without underflow', () => {
    const result = pickRandomDrillStory(stories, null, () => 0);
    expect(result?.id).toBe('a');
  });

  it('with excludeId + injected rng: picks first remaining candidate at rng=0', () => {
    // Heuristic: pool after filter = [b, c], rng()=0 → idx 0 → 'b'
    const result = pickRandomDrillStory(stories, 'a', () => 0);
    expect(result?.id).toBe('b');
  });

  it('with excludeId + injected rng: picks last remaining candidate at rng=0.99', () => {
    // Heuristic: pool after filter = [b, c], rng()=0.99 → idx 1 → 'c'
    const result = pickRandomDrillStory(stories, 'a', () => 0.99);
    expect(result?.id).toBe('c');
  });

  it('does not mutate the input array', () => {
    const original = [...stories];
    pickRandomDrillStory(stories, 'a');
    expect(stories).toEqual(original);
  });
});

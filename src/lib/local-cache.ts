// ═══════════════════════════════════════════════════════════════
// localStorage TTL Cache — #7: Cache static KG data client-side
// Prevents redundant API calls for rarely-changing reference data.
// ═══════════════════════════════════════════════════════════════

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  expires_at: number;
}

/**
 * Get data from localStorage TTL cache.
 * Returns null if expired or missing.
 */
export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`jb_cache_${key}`);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expires_at) {
      localStorage.removeItem(`jb_cache_${key}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Set data in localStorage with TTL.
 */
export function setCached<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      expires_at: Date.now() + ttlMs,
    };
    localStorage.setItem(`jb_cache_${key}`, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/**
 * Invalidate a specific cache key.
 */
export function invalidateCache(key: string): void {
  try {
    localStorage.removeItem(`jb_cache_${key}`);
  } catch {
    // noop
  }
}

/**
 * Fetch with localStorage caching.
 * Calls the fetcher only if cache is missing/expired.
 */
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) return cached;
  const data = await fetcher();
  setCached(key, data, ttlMs);
  return data;
}

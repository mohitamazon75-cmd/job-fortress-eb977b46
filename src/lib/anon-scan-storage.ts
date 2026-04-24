/**
 * anon-scan-storage — single source of truth for anonymous scan persistence.
 *
 * Why this exists:
 *   When an anonymous user creates a scan, the row in `scans` is RLS-protected
 *   by `(access_token = request.headers['x-scan-access-token'])`. The scanId +
 *   accessToken live only in React state. If the user refreshes the tab,
 *   React state is gone → useScanFlow can't read the row → user is bounced
 *   back to hero with no signal.
 *
 *   This module persists `{id, accessToken, storedAt}` to localStorage so a
 *   refresh can rehydrate the scan-scoped client. Authed users don't need
 *   this (auth.uid() RLS path works), but they get the same record harmlessly
 *   for symmetry.
 *
 * Backward compatibility:
 *   The legacy `anon_scans` shape was `{id, storedAt}`. Auth.tsx and
 *   ErrorBoundary already handle both string-only and object entries — adding
 *   `accessToken` is purely additive.
 *
 * 30-day TTL matches the existing pruning rule in scan-engine.ts.
 */

const KEY = 'anon_scans';
const MAX_ENTRIES = 10;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AnonScanEntry {
  id: string;
  accessToken?: string;
  storedAt: number;
}

function readRaw(): AnonScanEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    // Tolerate legacy string-only entries by skipping them — they have no token anyway.
    return parsed.filter(
      (e: any): e is AnonScanEntry =>
        e && typeof e === 'object' && typeof e.id === 'string' && typeof e.storedAt === 'number',
    );
  } catch {
    return [];
  }
}

function writeRaw(entries: AnonScanEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Quota / private mode — silent failure is acceptable; scan still works in this tab.
  }
}

/**
 * Record an anonymous scan with its access token. Prunes expired entries and
 * dedupes by id (later writes win, e.g. if a scan is recreated).
 */
export function rememberAnonScan(id: string, accessToken: string): void {
  if (!id) return;
  const now = Date.now();
  const fresh = readRaw().filter((e) => e.id !== id && now - e.storedAt < TTL_MS);
  fresh.push({ id, accessToken: accessToken || undefined, storedAt: now });
  writeRaw(fresh);
}

/**
 * Look up the access token for a previously-stored anon scan. Returns null
 * if the scan was never stored, expired, or was stored before this fix
 * shipped (legacy entries lack the token field).
 */
export function getAnonScanToken(id: string): string | null {
  if (!id) return null;
  const now = Date.now();
  const match = readRaw().find((e) => e.id === id && now - e.storedAt < TTL_MS);
  return match?.accessToken || null;
}

/**
 * Regression test for Audit Fix #19 — Anon scan refresh loses access_token.
 *
 * Bug: anonymous user creates scan → React state holds {scanId, accessToken}
 * → user refreshes → useScanFlow reads scanId from URL but accessToken is gone
 * → default supabase client can't pass RLS → scan appears lost.
 *
 * Fix: persist {id, accessToken, storedAt} to localStorage.anon_scans on
 * scan creation; useScanFlow looks it up on hydration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rememberAnonScan, getAnonScanToken } from '@/lib/anon-scan-storage';

describe('anon-scan-storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('persists access token alongside scan id', () => {
    rememberAnonScan('scan-abc', 'tok-xyz');
    expect(getAnonScanToken('scan-abc')).toBe('tok-xyz');
  });

  it('returns null for unknown scan ids', () => {
    rememberAnonScan('scan-abc', 'tok-xyz');
    expect(getAnonScanToken('scan-other')).toBeNull();
  });

  it('returns null for scans stored without a token (legacy entries)', () => {
    // Simulate a pre-fix entry that only had {id, storedAt}
    localStorage.setItem('anon_scans', JSON.stringify([{ id: 'legacy', storedAt: Date.now() }]));
    expect(getAnonScanToken('legacy')).toBeNull();
  });

  it('expires entries older than 30 days', () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      'anon_scans',
      JSON.stringify([{ id: 'stale', accessToken: 'tok', storedAt: thirtyOneDaysAgo }]),
    );
    expect(getAnonScanToken('stale')).toBeNull();
  });

  it('caps stored entries at 10 (FIFO)', () => {
    for (let i = 0; i < 15; i++) {
      rememberAnonScan(`scan-${i}`, `tok-${i}`);
    }
    // Earliest 5 should be evicted; latest 10 retained
    expect(getAnonScanToken('scan-0')).toBeNull();
    expect(getAnonScanToken('scan-4')).toBeNull();
    expect(getAnonScanToken('scan-5')).toBe('tok-5');
    expect(getAnonScanToken('scan-14')).toBe('tok-14');
  });

  it('dedupes by id — re-storing replaces old token', () => {
    rememberAnonScan('scan-abc', 'tok-old');
    rememberAnonScan('scan-abc', 'tok-new');
    expect(getAnonScanToken('scan-abc')).toBe('tok-new');
    // And only one entry exists
    const stored = JSON.parse(localStorage.getItem('anon_scans') || '[]');
    expect(stored.filter((e: { id: string }) => e.id === 'scan-abc')).toHaveLength(1);
  });

  it('survives malformed localStorage gracefully', () => {
    localStorage.setItem('anon_scans', 'not-json{{');
    expect(getAnonScanToken('anything')).toBeNull();
    // And subsequent writes still work
    rememberAnonScan('scan-fresh', 'tok-fresh');
    expect(getAnonScanToken('scan-fresh')).toBe('tok-fresh');
  });

  it('tolerates legacy string-only entries mixed with new objects', () => {
    // Pre-fix Auth.tsx supported both shapes; new format must coexist
    localStorage.setItem(
      'anon_scans',
      JSON.stringify(['legacy-string-id', { id: 'new-id', accessToken: 'tok', storedAt: Date.now() }]),
    );
    expect(getAnonScanToken('new-id')).toBe('tok');
    expect(getAnonScanToken('legacy-string-id')).toBeNull();
  });

  it('ignores empty id', () => {
    rememberAnonScan('', 'tok');
    expect(getAnonScanToken('')).toBeNull();
  });
});

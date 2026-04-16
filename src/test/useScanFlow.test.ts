/**
 * useScanFlow.test.ts — Phase machine regression tests.
 *
 * The UX "loop" (processing → seven-cards → money-shot → processing) was
 * traced to phase transitions in Index.tsx. Those transitions now live in
 * useScanFlow — this test file ensures the 5 highest-risk ones cannot regress
 * silently.
 *
 * What's tested:
 *   1. routedScanId + complete scan → transitions to 'seven-cards'
 *   2. routedScanId + active scan → stays on 'processing'
 *   3. insight-cards without moneyShotSeen → redirects to 'money-shot'
 *   4. handleMoneyShotComplete with scanId → navigates to /results/model-b
 *   5. handleMoneyShotComplete without scanId → falls back to 'reveal'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { useScanFlow } from '@/hooks/useScanFlow';

// ── Mocks ──────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Supabase mock — factory cannot reference outer variables (hoisting).
// Use vi.fn() inline; grab reference after via vi.mocked().
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  },
}));

// scan-engine mock
vi.mock('@/lib/scan-engine', () => ({
  subscribeScanStatus: vi.fn(() => () => {}), // returns a cleanup fn
}));

// supabase-config mock
vi.mock('@/lib/supabase-config', () => ({
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'test-anon-key',
}));

// @supabase/supabase-js mock — createScanCheckClient uses this
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  })),
}));

// ── Wrapper: provide MemoryRouter for router hooks ─────────────

const wrapper =
  (initialEntries: string[] = ['/']) =>
  ({ children }: { children: React.ReactNode }) =>
    React.createElement(MemoryRouter, { initialEntries }, children);

const noopCallbacks = {
  onHydrateOnboardingFields: vi.fn(),
};

// ── Tests ──────────────────────────────────────────────────────

describe('useScanFlow — phase machine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: routedScanId + complete scan → seven-cards ─────
  it('transitions to seven-cards when URL scan is complete', async () => {
    const completeScan = {
      id: 'scan-123',
      scan_status: 'complete',
      final_json_report: { determinism_index: 62, role: 'Software Engineer' },
      access_token: 'token-abc',
      country: 'IN',
      industry: 'Technology',
      years_experience: '8',
      metro_tier: 'tier1',
      linkedin_url: null,
    };

    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: completeScan, error: null }),
    } as any);

    const { result } = renderHook(() => useScanFlow(noopCallbacks), {
      wrapper: wrapper(['/?id=scan-123']),
    });

    // Hook immediately transitions to 'processing' as hydration starts —
    // the 'hero' phase is skipped when routedScanId is present in the URL.
    // This is correct behavior; we just verify the final state after hydration.

    // Wait for the hydration effect to complete
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(result.current.phase).toBe('seven-cards');
    expect(result.current.scanId).toBe('scan-123');
    expect(result.current.scanReport).toMatchObject({ determinism_index: 62 });
    // moneyShotSeen must be false so money-shot → model-b path is available
    expect(result.current.moneyShotSeen).toBe(false);
  });

  // ── Test 2: routedScanId + active scan → stays processing ──
  it('stays on processing when URL scan is still running', async () => {
    const { subscribeScanStatus } = await import('@/lib/scan-engine');
    const mockCleanup = vi.fn();
    (subscribeScanStatus as ReturnType<typeof vi.fn>).mockReturnValue(mockCleanup);

    const activeScan = {
      id: 'scan-456',
      scan_status: 'processing',
      final_json_report: null,
      access_token: 'token-def',
      country: 'IN',
      industry: 'Finance',
      years_experience: '5',
      metro_tier: 'tier1',
      linkedin_url: null,
    };

    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: activeScan, error: null }),
    } as any);

    const { result } = renderHook(() => useScanFlow(noopCallbacks), {
      wrapper: wrapper(['/?id=scan-456']),
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    // Should be on processing (waiting for subscription to fire)
    expect(result.current.phase).toBe('processing');
    // subscribeScanStatus should have been called with the active scan's token
    expect(subscribeScanStatus).toHaveBeenCalledWith(
      'scan-456',
      'token-def',
      expect.any(Function),
      expect.any(Function),
    );
  });

  // ── Test 3: insight-cards without moneyShotSeen → money-shot
  it('redirects insight-cards to money-shot when money-shot has not been seen', async () => {
    const { result } = renderHook(() => useScanFlow(noopCallbacks), {
      wrapper: wrapper(['/']),
    });

    // Set up a scan report and set phase to insight-cards
    // without moneyShotSeen — this is the loop condition
    act(() => {
      result.current.setScanReport({ determinism_index: 55, role: 'Test' } as any);
    });

    act(() => {
      result.current.setPhase('insight-cards');
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    // The guard effect must redirect to money-shot
    expect(result.current.phase).toBe('money-shot');
  });

  // ── Test 4: handleMoneyShotComplete with scanId → /results/model-b
  it('navigates to /results/model-b when handleMoneyShotComplete is called with a scanId', async () => {
    const { result } = renderHook(() => useScanFlow(noopCallbacks), {
      wrapper: wrapper(['/']),
    });

    act(() => {
      result.current.setScanId('scan-789');
    });

    act(() => {
      result.current.handleMoneyShotComplete();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/results/model-b?id=scan-789');
    expect(result.current.moneyShotSeen).toBe(true);
  });

  // ── Test 5: handleMoneyShotComplete without scanId → 'reveal'
  it("falls back to 'reveal' phase when handleMoneyShotComplete is called with no scanId", async () => {
    const { result } = renderHook(() => useScanFlow(noopCallbacks), {
      wrapper: wrapper(['/']),
    });

    // No scanId — edge case when scan completes without an ID being set
    act(() => {
      result.current.handleMoneyShotComplete();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('reveal');
    expect(result.current.moneyShotSeen).toBe(true);
  });
});

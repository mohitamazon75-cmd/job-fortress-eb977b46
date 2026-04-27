import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ─── Session-scoped context auto-attached to every event ─────────────────────
// Why: at 4 scans/week the funnel data is only useful if we can answer "WHO
// dropped off and where did they come from?". Capturing referrer + returning
// flag at the call site is impossible (Index.tsx is 950 LOC, off-limits).
// Computing it once per session here means every event gets the context for
// free with zero changes at call sites.

const RETURNING_KEY = 'jb_returning_visitor';

function readSessionContext(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  try {
    const isReturning = localStorage.getItem(RETURNING_KEY) === '1';
    // Mark returning AFTER read so the very first visit reports as new.
    if (!isReturning) {
      try { localStorage.setItem(RETURNING_KEY, '1'); } catch { /* private mode */ }
    }
    const ref = document.referrer || '';
    let referrer_host: string | null = null;
    try { if (ref) referrer_host = new URL(ref).host; } catch { /* malformed */ }
    const params = new URLSearchParams(window.location.search);
    return {
      is_returning: isReturning,
      referrer_host,
      utm_source: params.get('utm_source') || null,
      utm_medium: params.get('utm_medium') || null,
      utm_campaign: params.get('utm_campaign') || null,
      ref_code: params.get('ref') || null,
    };
  } catch {
    return {};
  }
}

export type FunnelEvent =
  | 'landing_view'
  | 'landing_scroll_depth'
  | 'cta_click'
  | 'input_method_selected'
  | 'auth_complete'
  | 'onboarding_start'
  | 'onboarding_step'
  | 'scan_start'
  | 'scan_complete'
  | 'score_view'
  | 'tab_view'
  | 'share_click'
  | 'pdf_download'
  | 'feedback_submit'
  | 'micro_feedback'
  | 'return_visit'
  | 'error_view'
  | 'pro_upgrade_click'
  | 'rescan_from_upgrade_card';

interface QueuedEvent {
  event_type: FunnelEvent;
  user_id: string | null;
  payload: Record<string, unknown>;
}

/**
 * Lightweight analytics hook that batches events to Supabase analytics_events table.
 * Deduplicates identical events within a 2-second window.
 * Batches events for efficient transmission (max 10 events or 5-second window).
 */
export function useAnalytics() {
  const lastEventRef = useRef<{ type: string; ts: number }>({ type: '', ts: 0 });
  const queueRef = useRef<QueuedEvent[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Flush queued events to Supabase
  const flushQueue = useCallback(async () => {
    if (queueRef.current.length === 0) return;

    const eventsToSend = [...queueRef.current];
    queueRef.current = [];

    try {
      // Insert all queued events in a single batch
      const { error } = await supabase.from('analytics_events' as any).insert(
        eventsToSend.map((e) => ({
          event_type: e.event_type,
          user_id: e.user_id,
          payload: e.payload,
          created_at: new Date().toISOString(),
        }))
      );

      if (error) {
        console.debug('[analytics] batch insert failed:', error.message);
      } else {
        console.debug(`[analytics] flushed ${eventsToSend.length} events`);
      }
    } catch (e) {
      // Analytics should never block UX
      console.debug('[analytics] flush failed:', e);
    }
  }, []);

  // Schedule flush when queue reaches capacity or time window
  const scheduleFlush = useCallback(() => {
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);

    if (queueRef.current.length >= 10) {
      // Immediate flush if queue is full
      flushQueue();
    } else {
      // Defer flush by 5 seconds
      flushTimeoutRef.current = setTimeout(() => {
        flushQueue();
      }, 5000);
    }
  }, [flushQueue]);

  const track = useCallback(async (
    eventType: FunnelEvent,
    payload?: Record<string, unknown>
  ) => {
    // Deduplicate same event within 2s
    const now = Date.now();
    if (lastEventRef.current.type === eventType && now - lastEventRef.current.ts < 2000) {
      return;
    }
    lastEventRef.current = { type: eventType, ts: now };

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Add to queue
      queueRef.current.push({
        event_type: eventType,
        user_id: user?.id || null,
        payload: {
          ...payload,
          timestamp: new Date().toISOString(),
          url: window.location.pathname,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        },
      });

      // Schedule flush
      scheduleFlush();
    } catch (e) {
      // Analytics should never block UX
      console.debug('[analytics] event queueing failed:', eventType, e);
    }
  }, [scheduleFlush]);

  // Cleanup: flush on unmount
  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
      // Flush remaining events synchronously if possible
      if (queueRef.current.length > 0) {
        flushQueue();
      }
    };
  }, [flushQueue]);

  return { track };
}

/**
 * use-insight-track.ts
 * 
 * Foundational data flywheel hook — tracks which insights users actually engage with.
 * 
 * Audit finding: Zero insight interaction data collected. The system doesn't know
 * if anyone read the advice, which card triggered upgrade intent, or which skill
 * recommendation led to a rescan. Without this, the product cannot improve.
 * 
 * This hook provides:
 * 1. trackInsight() — fire-and-forget event logging (non-blocking)
 * 2. useInsightVisible() — IntersectionObserver hook that auto-fires 'viewed' when
 *    a card scrolls into view and stays visible for >1.5 seconds (dwell = intent)
 * 
 * Events stored in: score_events table (existing) with event_type='insight_interaction'
 * Schema: { scan_id, user_id, event_type, metadata: { field_name, interaction_type, skill_mentioned, dwell_ms } }
 * 
 * Why score_events and not a new table: avoids requiring a DB migration for this to work.
 * The metadata JSONB field handles the variable structure.
 */

import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type InsightInteractionType =
  | 'viewed'           // card scrolled into view and stayed >1.5s
  | 'expanded'         // user clicked to expand (e.g. skill threat intel row)
  | 'dismissed'        // user explicitly closed/dismissed
  | 'action_clicked'   // user clicked a resource link or action button
  | 'upgrade_triggered' // this card triggered the paywall click
  | 'copied';          // user copied advice text

interface InsightTrackPayload {
  scanId: string;
  fieldName: string;                    // e.g. 'free_advice_1', 'skill_threat_intel', 'moat_narrative'
  interactionType: InsightInteractionType;
  skillMentioned?: string;              // skill name if relevant
  dwellMs?: number;                     // milliseconds visible before action
}

let _queuedEvents: InsightTrackPayload[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

// Batched flush — sends all queued events in one DB call to minimise API overhead
async function flushQueue() {
  if (_queuedEvents.length === 0) return;
  const batch = [..._queuedEvents];
  _queuedEvents = [];

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const rows = batch.map(e => ({
      scan_id: e.scanId,
      user_id: user?.id ?? null,
      event_type: 'insight_interaction',
      metadata: {
        field_name: e.fieldName,
        interaction_type: e.interactionType,
        skill_mentioned: e.skillMentioned ?? null,
        dwell_ms: e.dwellMs ?? null,
        ts: Date.now(),
      },
    }));
    // Fire-and-forget — insight tracking is never critical path
    await supabase.from('score_events' as any).insert(rows);
  } catch {
    // Silent failure — insight tracking must never break the main flow
  }
}

function scheduleFlush() {
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(flushQueue, 3000); // batch within 3s window
}

/**
 * trackInsight — fire-and-forget insight interaction event.
 * Batched: multiple calls within 3s are sent as a single DB insert.
 */
export function trackInsight(payload: InsightTrackPayload) {
  _queuedEvents.push(payload);
  scheduleFlush();
}

/**
 * useInsightVisible — auto-tracks when an insight card becomes visible.
 * Uses IntersectionObserver with a 1.5s dwell threshold to distinguish
 * "glimpsed while scrolling" from "actually read".
 */
export function useInsightVisible(
  scanId: string | undefined,
  fieldName: string,
  skillMentioned?: string
) {
  const ref = useRef<HTMLDivElement>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTrackedRef = useRef(false);
  const entryTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!scanId || !ref.current || hasTrackedRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entryTimeRef.current = Date.now();
          // Fire 'viewed' after 1.5s of continuous visibility
          dwellTimerRef.current = setTimeout(() => {
            if (!hasTrackedRef.current) {
              hasTrackedRef.current = true;
              trackInsight({
                scanId,
                fieldName,
                interactionType: 'viewed',
                skillMentioned,
                dwellMs: Date.now() - entryTimeRef.current,
              });
            }
          }, 1500);
        } else {
          if (dwellTimerRef.current) {
            clearTimeout(dwellTimerRef.current);
            dwellTimerRef.current = null;
          }
        }
      },
      { threshold: 0.6 } // 60% of card must be visible
    );

    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, [scanId, fieldName, skillMentioned]);

  const trackAction = useCallback((type: InsightInteractionType, dwellMs?: number) => {
    if (!scanId) return;
    trackInsight({ scanId, fieldName, interactionType: type, skillMentioned, dwellMs });
  }, [scanId, fieldName, skillMentioned]);

  return { ref, trackAction };
}

/**
 * Funnel tracking for the Model B post-scan reveal journey.
 *
 * Why this exists:
 *   We have ~4 scans/week reaching /results/model-b but ZERO visibility
 *   into what happens after the scan loads. This hook fires the missing
 *   events so we can answer: do users actually see the result? Do they
 *   navigate the cards? Do they hit the share/CTA?
 *
 *   Writes go to `behavior_events` (already exists, RLS already correct
 *   for both anon and authed users). The hook is silent on failure —
 *   tracking must never break the UI.
 *
 *   Designed as ONE hook with side-effects so the host page only needs
 *   a single line to wire the entire funnel — keeps god-file edits to
 *   the absolute minimum (CLAUDE.md Rule 2: additive over modifying).
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type FunnelEvent =
  | "result_loaded"        // first paint of cardData (proof the user actually saw the report)
  | "card_viewed"          // user advanced to a new card
  | "journey_completed"    // visited all 7 cards
  | "share_opened"         // share modal/drawer opened
  | "cta_post_reveal";     // any CTA clicked after the reveal

async function fire(scanId: string | null, event: FunnelEvent, props: Record<string, unknown> = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("behavior_events" as any).insert({
      user_id: session?.user?.id ?? null,
      scan_id: scanId,
      event_name: event,
      properties: props,
    });
  } catch {
    // Silent — see file header.
  }
}

interface Args {
  scanId: string | null;
  resultLoaded: boolean;       // truthy once cardData exists
  currentCard: number;         // 0..N index
  visitedCount: number;        // size of visitedCards set
  totalCards: number;          // expected journey length (7 for Model B)
}

/**
 * Single-line wire-up for ResultsModelB. Fires events idempotently:
 *   - result_loaded: once per mount, when result first becomes available
 *   - card_viewed: each time currentCard changes (after initial)
 *   - journey_completed: once when visitedCount first hits totalCards
 *
 * Other events (share_opened, cta_post_reveal) should be fired imperatively
 * by the components that own those interactions, using `trackFunnelEvent`.
 */
export function useScanFunnelTracking({
  scanId,
  resultLoaded,
  currentCard,
  visitedCount,
  totalCards,
}: Args) {
  const firedLoaded = useRef(false);
  const firedComplete = useRef(false);
  const lastCard = useRef<number | null>(null);

  // result_loaded — first time we have data
  useEffect(() => {
    if (resultLoaded && !firedLoaded.current && scanId) {
      firedLoaded.current = true;
      fire(scanId, "result_loaded", { entry_card: currentCard });
    }
  }, [resultLoaded, scanId, currentCard]);

  // card_viewed — each navigation
  useEffect(() => {
    if (!resultLoaded || !scanId) return;
    if (lastCard.current === null) {
      lastCard.current = currentCard;
      return; // skip the initial render to avoid duplicating result_loaded
    }
    if (lastCard.current !== currentCard) {
      lastCard.current = currentCard;
      fire(scanId, "card_viewed", { card_index: currentCard });
    }
  }, [currentCard, resultLoaded, scanId]);

  // journey_completed — visited every card
  useEffect(() => {
    if (
      !firedComplete.current &&
      resultLoaded &&
      scanId &&
      totalCards > 0 &&
      visitedCount >= totalCards
    ) {
      firedComplete.current = true;
      fire(scanId, "journey_completed", { visited_count: visitedCount });
    }
  }, [visitedCount, totalCards, resultLoaded, scanId]);
}

/** Imperative escape hatch for share/CTA components. */
export function trackFunnelEvent(
  scanId: string | null,
  event: FunnelEvent,
  props: Record<string, unknown> = {},
) {
  return fire(scanId, event, props);
}

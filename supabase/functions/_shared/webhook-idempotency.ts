// ═══════════════════════════════════════════════════════════════
// webhook-idempotency.ts — Event-level dedup for incoming webhooks.
//
// Pattern:
//   const dup = await markEventProcessed("razorpay", event.id, event);
//   if (dup) return new Response(JSON.stringify({ ok: true, deduped: true }), ...);
//   // ... process the event ...
//
// Backed by public.processed_events (UNIQUE on provider+event_id).
// Fire-and-forget design: if the ledger insert fails for any reason
// other than a duplicate, we LOG and ALLOW the event through (better
// to double-process than to drop a valid payment). Caller MUST still
// hold its own resource-level idempotency check (e.g. "is this scan
// already paid?") as a second line of defense.
//
// Razorpay-specific note: the consultant-owned razorpay-webhook
// already has scan-level idempotency. This helper is the recommended
// next layer. Adoption requires operator sign-off per CLAUDE.md Rule 3.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from "./supabase-client.ts";

export interface MarkEventResult {
  /** true = this event was already processed (caller should short-circuit) */
  duplicate: boolean;
  /** true = ledger insert failed for non-duplicate reason (caller should proceed but log) */
  ledger_error: boolean;
}

/**
 * Atomically claim an event_id for processing.
 * Returns { duplicate: true } if the event has been seen before.
 */
export async function markEventProcessed(
  provider: string,
  event_id: string,
  payload: unknown,
  event_type?: string,
): Promise<MarkEventResult> {
  if (!provider || !event_id) {
    // Defensive: never block on bad inputs
    return { duplicate: false, ledger_error: true };
  }

  try {
    const sb = createAdminClient();
    const { error } = await sb
      .from("processed_events")
      .insert({
        provider,
        event_id,
        event_type: event_type ?? null,
        payload: (payload ?? null) as Record<string, unknown> | null,
      });

    if (!error) return { duplicate: false, ledger_error: false };

    // 23505 = unique_violation in Postgres
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      return { duplicate: true, ledger_error: false };
    }

    console.warn(
      `[webhook-idempotency] ledger insert failed for ${provider}/${event_id}:`,
      error.message,
    );
    return { duplicate: false, ledger_error: true };
  } catch (e) {
    console.warn(
      `[webhook-idempotency] swallowed error for ${provider}/${event_id}:`,
      (e as Error)?.message,
    );
    return { duplicate: false, ledger_error: true };
  }
}

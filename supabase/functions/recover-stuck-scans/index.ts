// ═══════════════════════════════════════════════════════════════
// recover-stuck-scans — finds scans stuck in pending/processing
// and either re-invokes process-scan or marks them error so the UI
// can surface a retry CTA. Designed to run on a 5-minute cron.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from "../_shared/supabase-client.ts";
import { logEdgeError } from "../_shared/edge-logger.ts";
import { fetchWithTimeout } from "../_shared/fetch-with-timeout.ts";

const PENDING_TIMEOUT_MIN = 1;     // pending > 1 min → re-trigger (was 2)
const PROCESSING_TIMEOUT_MIN = 8;  // processing > 8 min → mark error (was 10; tighter w/ raised agent timeouts)
const MAX_PER_RUN = 50;            // safety cap (was 25; cron now runs every 1m)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createAdminClient();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const result = {
    retriggered: 0,
    marked_error: 0,
    errors: [] as string[],
  };

  try {
    // 1. Find stuck pending scans (older than threshold)
    const pendingCutoff = new Date(Date.now() - PENDING_TIMEOUT_MIN * 60_000).toISOString();
    const { data: pendingScans } = await supabase
      .from("scans")
      .select("id, created_at")
      .eq("scan_status", "pending")
      .lt("created_at", pendingCutoff)
      .limit(MAX_PER_RUN);

    // Fire all retriggers concurrently — process-scan takes ~120s; awaiting serially
    // means a 25-row backlog takes 50 minutes to clear. The edge runtime keeps each
    // request alive via EdgeRuntime.waitUntil inside process-scan itself.
    const triggers = (pendingScans ?? []).map(async (scan: { id: string; created_at: string }) => {
      try {
        const resp = await fetchWithTimeout(`${supabaseUrl}/functions/v1/process-scan`, {
          method: "POST",
          // process-scan itself uses EdgeRuntime.waitUntil; we just need the HTTP
          // ack. 30s is plenty for the trigger to be accepted and queued.
          timeoutMs: 30000,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ scanId: scan.id, forceRefresh: true }),
        });
        await resp.text().catch(() => "");
        if (!resp.ok) {
          result.errors.push(`pending ${scan.id} retry HTTP ${resp.status}`);
        } else {
          result.retriggered += 1;
        }
      } catch (e) {
        result.errors.push(`pending ${scan.id}: ${(e as Error).message}`);
      }
    });
    // Wait for all dispatches to be sent (not for processing to complete)
    await Promise.allSettled(triggers);

    // 2a. Fast-fail orphans where the client crashed between create-scan and upload-resume.
    // These are recognizable by the placeholder resume_file_path = 'pending-upload' and
    // will never make progress because process-scan was never invoked. 2-min cap keeps
    // the user's "Try again" CTA fast during the 50-user testing window.
    const orphanCutoff = new Date(Date.now() - 2 * 60_000).toISOString();
    const { data: orphans } = await supabase
      .from("scans")
      .update({ scan_status: "error" })
      .eq("scan_status", "processing")
      .eq("resume_file_path", "pending-upload")
      .lt("created_at", orphanCutoff)
      .select("id");
    if (orphans?.length) result.marked_error += orphans.length;

    // 2b. Mark long-stuck processing scans as error so UI shows retry button
    const processingCutoff = new Date(Date.now() - PROCESSING_TIMEOUT_MIN * 60_000).toISOString();
    const { data: stuckProcessing, error: procErr } = await supabase
      .from("scans")
      .update({ scan_status: "error" })
      .eq("scan_status", "processing")
      .lt("created_at", processingCutoff)
      .select("id");

    if (procErr) {
      result.errors.push(`processing update: ${procErr.message}`);
    } else {
      result.marked_error += (stuckProcessing ?? []).length;
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message;
    await logEdgeError({ functionName: "recover-stuck-scans", errorMessage: msg }).catch(() => {});
    return new Response(JSON.stringify({ success: false, error: msg, ...result }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

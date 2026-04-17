// ═══════════════════════════════════════════════════════════════
// recover-stuck-scans — finds scans stuck in pending/processing
// and either re-invokes process-scan or marks them error so the UI
// can surface a retry CTA. Designed to run on a 5-minute cron.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from "../_shared/supabase-client.ts";
import { logEdgeError } from "../_shared/edge-logger.ts";

const PENDING_TIMEOUT_MIN = 2;     // pending > 2 min → re-trigger
const PROCESSING_TIMEOUT_MIN = 10; // processing > 10 min → mark error (worker likely crashed)
const MAX_PER_RUN = 25;            // safety cap

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

    for (const scan of (pendingScans ?? []) as Array<{ id: string; created_at: string }>) {
      try {
        // Re-invoke process-scan with this scanId
        const resp = await fetch(`${supabaseUrl}/functions/v1/process-scan`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ scanId: scan.id, forceRefresh: true }),
        });
        // Drain body to avoid resource leak
        await resp.text().catch(() => "");
        if (!resp.ok) {
          result.errors.push(`pending ${scan.id} retry HTTP ${resp.status}`);
        } else {
          result.retriggered += 1;
        }
      } catch (e) {
        result.errors.push(`pending ${scan.id}: ${(e as Error).message}`);
      }
    }

    // 2. Mark long-stuck processing scans as error so UI shows retry button
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
      result.marked_error = (stuckProcessing ?? []).length;
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

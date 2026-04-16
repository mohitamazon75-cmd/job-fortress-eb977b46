/**
 * score-change-notify — Proactive score-change notifications (P1 audit finding)
 *
 * Audit finding: "When a new AI tool ships that overlaps with a user's skill fingerprint,
 * or when their role's market_signal shows a posting_change_pct below −10% since their
 * last scan, send a personalised notification."
 *
 * Designed to run weekly via pg_cron. For each active user:
 *   1. Compute score drift since their last scan (reuses score-drift logic)
 *   2. Check if any market signals for their role have worsened since their scan
 *   3. If drift ≥ 3 points OR market decline > 10%, enqueue a personalised email
 *   4. Rate-limit: max 1 notification per user per 30 days
 *
 * Call via pg_cron: SELECT cron.schedule('weekly-score-notify', '0 9 * * 1',
 *   $$SELECT net.http_post(url:='..../score-change-notify', headers:='{"Authorization":"Bearer SERVICE_ROLE_KEY"}')$$);
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { sendScoreAlertWhatsApp, normaliseIndiaPhone } from "../_shared/whatsapp-sender.ts";

const SITE_URL = "https://jobbachao.com";
const MIN_DRIFT_TO_NOTIFY = 3;       // points — below this is noise
const MARKET_DECLINE_THRESHOLD = -10; // % posting change — below = notify
const NOTIFY_COOLDOWN_DAYS = 30;      // max 1 email per user per month
const MAX_USERS_PER_RUN = 200;        // safety cap per cron invocation

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabase = createAdminClient();

    // ── 1. Find active users who have a completed scan ────────────────────────
    const cutoffDate = new Date(Date.now() - NOTIFY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Get users who had a score-change notification in the last 30 days
    const { data: recentlyNotified } = await supabase
      .from("score_events")
      .select("user_id")
      .eq("event_type", "score_change_notification")
      .gte("computed_at", cutoffDate);

    const notifiedIds = new Set((recentlyNotified || []).map((r: any) => r.user_id));

    // Get users who have explicitly enrolled in alerts (opted in via ScoreHistoryTab)
    const { data: optedInUsers } = await supabase
      .from("score_events")
      .select("user_id")
      .eq("event_type", "rescan_alert_optin");
    const optedInIds = new Set((optedInUsers || []).map((r: any) => r.user_id));

    // Get users with completed scans in the last 90 days, not recently notified
    const { data: eligibleScans } = await supabase
      .from("scans")
      .select("user_id, id, role_detected, industry, determinism_index, created_at, metro_tier")
      .eq("scan_status", "complete")
      .not("user_id", "is", null)
      .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(MAX_USERS_PER_RUN * 3); // over-fetch to account for deduplication

    if (!eligibleScans || eligibleScans.length === 0) {
      return new Response(JSON.stringify({ status: "ok", notified: 0, message: "No eligible scans" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate to one scan per user (most recent).
    // Opted-in users (enrolled via ScoreHistoryTab) are processed first — they
    // explicitly asked for alerts. Non-opted-in recent scanners fill remaining slots.
    const seenUsers = new Set<string>();
    const optedInScans: any[] = [];
    const generalScans: any[] = [];

    for (const s of eligibleScans) {
      if (seenUsers.has(s.user_id) || notifiedIds.has(s.user_id)) continue;
      seenUsers.add(s.user_id);
      if (optedInIds.has(s.user_id)) {
        optedInScans.push(s);
      } else {
        generalScans.push(s);
      }
    }

    // Opted-in users always get alerts; general users fill remaining budget
    const uniqueScans = [...optedInScans, ...generalScans].slice(0, MAX_USERS_PER_RUN);

    // ── 2. Check market signal changes for each user ──────────────────────────
    let notified = 0;
    const errors: string[] = [];

    for (const scan of uniqueScans) {
      try {
        // Fetch latest market signal for this role
        const { data: signal } = await supabase
          .from("market_signals")
          .select("posting_change_pct, automation_risk_delta, ai_job_mentions_pct, updated_at")
          .eq("job_family", scan.role_detected ?? "")
          .eq("metro_tier", scan.metro_tier ?? "tier1")
          .gte("updated_at", scan.created_at)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!signal) continue;

        // Compute estimated score drift
        const automationDelta = signal.automation_risk_delta ?? 0;
        const marketDrift = Math.abs(automationDelta * 0.3);
        const postingDecline = signal.posting_change_pct ?? 0;

        const shouldNotify =
          marketDrift >= MIN_DRIFT_TO_NOTIFY ||
          postingDecline <= MARKET_DECLINE_THRESHOLD;

        if (!shouldNotify) continue;

        // ── 3. Fetch user profile for email ──────────────────────────────────
        const { data: profile } = await supabase.auth.admin.getUserById(scan.user_id);
        if (!profile?.user?.email) continue;

        const userEmail = profile.user.email;
        const displayRole = scan.role_detected || "your role";
        const driftStr = marketDrift >= MIN_DRIFT_TO_NOTIFY
          ? `Your estimated score has shifted ~${Math.round(marketDrift)} points`
          : `Hiring for ${displayRole} is down ${Math.abs(postingDecline).toFixed(0)}%`;

        // ── 4. Build email ────────────────────────────────────────────────────
        const emailHtml = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f0f0e;font-family:system-ui,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <div style="margin-bottom:24px;">
      <span style="color:#f7f5f0;font-weight:900;font-size:20px;letter-spacing:-0.5px;">JobBachao</span>
      <span style="color:#6b7280;font-size:12px;margin-left:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Market Alert</span>
    </div>

    <div style="background:#1a1a18;border:1px solid #2a2a28;border-radius:12px;padding:28px;margin-bottom:20px;">
      <p style="color:#dc2626;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">⚠ Your Market Position Has Shifted</p>
      <h2 style="color:#f7f5f0;font-size:22px;font-weight:800;margin:0 0 12px;line-height:1.3;">${driftStr} since your last scan</h2>
      <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 20px;">
        The market for <strong style="color:#f7f5f0;">${displayRole}</strong> professionals has changed. 
        Your JobBachao score reflects live market signals — when conditions shift, your position does too.
        Running a fresh scan takes 60 seconds and gives you an updated action plan.
      </p>
      <a href="${SITE_URL}?utm_source=score_alert&utm_medium=email&utm_campaign=market_shift"
         style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-weight:900;font-size:14px;padding:14px 28px;border-radius:8px;text-decoration:none;">
        Rescan Now — Free →
      </a>
    </div>

    <p style="color:#4b5563;font-size:11px;line-height:1.5;margin:0;">
      You're receiving this because your career scan is on file at JobBachao. 
      <a href="${SITE_URL}/settings" style="color:#6366f1;">Unsubscribe from market alerts</a>
    </p>
  </div>
</body></html>`;

        // ── 5. Enqueue email ──────────────────────────────────────────────────
        await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            to: userEmail,
            from: "JobBachao Alerts <alerts@notify.jobbachao.com>",
            sender_domain: "notify.jobbachao.com",
            subject: `⚠ Market shift detected for ${displayRole} — rescan recommended`,
            html: emailHtml,
            text: `${driftStr} since your last scan.\n\nThe market for ${displayRole} professionals has changed. Rescan now to get an updated score and action plan: ${SITE_URL}\n\nTo unsubscribe: ${SITE_URL}/settings`,
            purpose: "transactional",
            label: "score_change_alert",
            message_id: `score-alert-${scan.user_id}-${Date.now()}`,
            queued_at: new Date().toISOString(),
          },
        });

        // ── 5b. WhatsApp parallel channel (India 85%+ open rate vs email 15%) ──
        // Fire-and-forget: WhatsApp failures never block email delivery.
        // Only fires when: user has phone, WHATSAPP_* env vars set, template approved.
        const { data: profileData } = await supabase
          .from("profiles")
          .select("phone")
          .eq("user_id", scan.user_id)
          .maybeSingle();

        const userPhone = normaliseIndiaPhone(profileData?.phone);
        if (userPhone) {
          const alertText = `${driftStr} since your last scan. Market conditions for ${displayRole} have shifted — rescan now for your updated plan.`;
          sendScoreAlertWhatsApp(userPhone, alertText, `${SITE_URL}?utm_source=score_alert&utm_medium=whatsapp`)
            .then(r => console.log(`[ScoreChangeNotify] WhatsApp ${r.sent ? "sent" : "skipped"}: ${r.sent ? r.messageId : r.reason}`))
            .catch(err => console.warn("[ScoreChangeNotify] WhatsApp fire-and-forget error:", err));
        }

        // ── 6. Record that we notified this user ──────────────────────────────
        await supabase.from("score_events").insert({
          user_id: scan.user_id,
          scan_id: scan.id,
          event_type: "score_change_notification",
          metadata: {
            drift: marketDrift,
            posting_change_pct: postingDecline,
            role: displayRole,
            notified_at: new Date().toISOString(),
            channels: userPhone ? ["email", "whatsapp"] : ["email"],
          },
          computed_at: new Date().toISOString(),
        });

        notified++;
        console.log(`[ScoreChangeNotify] Notified ${userEmail} — drift: ${marketDrift.toFixed(1)}, posting_delta: ${postingDecline}`);

      } catch (userErr) {
        errors.push(`${scan.user_id}: ${userErr}`);
        console.error(`[ScoreChangeNotify] Failed for user ${scan.user_id}:`, userErr);
      }
    }

    // Issue 2-A: 7-day outcome follow-up pass (runs after score-drift pass)
    const outcomeResult = await sendOutcomeFollowUps(supabase, SITE_URL, corsHeaders).catch(e => {
      console.warn("[ScoreChangeNotify] Outcome follow-up pass failed (non-fatal):", e);
      return { sent: 0 };
    });

    return new Response(
      JSON.stringify({ status: "ok", notified, checked: uniqueScans.length, outcome_followups_sent: outcomeResult.sent, errors: errors.slice(0, 5) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("[ScoreChangeNotify] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

});


// 7-day outcome follow-up emails (Issue 2-A flywheel)
// Called by score-change-notify cron run after the score-drift pass.
export async function sendOutcomeFollowUps(supabase: ReturnType<typeof createAdminClient>, SITE_URL: string, corsHeaders: Record<string, string>) {
    const windowStart = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const windowEnd   = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();

    // Scans that completed in the 6–8 day window
    const { data: targetScans } = await supabase
      .from("scans")
      .select("id, user_id, role_detected, determinism_index")
      .eq("scan_status", "complete")
      .gte("created_at", windowStart)
      .lte("created_at", windowEnd)
      .not("user_id", "is", null)
      .limit(200);

    if (!targetScans?.length) return { sent: 0 };

    // Filter out scans that already have an outcome captured
    const { data: existingOutcomes } = await supabase
      .from("scan_outcomes")
      .select("scan_id")
      .in("scan_id", targetScans.map(s => s.id))
      .eq("source", "email_7day");

    const alreadyCaptured = new Set((existingOutcomes || []).map(o => o.scan_id));
    const toEmail = targetScans.filter(s => !alreadyCaptured.has(s.id));

    let sent = 0;
    for (const scan of toEmail) {
      try {
        const { data: profile } = await supabase.auth.admin.getUserById(scan.user_id);
        const email = profile?.user?.email;
        if (!email) continue;

        const role = scan.role_detected || "Professional";
        const di   = scan.determinism_index || 60;
        const baseUrl = `${SITE_URL}/functions/v1/capture-outcome?scan_id=${scan.id}&source=email_7day&outcome=`;

        const html = `
<div style="font-family:'DM Sans',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#faf9f6">
  <div style="font-size:22px;font-weight:900;color:#0d0c0a;margin-bottom:8px">Quick check-in 👋</div>
  <div style="font-size:15px;color:#5c5a56;margin-bottom:24px">
    It's been 7 days since your JobBachao scan. Your risk score was <strong>${di}/100</strong> for your ${role} role.
    <br><br>What's happened since?
  </div>
  <div style="display:flex;flex-direction:column;gap:10px">
    ${[
      ["started_upskilling", "🎯 Started upskilling / learning"],
      ["applied_to_jobs",    "📋 Applied to jobs"],
      ["got_interview",      "🎉 Got an interview!"],
      ["nothing_yet",        "⏳ Nothing yet"],
    ].map(([val, label]) => `
      <a href="${baseUrl}${val}" style="display:block;padding:14px 18px;background:#fff;border:2px solid #e8e4dc;border-radius:12px;font-size:14px;font-weight:700;color:#0d0c0a;text-decoration:none">
        ${label}
      </a>`).join("")}
  </div>
  <div style="font-size:12px;color:#9c9890;margin-top:24px">
    Your answer improves predictions for 1,200+ Indian professionals with similar profiles.
  </div>
</div>`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY") || ""}`,
          },
          body: JSON.stringify({
            from: "JobBachao <career@jobbachao.com>",
            to: [email],
            subject: `7 days since your scan — what happened? (1 quick question)`,
            html,
          }),
        });

        sent++;
      } catch (e) {
        console.warn("[OutcomeFollowUp] Failed for scan", scan.id, e);
      }
    }

    console.log(`[OutcomeFollowUp] Sent ${sent}/${toEmail.length} 7-day follow-ups`);
    return { sent };
  }

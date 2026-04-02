// Sprint 22: Retention & Re-engagement — Nurture Email Edge Function
// Sends two behavioural nudges:
//   D+3  "d3_no_assessment"  → signed up 3+ days ago, zero assessments started
//   D+7  "d7_no_report"      → has at least one assessment but no report, 7+ days since signup
//
// Invoke manually or via a scheduled cron job hitting this endpoint.
// Uses LOVABLE_API_KEY for transactional email delivery.
// Uses SUPABASE_SERVICE_ROLE_KEY for DB access (no user auth required).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const TRANSACTIONAL_EMAIL_URL = "https://api.lovable.dev/v1/transactional-email";

// ─── Email templates ──────────────────────────────────────────────────────────

function d3NoAssessmentEmail(childName: string) {
  const name = childName || "your child";
  return {
    subject: `${name}'s Blueprint is waiting — start in 5 minutes`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" style="max-width:540px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#c45c1a,#0f4a5c);padding:32px 36px 24px;">
          <p style="margin:0;color:#f4d78a;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">KidSutra</p>
          <h1 style="margin:8px 0 0;color:#ffffff;font-size:26px;line-height:1.3;font-weight:700;">
            ${name}'s Future Blueprint™ is ready to build
          </h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 36px;">
          <p style="margin:0 0 18px;color:#374151;font-size:16px;line-height:1.7;">
            You set up your account 3 days ago — and the 5-step assessment is still waiting for you.
          </p>
          <p style="margin:0 0 18px;color:#374151;font-size:15px;line-height:1.7;">
            Every day without a Blueprint is a day you're making decisions without the data.
            The assessment takes <strong>~25 minutes</strong> and the first step is completely free.
          </p>

          <!-- What you'll get -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef7ee;border-radius:12px;padding:20px;margin:0 0 24px;">
            <tr><td>
              <p style="margin:0 0 12px;color:#92400e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">What ${name}'s Blueprint reveals</p>
              ${["🧠 Brain type &amp; learning style", "🏏 Sports potential score", "🚀 Top 5 career pathways", "📋 5-year parent action plan", "⚠️ Early-warning health flags"].map(item => `
              <p style="margin:0 0 8px;color:#374151;font-size:14px;">✓ ${item}</p>`).join("")}
            </td></tr>
          </table>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background:linear-gradient(135deg,#c45c1a,#a94916);border-radius:12px;padding:16px 32px;">
              <a href="https://kidsutra.aidemoprojects.com" style="color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;display:block;text-align:center;">
                Start ${name}'s Assessment →
              </a>
            </td></tr>
          </table>

          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
            Free to start · Blueprint report ₹999 · Less than one counsellor session
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:20px 36px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.6;">
            KidSutra by SplinkPro · ICMR-NIN &amp; IAP Benchmarked · DPDPA 2023 Compliant<br>
            <a href="https://kidsutra.aidemoprojects.com" style="color:#9ca3af;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `${name}'s Future Blueprint™ is waiting.\n\nYou signed up 3 days ago but haven't started the assessment yet.\n\nThe 5-step assessment takes ~25 minutes and the first step is completely free.\n\nStart here: https://kidsutra.aidemoprojects.com\n\nKidSutra — India's First Scientific Blueprint for Your Child`,
  };
}

function d7NoReportEmail(childName: string, doneCount: number) {
  const name = childName || "your child";
  const remaining = Math.max(0, 3 - doneCount);
  return {
    subject: `You're ${remaining} assessment${remaining !== 1 ? "s" : ""} away from ${name}'s Blueprint`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" style="max-width:540px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0f4a5c,#3b1f5e);padding:32px 36px 24px;">
          <p style="margin:0;color:#f4d78a;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">KidSutra</p>
          <h1 style="margin:8px 0 0;color:#ffffff;font-size:26px;line-height:1.3;font-weight:700;">
            ${doneCount} of 3 done — finish ${name}'s Blueprint
          </h1>
        </td></tr>

        <!-- Progress bar -->
        <tr><td style="padding:24px 36px 0;">
          <p style="margin:0 0 10px;color:#6b7280;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Assessment Progress</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${["Physical", "Cognitive", "Nutrition"].map((label, i) => `
              <td style="padding:0 4px 0 0;width:33%;">
                <div style="height:8px;border-radius:4px;background:${i < doneCount ? "#c45c1a" : "#e5e7eb"};"></div>
                <p style="margin:4px 0 0;font-size:10px;color:${i < doneCount ? "#c45c1a" : "#9ca3af"};font-weight:600;">${label}</p>
              </td>`).join("")}
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:24px 36px 32px;">
          <p style="margin:0 0 18px;color:#374151;font-size:16px;line-height:1.7;">
            You started ${name}'s assessment 7 days ago and made great progress — but the Blueprint is still locked.
          </p>
          <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">
            ${remaining > 0
              ? `Just ${remaining} more assessment${remaining !== 1 ? "s" : ""} to go. It takes less than 10 minutes each.`
              : `All core assessments are done — just generate your Blueprint report to unlock the full insight.`}
          </p>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background:linear-gradient(135deg,#0f4a5c,#0d3d4d);border-radius:12px;padding:16px 32px;">
              <a href="https://kidsutra.aidemoprojects.com" style="color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;display:block;text-align:center;">
                Continue ${name}'s Blueprint →
              </a>
            </td></tr>
          </table>

          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
            Free to continue · Blueprint report ₹999 one-time
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:20px 36px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.6;">
            KidSutra by SplinkPro · ICMR-NIN &amp; IAP Benchmarked · DPDPA 2023 Compliant<br>
            <a href="https://kidsutra.aidemoprojects.com" style="color:#9ca3af;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `${doneCount} of 3 assessments done — ${name}'s Blueprint is ${remaining > 0 ? `${remaining} step${remaining !== 1 ? "s" : ""} away` : "ready to generate"}.\n\nContinue here: https://kidsutra.aidemoprojects.com\n\nKidSutra — India's First Scientific Blueprint for Your Child`,
  };
}

// ─── Send via Lovable transactional email API ─────────────────────────────────

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(TRANSACTIONAL_EMAIL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        to,
        subject,
        html,
        text,
        from_name: "KidSutra",
        purpose: "transactional",
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[nurture-emails] Email send failed ${res.status}: ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[nurture-emails] Email send error:", err);
    return false;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Simple bearer auth to prevent public invocation
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (token !== SERVICE_ROLE_KEY && token !== LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const now = new Date();
  const results = { d3_sent: 0, d7_sent: 0, skipped: 0, errors: 0 };

  try {
    // ── D+3: signed up 3+ days ago, no assessments at all ────────────────────
    const d3Cutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const d3MaxCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(); // don't email >30 days old

    const { data: d3Users } = await db
      .from("profiles")
      .select("user_id, email, name, created_at")
      .lte("created_at", d3Cutoff)
      .gte("created_at", d3MaxCutoff)
      .not("email", "is", null);

    for (const profile of d3Users ?? []) {
      // Skip if already sent this nudge
      const { data: existing } = await db
        .from("email_nudges")
        .select("id")
        .eq("user_id", profile.user_id)
        .eq("nudge_type", "d3_no_assessment")
        .maybeSingle();
      if (existing) { results.skipped++; continue; }

      // Check if they have any assessments
      const { data: assessments } = await db
        .from("assessments")
        .select("id")
        .eq("user_id", profile.user_id)
        .limit(1);

      if (assessments && assessments.length > 0) { results.skipped++; continue; }

      // Get child name
      const { data: children } = await db
        .from("children")
        .select("name")
        .eq("user_id", profile.user_id)
        .order("created_at", { ascending: true })
        .limit(1);
      const childName = children?.[0]?.name ?? "";

      const { subject, html, text } = d3NoAssessmentEmail(childName);
      const sent = await sendEmail(profile.email, subject, html, text);

      if (sent) {
        await db.from("email_nudges").insert({
          user_id: profile.user_id,
          nudge_type: "d3_no_assessment",
          email: profile.email,
        });
        results.d3_sent++;
      } else {
        results.errors++;
      }
    }

    // ── D+7: has assessments but no report, 7+ days since signup ─────────────
    const d7Cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: d7Users } = await db
      .from("profiles")
      .select("user_id, email, name, created_at")
      .lte("created_at", d7Cutoff)
      .gte("created_at", d3MaxCutoff) // same 30-day max window
      .not("email", "is", null);

    for (const profile of d7Users ?? []) {
      // Skip if already sent this nudge
      const { data: existing } = await db
        .from("email_nudges")
        .select("id")
        .eq("user_id", profile.user_id)
        .eq("nudge_type", "d7_no_report")
        .maybeSingle();
      if (existing) { results.skipped++; continue; }

      // Must have at least one assessment
      const { data: assessments } = await db
        .from("assessments")
        .select("id, child_id")
        .eq("user_id", profile.user_id);
      if (!assessments || assessments.length === 0) { results.skipped++; continue; }

      // Must NOT have a report yet
      const childId = assessments[0].child_id;
      const { data: reports } = await db
        .from("reports")
        .select("id")
        .eq("user_id", profile.user_id)
        .eq("child_id", childId)
        .limit(1);
      if (reports && reports.length > 0) { results.skipped++; continue; }

      // Get child name
      const { data: children } = await db
        .from("children")
        .select("name")
        .eq("user_id", profile.user_id)
        .order("created_at", { ascending: true })
        .limit(1);
      const childName = children?.[0]?.name ?? "";

      const { subject, html, text } = d7NoReportEmail(childName, assessments.length);
      const sent = await sendEmail(profile.email, subject, html, text);

      if (sent) {
        await db.from("email_nudges").insert({
          user_id: profile.user_id,
          nudge_type: "d7_no_report",
          email: profile.email,
        });
        results.d7_sent++;
      } else {
        results.errors++;
      }
    }

    console.log("[nurture-emails] Run complete:", results);
    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[nurture-emails] Fatal error:", err);
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

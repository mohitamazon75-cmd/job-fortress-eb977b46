import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
// WhatsApp imports removed — profiles table doesn't have phone column yet



// ═══════════════════════════════════════════════════════════════
// AI Career Coach — Nudge Generator & Scheduler
// Two modes:
//   1. "schedule" — called after scan, creates 3 nudge rows
//   2. "generate" — called by cron, generates content for due nudges
//   3. "fetch"    — called by client, returns nudges for user
// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const body = await req.json();
    const mode = body.mode as string;

    const sbAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Mode: Schedule nudges after scan completion ──
    if (mode === "schedule") {
      const { scan_id, user_id } = body;
      if (!scan_id || !user_id) {
        return new Response(JSON.stringify({ error: "scan_id and user_id required" }), {
          status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Check if nudges already scheduled for this scan
      const { data: existing } = await sbAdmin
        .from("coach_nudges")
        .select("id")
        .eq("scan_id", scan_id)
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ ok: true, message: "Already scheduled" }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const now = new Date();
      const nudges = [
        { scan_id, user_id, nudge_type: "6h", scheduled_at: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString() },
        { scan_id, user_id, nudge_type: "24h", scheduled_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() },
        { scan_id, user_id, nudge_type: "48h", scheduled_at: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString() },
      ];

      const { error } = await sbAdmin.from("coach_nudges").insert(nudges);
      if (error) throw error;

      return new Response(JSON.stringify({ ok: true, scheduled: 3 }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ── Mode: Generate content for due nudges (called by cron) ──
    if (mode === "generate") {
      const { data: dueNudges, error: fetchErr } = await sbAdmin
        .from("coach_nudges")
        .select("*")
        .is("delivered_at", null)
        .is("content", null)
        .lte("scheduled_at", new Date().toISOString())
        .limit(20);

      if (fetchErr) throw fetchErr;
      if (!dueNudges || dueNudges.length === 0) {
        return new Response(JSON.stringify({ ok: true, processed: 0 }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      let processed = 0;

      for (const nudge of dueNudges) {
        try {
          // Fetch the scan report for context
          const { data: scan } = await sbAdmin
            .from("scans")
            .select("final_json_report, role_detected, industry")
            .eq("id", nudge.scan_id)
            .single();

          if (!scan?.final_json_report) {
            await sbAdmin.from("coach_nudges").update({
              delivered_at: new Date().toISOString(),
              content: { error: "No scan data available" },
            }).eq("id", nudge.id);
            continue;
          }

          const report = scan.final_json_report as Record<string, any>;
          const role = report.role || scan.role_detected || "Professional";
          const industry = report.industry || scan.industry || "";
          const topRiskSkills = (report.score_breakdown?.skill_adjustments || [])
            .sort((a: any, b: any) => (b.automation_risk || 0) - (a.automation_risk || 0))
            .slice(0, 3)
            .map((s: any) => s.skill_name);
          const moatSkills = (report.moat_skills || []).slice(0, 3);
          const score = report.stability_score || report.determinism_index || 50;

          const nudgeContent = buildDeterministicNudge(nudge.nudge_type, role, industry, topRiskSkills, moatSkills, score);

          await sbAdmin.from("coach_nudges").update({
            delivered_at: new Date().toISOString(),
            content: nudgeContent,
          }).eq("id", nudge.id);

          // ── Enqueue email reminder via transactional email queue ──
          try {
            const { data: profile } = await sbAdmin
              .from("profiles")
              .select("email, display_name")
              .eq("id", nudge.user_id)
              .single();

            if (profile?.email) {
              const nudgeLabels: Record<string, string> = {
                "6h": "Tonight's Move",
                "24h": "Market Pulse",
                "48h": "Progress Check",
              };
              const nudgeLabel = nudgeLabels[nudge.nudge_type] || "Career Coach";
              const displayName = profile.display_name || "there";
              const siteUrl = "https://jobbachao.com";

              const emailHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:28px;">🧠</span>
      <h1 style="font-size:20px;font-weight:800;color:#1a1a2e;margin:8px 0 0;">AI Career Coach</h1>
      <p style="font-size:12px;color:#888;margin:4px 0 0;text-transform:uppercase;letter-spacing:1px;">${nudgeLabel}</p>
    </div>
    <div style="background:#f8f9fc;border-radius:12px;padding:24px;border:1px solid #e8eaf0;">
      <p style="font-size:15px;color:#333;margin:0 0 8px;">Hey ${displayName} 👋</p>
      <h2 style="font-size:18px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">${nudgeContent.title}</h2>
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 20px;">${nudgeContent.message}</p>
      <a href="${siteUrl}" style="display:inline-block;background:#6366f1;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">${nudgeContent.action_label || "View Report"}</a>
    </div>
    <p style="font-size:11px;color:#aaa;text-align:center;margin:24px 0 0;">
      You're receiving this because you activated AI Career Coach on <a href="${siteUrl}" style="color:#6366f1;">JobBachao</a>.
      This is nudge ${nudge.nudge_type === "48h" ? "3 of 3 — no more emails after this" : nudge.nudge_type === "24h" ? "2 of 3" : "1 of 3"}.
    </p>
  </div>
</body></html>`.trim();

              const emailPayload = {
                to: profile.email,
                from: "AI Career Coach <coach@notify.jobbachao.com>",
                sender_domain: "notify.jobbachao.com",
                subject: `${nudgeContent.title} — JobBachao Coach`,
                html: emailHtml,
                text: `${nudgeContent.title}\n\n${nudgeContent.message}\n\n${nudgeContent.action_label}: ${siteUrl}`,
                purpose: "transactional",
                label: "coach_nudge",
                message_id: `coach-${nudge.id}`,
                queued_at: new Date().toISOString(),
              };

              await sbAdmin.rpc("enqueue_email", {
                queue_name: "transactional_emails",
                payload: emailPayload,
              });
              console.log(`[CoachNudge] Enqueued email for nudge ${nudge.id} to ${profile.email}`);

              // WhatsApp channel placeholder — profiles table doesn't have phone yet
            }
          } catch (emailErr) {
            console.error(`[CoachNudge] Email enqueue failed for nudge ${nudge.id}:`, emailErr);
            // Non-fatal — nudge content is still saved
          }

          processed++;
        } catch (nudgeErr) {
          console.error(`[CoachNudge] Error processing nudge ${nudge.id}:`, nudgeErr);
        }
      }

      return new Response(JSON.stringify({ ok: true, processed }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ── Mode: Fetch nudges for authenticated user ──
    if (mode === "fetch") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const sbUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: claimsErr } = await sbUser.auth.getClaims(token);
      if (claimsErr || !claims?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const userId = claims.claims.sub;
      const { data: nudges, error: nudgesErr } = await sbUser
        .from("coach_nudges")
        .select("*")
        .eq("user_id", userId)
        .not("content", "is", null)
        .order("scheduled_at", { ascending: true });

      if (nudgesErr) throw nudgesErr;

      return new Response(JSON.stringify({ nudges: nudges || [] }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ── Mode: Mark nudge as seen ──
    if (mode === "mark_seen") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const sbUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );

      const { nudge_id } = body;
      const { error } = await sbUser
        .from("coach_nudges")
        .update({ seen_at: new Date().toISOString() })
        .eq("id", nudge_id);

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), {
      status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[CoachNudge] Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// Deterministic Coach Nudge Templates — No LLM call needed
// Keyed by: nudge_type × score_band × context
// ═══════════════════════════════════════════════════════════════

type ScoreBand = "critical" | "at_risk" | "moderate" | "safe";

function getScoreBand(score: number): ScoreBand {
  if (score <= 30) return "critical";
  if (score <= 50) return "at_risk";
  if (score <= 70) return "moderate";
  return "safe";
}

function buildDeterministicNudge(
  nudgeType: string,
  role: string,
  industry: string,
  topRiskSkills: string[],
  moatSkills: string[],
  score: number,
): {
  title: string;
  message: string;
  action_label: string;
  action_type: string;
  skill_focus?: string;
  whatsapp_text: string;
} {
  const band = getScoreBand(score);
  const riskSkill = topRiskSkills[0] || "your core tasks";
  const moat = moatSkills[0] || "your domain expertise";
  const field = industry || "your field";

  // ── 6h: "Tonight's Move" ──
  if (nudgeType === "6h") {
    const templates: Record<ScoreBand, any> = {
      critical: {
        title: `Your ${riskSkill} skill needs attention tonight`,
        message: `AI tools are actively replacing ${riskSkill} tasks in ${field}. Spend 20 minutes tonight exploring one AI tool that handles ${riskSkill} — learning it first turns the threat into your edge.`,
        action_label: "Start Learning",
        action_type: "learn_skill",
        skill_focus: riskSkill,
        whatsapp_text: `My AI career coach flagged ${riskSkill} as at-risk — spending 20 min tonight learning the AI tool behind it. Check yours 👉 jobbachao.com`,
      },
      at_risk: {
        title: `Quick win: Augment ${riskSkill} with AI`,
        message: `Your ${riskSkill} skills are solid but AI is gaining ground. Tonight, try automating one ${riskSkill} subtask with an AI tool — it'll save you hours and show your team you're ahead.`,
        action_label: "Find AI Tools",
        action_type: "learn_skill",
        skill_focus: riskSkill,
        whatsapp_text: `Just got a coaching nudge to augment ${riskSkill} with AI tonight. My career score: ${score}/100. What's yours? 👉 jobbachao.com`,
      },
      moderate: {
        title: `Sharpen your ${moat} edge`,
        message: `Your ${moat} is a strong moat — but it needs reinforcing. Spend 15 minutes reading about how top ${role}s in ${field} are combining ${moat} with AI workflows.`,
        action_label: "Explore Resources",
        action_type: "learn_skill",
        skill_focus: moat,
        whatsapp_text: `My AI coach says my strongest skill is ${moat}. Getting career intel on how to level up. Check yours 👉 jobbachao.com`,
      },
      safe: {
        title: `You're in a strong position, ${role}`,
        message: `Score ${score}/100 is excellent. Your ${moat} skills are hard to automate. Tonight, explore how you can mentor others on AI adoption — leadership during disruption is the ultimate moat.`,
        action_label: "View Insights",
        action_type: "explore_jobs",
        whatsapp_text: `My AI career safety score is ${score}/100! AI can't easily replace ${moat}. Check your score 👉 jobbachao.com`,
      },
    };
    return templates[band];
  }

  // ── 24h: "Market Pulse" ──
  if (nudgeType === "24h") {
    const templates: Record<ScoreBand, any> = {
      critical: {
        title: `Market update: ${role}s are pivoting fast`,
        message: `Companies in ${field} are rapidly adopting AI for ${riskSkill} tasks. The ${role}s who survive are those learning to supervise AI, not compete with it. Your biggest skill gap is ${riskSkill} augmentation.`,
        action_label: "See Pivot Options",
        action_type: "explore_jobs",
        skill_focus: riskSkill,
        whatsapp_text: `Got market intel on how ${role}s are adapting to AI. Eye-opening stuff. Check your career risk 👉 jobbachao.com`,
      },
      at_risk: {
        title: `Demand shift: ${moat} + AI is the combo`,
        message: `Job postings for ${role}s in ${field} increasingly require AI tool proficiency alongside ${moat}. The salary premium for this combo is growing. You already have ${moat} — adding AI fluency puts you ahead.`,
        action_label: "View Best-Fit Jobs",
        action_type: "explore_jobs",
        whatsapp_text: `My career coach says ${moat} + AI skills = salary premium. Market is shifting fast. Get your free analysis 👉 jobbachao.com`,
      },
      moderate: {
        title: `Your ${field} is evolving — here's how`,
        message: `${field} professionals who combine ${moat} with AI workflows are getting promoted faster. Your score of ${score}/100 puts you in a good position — but staying still means falling behind.`,
        action_label: "Explore Trends",
        action_type: "learn_skill",
        whatsapp_text: `Just got a market pulse from my AI career coach. ${field} is changing faster than expected. Free analysis 👉 jobbachao.com`,
      },
      safe: {
        title: `Your skills are in demand, ${role}`,
        message: `Good news: ${moat} remains one of the hardest skills to automate in ${field}. Companies are paying a premium for professionals who can combine it with AI oversight. You're well-positioned.`,
        action_label: "See Opportunities",
        action_type: "explore_jobs",
        whatsapp_text: `AI career coach confirms: ${moat} is in high demand and hard to automate. Score: ${score}/100. Check yours 👉 jobbachao.com`,
      },
    };
    return templates[band];
  }

  // ── 48h: "Progress Check" ──
  const templates48: Record<ScoreBand, any> = {
    critical: {
      title: `48 hours in — small steps matter`,
      message: `Even 30 minutes of learning compounds. If you explored any AI tool since your scan, you're already ahead of most ${role}s. Share your report with a colleague and rescan in 90 days to track your progress.`,
      action_label: "Share & Rescan",
      action_type: "share",
      whatsapp_text: `Been 48 hours since my AI career scan (${score}/100). Already learning new tools. Get your free career risk score 👉 jobbachao.com`,
    },
    at_risk: {
      title: `Check in: How's the upskilling going?`,
      message: `It's been 48 hours since your scan. Every AI tool you explore adds to your career armor. Share with a colleague who might benefit — and set a reminder to rescan in 90 days.`,
      action_label: "Share Report",
      action_type: "share",
      whatsapp_text: `My AI career coach just checked in on my progress. Score: ${score}/100. Join me in future-proofing 👉 jobbachao.com`,
    },
    moderate: {
      title: `Great start — keep the momentum`,
      message: `Your ${score}/100 score shows solid positioning. The key now is consistent small actions. Share your analysis with a colleague and rescan in 90 days — your score will likely improve.`,
      action_label: "Share & Track",
      action_type: "share",
      whatsapp_text: `48 hours into my AI career coaching. Score: ${score}/100 and improving. Free scan 👉 jobbachao.com`,
    },
    safe: {
      title: `Stay sharp — you're in great shape`,
      message: `With a ${score}/100 score, you're well-protected. But the landscape shifts fast. Share your analysis with your team and rescan quarterly to stay ahead of changes in ${field}.`,
      action_label: "Share Results",
      action_type: "share",
      whatsapp_text: `My AI career safety score: ${score}/100! Sharing with my team. Get yours free 👉 jobbachao.com`,
    },
  };
  return templates48[band];
}

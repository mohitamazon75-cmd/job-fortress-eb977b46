import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOCKOUT_WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 5;

function getIpHint(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { action } = body;

    // ─── LOGIN ─────────────────────────────────────────────────────────────
    if (action === "login") {
      const { password } = body;
      const ipHint = getIpHint(req);
      const lockoutCutoff = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000).toISOString();

      const { count: recentFailures } = await admin
        .from("admin_login_attempts")
        .select("*", { count: "exact", head: true })
        .eq("ip_hint", ipHint)
        .eq("success", false)
        .gte("attempted_at", lockoutCutoff);

      if ((recentFailures ?? 0) >= MAX_ATTEMPTS) {
        return new Response(
          JSON.stringify({ error: "Too many failed attempts. Try again in 15 minutes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD");
      const isValid = ADMIN_PASSWORD && password === ADMIN_PASSWORD;

      await admin.from("admin_login_attempts").insert({ ip_hint: ipHint, success: isValid });

      if (!isValid) {
        return new Response(
          JSON.stringify({ error: "Invalid password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: sessionData, error: sessionError } = await admin
        .from("admin_sessions")
        .insert({ ip_hint: ipHint })
        .select("token")
        .single();

      if (sessionError || !sessionData) throw new Error("Failed to create admin session");

      return new Response(
        JSON.stringify({ token: sessionData.token }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Validate session for all other actions ─────────────────────────────
    const { token } = body;
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — session token required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ipHintNow = getIpHint(req);
    const { data: session, error: sessionErr } = await admin
      .from("admin_sessions")
      .select("id, expires_at, ip_hint")
      .eq("token", token)
      .single();

    if (sessionErr || !session || new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Session expired or invalid. Please log in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (
      session.ip_hint && session.ip_hint !== "unknown" &&
      ipHintNow !== "unknown" && session.ip_hint !== ipHintNow
    ) {
      return new Response(
        JSON.stringify({ error: "Session IP mismatch. Please log in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── DASHBOARD (main data load) ────────────────────────────────────────
    if (action === "dashboard") {
      const [profilesRes, childrenRes, assessmentsRes, reportsRes, feedbackRes, usersRes, blueprintsRes, cacheRes, rateLimitRes] = await Promise.all([
        admin.from("profiles").select("*").order("created_at", { ascending: false }).limit(1000),
        admin.from("children").select("*").order("created_at", { ascending: false }).limit(1000),
        admin.from("assessments").select("id, user_id, child_id, type, completed_at").order("completed_at", { ascending: false }).limit(1000),
        admin.from("reports").select("id, child_id, user_id, created_at").order("created_at", { ascending: false }).limit(1000),
        admin.from("feedback").select("*").order("created_at", { ascending: false }).limit(1000),
        admin.auth.admin.listUsers({ perPage: 1000 }),
        admin.from("future_blueprints").select("id, child_id, identity_label, identity_type, primary_pathway, confidence_score, created_at, with_discoverme, share_token").order("created_at", { ascending: false }).limit(500),
        admin.from("ai_cache").select("id, action, cache_key, created_at, expires_at").order("created_at", { ascending: false }).limit(200),
        admin.from("rate_limits").select("user_id, action, count, window_start").order("count", { ascending: false }).limit(50),
      ]);

      return new Response(
        JSON.stringify({
          profiles: profilesRes.data || [],
          children: childrenRes.data || [],
          assessments: assessmentsRes.data || [],
          reports: reportsRes.data || [],
          feedback: feedbackRes.data || [],
          blueprints: blueprintsRes.data || [],
          aiCache: cacheRes.data || [],
          rateLimits: rateLimitRes.data || [],
          authUsers: (usersRes.data?.users || []).map((u) => ({
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            email_confirmed_at: u.email_confirmed_at,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── PURGE AI CACHE ────────────────────────────────────────────────────
    if (action === "purge_ai_cache") {
      const { data: purged } = await admin.rpc("purge_expired_ai_cache");
      return new Response(
        JSON.stringify({ success: true, purged }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── PURGE ALL AI CACHE (force fresh) ─────────────────────────────────
    if (action === "purge_all_ai_cache") {
      const { error } = await admin.from("ai_cache").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      return new Response(
        JSON.stringify({ success: !error, error: error?.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── RESEND VERIFICATION EMAIL ─────────────────────────────────────────
    if (action === "resend_verification") {
      const { email } = body;
      if (!email) return new Response(JSON.stringify({ error: "Email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { error } = await admin.auth.admin.generateLink({ type: "signup", email });
      return new Response(
        JSON.stringify({ success: !error, error: error?.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── DELETE USER ───────────────────────────────────────────────────────
    if (action === "delete_user") {
      const { userId } = body;
      if (!userId) return new Response(JSON.stringify({ error: "userId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { error } = await admin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ success: !error, error: error?.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── GET SINGLE USER DETAIL ────────────────────────────────────────────
    if (action === "user_detail") {
      const { userId } = body;
      if (!userId) return new Response(JSON.stringify({ error: "userId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const [userRes, childrenRes, assessmentsRes, reportsRes, blueprintsRes] = await Promise.all([
        admin.auth.admin.getUserById(userId),
        admin.from("children").select("*").eq("user_id", userId),
        admin.from("assessments").select("*").eq("user_id", userId),
        admin.from("reports").select("*").eq("user_id", userId),
        admin.from("future_blueprints").select("*").in("child_id",
          (await admin.from("children").select("id").eq("user_id", userId)).data?.map(c => c.id) || []
        ),
      ]);
      return new Response(
        JSON.stringify({
          user: userRes.data?.user,
          children: childrenRes.data || [],
          assessments: assessmentsRes.data || [],
          reports: reportsRes.data || [],
          blueprints: blueprintsRes.data || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── CREATE TEST USER ──────────────────────────────────────────────────
    if (action === "create_test_user") {
      const { email, testPassword } = body;
      const targetEmail = email || "test@flourish.dev";
      const targetPassword = testPassword || "Test1234!";

      const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const alreadyExists = existing?.users?.find((u) => u.email === targetEmail);

      if (alreadyExists) {
        await admin.auth.admin.updateUserById(alreadyExists.id, { password: targetPassword });
        return new Response(
          JSON.stringify({ success: true, message: "Test user password updated", email: targetEmail, password: targetPassword }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await admin.auth.admin.createUser({
        email: targetEmail,
        password: targetPassword,
        email_confirm: true,
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ success: true, message: "Test user created", email: targetEmail, password: targetPassword, userId: data.user?.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ERROR LOGS (bug tracker) ──────────────────────────────────────────
    if (action === "error_logs") {
      const { limit: lim = 200, error_type, page: pg } = body;
      let q = admin
        .from("error_logs")
        .select("id, created_at, user_id, session_id, error_type, severity, page, error_message, stack, metadata")
        .order("created_at", { ascending: false })
        .limit(lim);
      if (error_type) q = q.eq("error_type", error_type);
      if (pg) q = q.eq("page", pg);
      const { data, error: qErr } = await q;
      return new Response(
        JSON.stringify({ logs: data || [], error: qErr?.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-data error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

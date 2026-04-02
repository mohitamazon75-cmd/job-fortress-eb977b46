import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to delete all user data
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userId = user.id;

    // Delete in order: dependent tables first
    // 1. Delete scan_feedback for user's scans
    const { data: userScans } = await serviceClient
      .from("scans")
      .select("id")
      .eq("user_id", userId);

    const scanIds = (userScans || []).map((s: any) => s.id);

    if (scanIds.length > 0) {
      await serviceClient.from("scan_feedback").delete().in("scan_id", scanIds);
      await serviceClient.from("weekly_briefs").delete().in("scan_id", scanIds);
      await serviceClient.from("chat_messages").delete().in("scan_id", scanIds);
    }

    // 2. Delete scans
    await serviceClient.from("scans").delete().eq("user_id", userId);

    // 3. Delete beta data
    const { data: betaProfiles } = await serviceClient
      .from("beta_profiles")
      .select("id")
      .eq("user_id", userId);

    const profileIds = (betaProfiles || []).map((p: any) => p.id);
    if (profileIds.length > 0) {
      await serviceClient.from("beta_scores").delete().in("profile_id", profileIds);
      await serviceClient.from("beta_plans").delete().in("profile_id", profileIds);
      await serviceClient.from("beta_signals").delete().in("profile_id", profileIds);
    }
    await serviceClient.from("beta_profiles").delete().eq("user_id", userId);
    await serviceClient.from("beta_events").delete().eq("user_id", userId);

    // 4. Delete profile
    await serviceClient.from("profiles").delete().eq("id", userId);

    // 4b. Delete resume files from storage
    try {
      const { data: resumeFiles } = await serviceClient.storage
        .from("resumes")
        .list(userId);
      if (resumeFiles && resumeFiles.length > 0) {
        const filePaths = resumeFiles.map((f: any) => `${userId}/${f.name}`);
        await serviceClient.storage.from("resumes").remove(filePaths);
      }
      // Also try top-level file (legacy path: userId.pdf)
      await serviceClient.storage.from("resumes").remove([`${userId}.pdf`]);
    } catch (storageErr) {
      console.warn("Storage cleanup failed (non-fatal):", storageErr);
    }

    // 5. Delete user roles
    await serviceClient.from("user_roles").delete().eq("user_id", userId);

    // 6. Delete auth user
    const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error("Failed to delete auth user:", deleteAuthError.message);
      // Data is already deleted, auth deletion failure is non-fatal for user
    }

    return new Response(
      JSON.stringify({ success: true, message: "All your data has been permanently deleted." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Delete my data error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

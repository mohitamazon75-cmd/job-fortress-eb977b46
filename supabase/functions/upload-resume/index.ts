import { createAdminClient, createAnonClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);

  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    const userClient = createAnonClient(authHeader.slice(7).trim());
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), { status: 401, headers: jsonHeaders });
    }

    const formData = await req.formData();
    const scanId = String(formData.get("scanId") || "").trim();
    const file = formData.get("file");

    if (!scanId || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "scanId and file are required" }), { status: 400, headers: jsonHeaders });
    }

    const MAX_BYTES = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_BYTES) {
      return new Response(
        JSON.stringify({ error: "File too large. Max 10MB.", code: "FILE_TOO_LARGE" }),
        { status: 413, headers: jsonHeaders }
      );
    }
    // Trust extension as primary signal; treat MIME as secondary.
    // Some mobile browsers send empty file.type for valid PDFs.
    const fname = (file.name || "").toLowerCase();
    const validExt = fname.endsWith(".pdf") || fname.endsWith(".doc")
                     || fname.endsWith(".docx");
    const validMime = !file.type
      || file.type === "application/pdf"
      || file.type === "application/msword"
      || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!validExt || !validMime) {
      return new Response(
        JSON.stringify({ error: "Only PDF / DOC / DOCX files allowed.", code: "INVALID_FILE_TYPE" }),
        { status: 415, headers: jsonHeaders }
      );
    }

    const admin = createAdminClient();
    const { data: scan, error: scanError } = await admin
      .from("scans")
      .select("id, user_id")
      .eq("id", scanId)
      .single();

    if (scanError || !scan) {
      return new Response(JSON.stringify({ error: "Scan not found" }), { status: 404, headers: jsonHeaders });
    }

    if (scan.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: jsonHeaders });
    }

    const sanitized = sanitizeFilename(file.name || "resume.pdf") || "resume.pdf";
    const filePath = `${scanId}/${sanitized}`;

    const { error: uploadError } = await admin.storage
      .from("resumes")
      .upload(filePath, file, {
        contentType: file.type || "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("[upload-resume] Storage upload failed:", uploadError);
      return new Response(JSON.stringify({ error: "Resume upload failed" }), { status: 500, headers: jsonHeaders });
    }

    const { error: updateError } = await admin
      .from("scans")
      .update({ resume_file_path: filePath })
      .eq("id", scanId);

    if (updateError) {
      console.error("[upload-resume] Scan update failed:", updateError);
      return new Response(JSON.stringify({ error: "Resume upload saved but scan update failed" }), { status: 500, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ success: true, filePath }), { headers: jsonHeaders });
  } catch (error) {
    console.error("[upload-resume] Unexpected error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
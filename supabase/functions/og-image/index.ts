import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const url = new URL(req.url);
    const scanId = url.searchParams.get("scanId");

    if (!scanId) {
      return new Response(JSON.stringify({ error: "Missing scanId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createAdminClient();

    const { data: scan } = await sb
      .from("scans")
      .select("final_json_report")
      .eq("id", scanId)
      .maybeSingle();

    if (!scan?.final_json_report) {
      return new Response(JSON.stringify({ error: "Scan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const report = scan.final_json_report as any;

    // Extract ONLY safe, non-sensitive fields for public OG image
    // Do NOT include: exact company name, full role title, email, resume content, LinkedIn URL, or any PII
    const score = report.career_position_score ?? report.replaceability_score ?? 50;

    // Use generic role category (NOT the exact job title from role_detected or matched_job_family)
    // matched_job_family likely contains the exact role — use a safe generic category instead
    const role = "Career"; // Safe generic label instead of actual job title

    // Use generic industry category (safe to show as it's already shared in the preview)
    const industry = "Professional";

    // Generate SVG-based OG image
    const scoreColor = score >= 70 ? "#22c55e" : score >= 40 ? "#eab308" : "#ef4444";
    const scoreLabel = score >= 70 ? "STRONG" : score >= 40 ? "AT RISK" : "CRITICAL";

    const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0a0a0a"/>
          <stop offset="100%" style="stop-color:#1a1a2e"/>
        </linearGradient>
        <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${scoreColor}"/>
          <stop offset="100%" style="stop-color:${scoreColor}80"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)"/>
      <rect x="0" y="0" width="1200" height="4" fill="${scoreColor}"/>
      
      <!-- Score circle -->
      <circle cx="600" cy="240" r="100" fill="none" stroke="${scoreColor}40" stroke-width="8"/>
      <circle cx="600" cy="240" r="100" fill="none" stroke="${scoreColor}" stroke-width="8" 
        stroke-dasharray="${(score / 100) * 628} 628" stroke-linecap="round" transform="rotate(-90 600 240)"/>
      <text x="600" y="255" text-anchor="middle" fill="${scoreColor}" font-size="64" font-weight="900" font-family="system-ui">${score}</text>
      <text x="600" y="290" text-anchor="middle" fill="${scoreColor}cc" font-size="16" font-weight="600" font-family="system-ui" letter-spacing="4">${scoreLabel}</text>
      
      <!-- Role & Industry -->
      <text x="600" y="400" text-anchor="middle" fill="#ffffff" font-size="28" font-weight="700" font-family="system-ui">${role}</text>
      <text x="600" y="435" text-anchor="middle" fill="#888888" font-size="20" font-family="system-ui">${industry}</text>
      
      <!-- Branding -->
      <text x="600" y="520" text-anchor="middle" fill="#666666" font-size="16" font-family="system-ui">AI Career Position Score™</text>
      <text x="600" y="550" text-anchor="middle" fill="#888888" font-size="22" font-weight="700" font-family="system-ui">JobBachao.com</text>
      
      <!-- CTA -->
      <rect x="420" y="570" width="360" height="40" rx="20" fill="${scoreColor}20" stroke="${scoreColor}60" stroke-width="1"/>
      <text x="600" y="596" text-anchor="middle" fill="${scoreColor}" font-size="14" font-weight="600" font-family="system-ui">Check Your Score — Free</text>
    </svg>`;

    return new Response(svg, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[og-image] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

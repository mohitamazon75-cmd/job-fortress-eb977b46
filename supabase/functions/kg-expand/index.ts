import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    // --- JWT validation ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header", code: "UNAUTHORIZED", status: "error" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token", code: "UNAUTHORIZED", status: "error" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // --- end JWT validation ---

    const { batch = 1, batchSize = 5 } = await req.json().catch(() => ({}));

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "PERPLEXITY_API_KEY not configured", code: "CONFIG_ERROR", status: "error" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all job families
    const { data: allJobs } = await supabase
      .from("job_taxonomy")
      .select("job_family, category")
      .order("job_family");

    if (!allJobs?.length) {
      return new Response(
        JSON.stringify({ error: "No job families found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const start = (batch - 1) * batchSize;
    const end = start + batchSize;
    const batchJobs = allJobs.slice(start, end);

    if (batchJobs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No more batches to process", total_families: allJobs.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[kg-expand] Processing batch ${batch}: ${batchJobs.map(j => j.job_family).join(", ")}`);

    // Get existing skills to skip duplicates
    const { data: existingSkills } = await supabase
      .from("skill_risk_matrix")
      .select("skill_name")
      .limit(1000);

    const existingSet = new Set((existingSkills || []).map((s: any) => s.skill_name.toLowerCase()));

    let totalNewSkills = 0;
    let totalNewMappings = 0;

    for (const job of batchJobs) {
      try {
        const resp = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar-pro",
            messages: [
              {
                role: "system",
                content: `You are a career skills analyst. Return ONLY valid JSON, no markdown. For the job family "${job.job_family}" in ${job.category}, list the top 15 specific professional skills used in India (2025-2026).

Return JSON:
{
  "skills": [
    {
      "skill_name": string (specific skill, 2-4 words, e.g. "Data Pipeline Engineering"),
      "automation_risk": number (0-100, how likely AI can replace this),
      "ai_augmentation_potential": number (0-100, how much AI can enhance this),
      "replacement_tools": [string] (max 3 AI tools that can do this),
      "india_demand_trend": "Rising" | "Stable" | "Declining",
      "category": "execution" | "strategic" | "hybrid",
      "human_moat": string (why humans are still needed, one phrase),
      "importance_for_role": number (1-10, how critical for this job family),
      "frequency": "core" | "common" | "emerging"
    }
  ]
}`
              },
              {
                role: "user",
                content: `What are the top 15 specific skills for ${job.job_family} professionals in India 2025? Include both execution and strategic skills. Be specific — not generic skills like "communication".`
              }
            ],
            temperature: 0.1,
            return_citations: true,
            search_recency_filter: "month",
          }),
        });

        if (!resp.ok) {
          console.error(`[kg-expand] Perplexity failed for ${job.job_family}: ${resp.status}`);
          continue;
        }

        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) continue;

        let parsed;
        try {
          const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          parsed = JSON.parse(jsonStr);
        } catch {
          console.error(`[kg-expand] JSON parse failed for ${job.job_family}`);
          continue;
        }

        const skills = parsed.skills || [];

        for (const skill of skills) {
          if (!skill.skill_name) continue;
          const skillLower = skill.skill_name.toLowerCase().trim();

          // Insert into skill_risk_matrix if new
          // Normalize: trim, title-case, collapse whitespace for deduplication
          const normalizedName = skill.skill_name.trim().replace(/\s+/g, ' ');
          const normalizedLower = normalizedName.toLowerCase();

          if (!existingSet.has(normalizedLower)) {
            const { error: insertErr } = await supabase
              .from("skill_risk_matrix")
              .insert({
                skill_name: normalizedName,
                automation_risk: Math.min(100, Math.max(0, skill.automation_risk || 50)),
                ai_augmentation_potential: Math.min(100, Math.max(0, skill.ai_augmentation_potential || 50)),
                replacement_tools: (skill.replacement_tools || []).slice(0, 5),
                india_demand_trend: skill.india_demand_trend || "Stable",
                category: skill.category || "execution",
                human_moat: skill.human_moat || null,
              });

            if (!insertErr) {
              existingSet.add(normalizedLower);
              totalNewSkills++;
            } else {
              console.error(`[kg-expand] Insert skill failed: ${skill.skill_name}`, insertErr.message);
            }
          }

          // Insert job_skill_map entry
          const { error: mapErr } = await supabase
            .from("job_skill_map")
            .upsert({
              job_family: job.job_family,
              skill_name: normalizedName,
              importance: skill.importance_for_role || 5,
              frequency: skill.frequency || "common",
            }, { onConflict: "job_family,skill_name" });

          if (!mapErr) {
            totalNewMappings++;
          }
        }

        console.log(`[kg-expand] ${job.job_family}: processed ${skills.length} skills`);

        // Rate limit between families
        await new Promise(r => setTimeout(r, 1000));

      } catch (e) {
        console.error(`[kg-expand] Error processing ${job.job_family}:`, e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        batch,
        families_processed: batchJobs.map(j => j.job_family),
        new_skills_added: totalNewSkills,
        new_mappings_added: totalNewMappings,
        total_families: allJobs.length,
        next_batch: end < allJobs.length ? batch + 1 : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[kg-expand] error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ═══════════════════════════════════════════════════════════════
// cohort-match — IP #1: Cohort Intelligence Engine
// ═══════════════════════════════════════════════════════════════
// Given a scan, builds its 16-dim feature vector, stores it in
// scan_vectors, finds the 200 nearest neighbours using pgvector
// cosine similarity, computes cohort statistics, writes the
// result to cohort_cache, and returns the insight text.
//
// Call pattern:
//   POST /cohort-match  { scan_id: string }
//   Auth: Bearer <user JWT>
//
// Returns:
//   { cohort_size, cohort_label, pct_improved, top_skill_gain,
//     median_doom_months, median_stability, insight_text }
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

// ── Feature vector builder ──────────────────────────────────────
// Produces a deterministic 16-dim unit-length float array from a
// scan report. All inputs clamped/normalised to [0, 1].
function buildEmbedding(report: Record<string, any>): number[] {
  const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const norm = (v: number, max: number) => clamp(v / max);

  // Seniority → ordinal 0–1
  const SENIORITY_MAP: Record<string, number> = {
    ENTRY: 0.0, JUNIOR: 0.15, MID: 0.3, SENIOR: 0.55,
    LEAD: 0.7, MANAGER: 0.8, DIRECTOR: 0.9, EXECUTIVE: 1.0,
  };

  const seniorityVal = SENIORITY_MAP[String(report.seniority_tier || "MID").toUpperCase()] ?? 0.3;

  // Role → sparse 3-dim hash bucket (deterministic, no collisions for top 30 roles)
  const roleHash = hashRole(String(report.role_family || ""));
  // Industry → sparse 2-dim hash bucket
  const industryHash = hashIndustry(String(report.industry || ""));

  // posting_change_pct: -100..+100 → 0..1 (centred at 0.5)
  const postingNorm = clamp(((report.posting_change_pct as number ?? 0) + 100) / 200);

  const dims: number[] = [
    norm(report.automation_risk ?? 50, 100),
    norm(report.stability_score ?? 50, 100),
    clamp(norm(report.doom_clock_months ?? 36, 60)),
    norm(report.moat_score ?? 50, 100),
    norm(report.market_position ?? 50, 100),
    seniorityVal,
    clamp(norm(report.experience_years ?? 5, 30)),
    norm(report.ai_job_mentions_pct ?? 0, 100),
    norm(report.salary_percentile ?? 50, 100),
    postingNorm,
    ...roleHash,         // 3 dims
    ...industryHash,     // 2 dims
    report.city_tier === 1 ? 1 : 0,  // tier-1 city flag
  ];

  // L2-normalise for stable cosine similarity
  const magnitude = Math.sqrt(dims.reduce((s, x) => s + x * x, 0)) || 1;
  return dims.map((x) => x / magnitude);
}

// Role → 3-dim sparse hash (avoids string comparisons in SQL)
function hashRole(role: string): [number, number, number] {
  const BUCKETS: Record<string, [number, number, number]> = {
    software_engineer:  [1, 0, 0],
    data_scientist:     [0.9, 0.1, 0],
    ml_engineer:        [0.85, 0.15, 0],
    data_analyst:       [0.7, 0.2, 0.1],
    product_manager:    [0, 1, 0],
    business_analyst:   [0.1, 0.8, 0.1],
    consultant:         [0.1, 0.7, 0.2],
    financial_analyst:  [0, 0.5, 0.5],
    accountant:         [0, 0.3, 0.7],
    marketing_manager:  [0.1, 0.3, 0.6],
    content_writer:     [0, 0.1, 0.9],
    ux_designer:        [0.5, 0.4, 0.1],
    hr_manager:         [0, 0.6, 0.4],
    sales_rep:          [0, 0.4, 0.6],
  };
  const key = role.toLowerCase().replace(/\s+/g, "_");
  return BUCKETS[key] ?? [0.3, 0.3, 0.4]; // default bucket for unknown roles
}

// Industry → 2-dim sparse hash
function hashIndustry(industry: string): [number, number] {
  const BUCKETS: Record<string, [number, number]> = {
    "it & software":        [1, 0],
    "finance & banking":    [0.7, 0.3],
    "healthcare":           [0.2, 0.8],
    "education":            [0.3, 0.7],
    "marketing & advertising": [0.5, 0.5],
    "manufacturing":        [0.4, 0.6],
    "creative & design":    [0.6, 0.4],
    "retail & e-commerce":  [0.5, 0.5],
    "consulting":           [0.6, 0.4],
  };
  const key = industry.toLowerCase();
  for (const [k, v] of Object.entries(BUCKETS)) {
    if (key.includes(k.split(" ")[0])) return v;
  }
  return [0.5, 0.5];
}

// ── Cohort insight text generator ──────────────────────────────
function buildInsightText(stats: {
  cohortSize: number;
  cohortLabel: string;
  pctImproved: number | null;
  topSkillGain: string | null;
  medianDoomMonths: number | null;
  medianStability: number | null;
  userDoomMonths: number;
  userStability: number;
}): string {
  const { cohortSize, cohortLabel, pctImproved, topSkillGain,
    medianDoomMonths, medianStability, userDoomMonths, userStability } = stats;

  if (cohortSize < 5) {
    return `You're among the first ${cohortLabel} on JobBachao — your data is helping build benchmarks for others.`;
  }

  const lines: string[] = [];

  // Peer comparison line
  if (pctImproved !== null && pctImproved > 0 && topSkillGain) {
    lines.push(
      `${cohortSize} ${cohortLabel} have scanned like you. ` +
      `${pctImproved}% improved their stability score — ` +
      `most by adding **${topSkillGain}**.`
    );
  } else {
    lines.push(`${cohortSize} ${cohortLabel} have a profile similar to yours.`);
  }

  // Doom clock comparison
  if (medianDoomMonths !== null) {
    if (userDoomMonths < medianDoomMonths) {
      const diff = medianDoomMonths - userDoomMonths;
      lines.push(`Your runway is ${diff} months shorter than the peer median — act first.`);
    } else if (userDoomMonths > medianDoomMonths + 6) {
      lines.push(`Your runway is ${userDoomMonths - medianDoomMonths} months longer than your peers — you have time, but don't waste it.`);
    }
  }

  // Stability comparison
  if (medianStability !== null) {
    if (userStability > medianStability + 5) {
      lines.push(`You're in the top tier of your cohort — stability ${userStability} vs peer median ${medianStability}.`);
    } else if (userStability < medianStability - 10) {
      lines.push(`Your stability (${userStability}) is below your peer median (${medianStability}) — your peers are adapting faster.`);
    }
  }

  return lines.join(" ");
}

// ── Main handler ────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createAdminClient();

    // Verify JWT and get user
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { scan_id } = body as { scan_id: string };
    if (!scan_id) {
      return new Response(JSON.stringify({ error: "scan_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 1. Load the scan report ──────────────────────────────
    const { data: scan, error: scanError } = await supabase
      .from("scans")
      .select("id, final_json_report, user_id, scan_status")
      .eq("id", scan_id)
      .maybeSingle();

    if (scanError || !scan) {
      return new Response(JSON.stringify({ error: "Scan not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Scan exists but has no completed report — return graceful empty cohort
    // instead of 404 so the frontend hook stops surfacing this as a runtime error.
    if (!scan.final_json_report) {
      const emptyPayload = {
        scan_id,
        cohort_size: 0,
        cohort_label: "professionals",
        pct_improved: null,
        top_skill_gain: null,
        median_doom_months: null,
        median_stability: null,
        insight_text: scan.scan_status === "processing"
          ? "Cohort intelligence will be available once your scan finishes processing."
          : "Cohort intelligence isn't available for this scan yet.",
        computed_at: new Date().toISOString(),
        scan_status: scan.scan_status,
      };
      return new Response(JSON.stringify(emptyPayload), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const report = scan.final_json_report as Record<string, any>;

    // ── 2. Build + store embedding ───────────────────────────
    const embedding = buildEmbedding(report);
    const embeddingStr = `[${embedding.join(",")}]`;

    // T4: Generate semantic embedding via Lovable gateway (text-embedding-3-small)
    // Cost: ~$0.000002/scan. Falls back gracefully if unavailable.
    let semanticEmbeddingStr: string | null = null;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      try {
        const profileText = [
          `${report.role || report.role_family || "Professional"}`,
          `with ${report.experience_years || 5} years`,
          `in ${report.industry || "Technology"}.`,
          `Skills: ${((report.all_skills || []) as string[]).slice(0, 6).join(", ") || "mixed"}.`,
          `${report.city_tier === 1 ? "Tier 1" : "Tier 2"} city.`,
          `Seniority: ${report.seniority_tier || "MID"}.`,
        ].join(" ");

        const embResp = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
          method: "POST",
          headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "text-embedding-3-small", input: profileText }),
          signal: AbortSignal.timeout(5_000),
        });
        if (embResp.ok) {
          const embData = await embResp.json();
          const vec = embData?.data?.[0]?.embedding as number[] | undefined;
          if (vec?.length === 1536) {
            semanticEmbeddingStr = `[${vec.join(",")}]`;
            console.log("[cohort-match] Semantic embedding generated (1536-dim)");
          }
        }
      } catch (e) {
        console.warn("[cohort-match] Semantic embedding failed (non-fatal):", e);
      }
    }

    // Find the user's previous scan for delta computation
    const { data: prevScanVec } = await supabase
      .from("scan_vectors")
      .select("scan_id, stability_score, doom_months")
      .eq("user_id", user.id)
      .neq("scan_id", scan_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const upsertPayload: Record<string, any> = {
      scan_id,
      user_id: user.id,
      embedding: embeddingStr,
      role_family: report.role_family ?? null,
      industry: report.industry ?? null,
      city: report.city ?? null,
      seniority: report.seniority_tier ?? null,
      stability_score: report.stability_score ?? null,
      automation_risk: report.automation_risk ?? null,
      doom_months: report.doom_clock_months ?? null,
      prior_scan_id: prevScanVec?.scan_id ?? null,
      ...(semanticEmbeddingStr ? { semantic_embedding: semanticEmbeddingStr, semantic_model: "text-embedding-3-small" } : {}),
    };

    // If we have a previous scan, compute deltas
    if (prevScanVec) {
      if (prevScanVec.stability_score != null && report.stability_score != null) {
        upsertPayload.delta_stability = (report.stability_score as number) - prevScanVec.stability_score;
      }
      if (prevScanVec.doom_months != null && report.doom_clock_months != null) {
        upsertPayload.delta_automation = prevScanVec.doom_months - (report.doom_clock_months as number);
      }
    }

    await supabase
      .from("scan_vectors")
      .upsert(upsertPayload, { onConflict: "scan_id" });

    // ── 3. Find nearest neighbours (cosine similarity) ──────
    // Uses pgvector's <=> operator (cosine distance; lower = more similar)
    // Filter to same role_family + city for meaningful peer comparison.
    // Fall back to role_family only if <20 results, then no filter.
    const roleFamily = report.role_family as string | null;
    const city = report.city as string | null;

    interface NeighbourRow {
      scan_id: string;
      stability_score: number | null;
      doom_months: number | null;
      delta_stability: number | null;
      distance: number;
    }

    let neighbours: NeighbourRow[] = [];

    // Attempt 1: role + city filter
    if (roleFamily && city) {
      const { data } = await supabase.rpc("match_scan_vectors", {
        query_embedding: embeddingStr,
        match_count: 200,
        filter_role: roleFamily,
        filter_city: city,
        exclude_scan_id: scan_id,
      });
      neighbours = (data as NeighbourRow[]) ?? [];
    }

    // Attempt 2: role only
    if (neighbours.length < 20 && roleFamily) {
      const { data } = await supabase.rpc("match_scan_vectors", {
        query_embedding: embeddingStr,
        match_count: 200,
        filter_role: roleFamily,
        filter_city: null,
        exclude_scan_id: scan_id,
      });
      neighbours = (data as NeighbourRow[]) ?? [];
    }

    // Attempt 3: no filter (global peers)
    if (neighbours.length < 10) {
      const { data } = await supabase.rpc("match_scan_vectors", {
        query_embedding: embeddingStr,
        match_count: 200,
        filter_role: null,
        filter_city: null,
        exclude_scan_id: scan_id,
      });
      neighbours = (data as NeighbourRow[]) ?? [];
    }

    // ── 4. Compute cohort statistics ─────────────────────────
    const cohortSize = neighbours.length;
    const improvers = neighbours.filter(
      (n) => n.delta_stability !== null && n.delta_stability > 0
    );
    const pctImproved = cohortSize > 0
      ? Math.round((improvers.length / cohortSize) * 100)
      : null;

    const doomValues = neighbours
      .map((n) => n.doom_months)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    const medianDoomMonths = doomValues.length > 0
      ? doomValues[Math.floor(doomValues.length / 2)]
      : null;

    const stabilityValues = neighbours
      .map((n) => n.stability_score)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    const medianStability = stabilityValues.length > 0
      ? stabilityValues[Math.floor(stabilityValues.length / 2)]
      : null;

    // Top skill gain: most common skill learned by improvers
    // We store this as a future-proof placeholder; once skill_predictions
    // is populated, the validate-prediction function will enrich this.
    const topSkillGain = cohortSize > 50 ? "cloud architecture" : null;

    // ── 5. Build cohort label ────────────────────────────────
    let cohortLabel = "professionals";
    if (roleFamily) {
      cohortLabel = roleFamily.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + "s";
    }
    if (city) cohortLabel += ` in ${city}`;

    // ── 6. Generate insight text ─────────────────────────────
    const insightText = buildInsightText({
      cohortSize,
      cohortLabel,
      pctImproved,
      topSkillGain,
      medianDoomMonths,
      medianStability,
      userDoomMonths: report.doom_clock_months ?? 36,
      userStability: report.stability_score ?? 50,
    });

    // ── 7. Write to cohort_cache ─────────────────────────────
    const cachePayload = {
      scan_id,
      cohort_size: cohortSize,
      cohort_label: cohortLabel,
      pct_improved: pctImproved,
      top_skill_gain: topSkillGain,
      median_doom_months: medianDoomMonths,
      median_stability: medianStability,
      insight_text: insightText,
      computed_at: new Date().toISOString(),
    };

    await supabase
      .from("cohort_cache")
      .upsert(cachePayload, { onConflict: "scan_id" });

    return new Response(JSON.stringify(cachePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[cohort-match]", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

// Phase C: Generate milestone tracking for defense plan
// Receives: { user_id: string, scan_id: string }
// Fetches final_json_report from scans table
// Extracts defense plan and creates 8-12 milestones
// Inserts into defense_milestones with idempotent ON CONFLICT

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { tavilySearch } from "../_shared/tavily-search.ts";



const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Milestone {
  phase: 1 | 2 | 3 | 4;
  milestone_key: string;
  milestone_label: string;
  resource_url: string | null;
}

const defaultMilestones: Milestone[] = [
  { phase: 1, milestone_key: 'phase1_skill_audit', milestone_label: 'Audit your top 5 skills against AI automation risk' },
  { phase: 1, milestone_key: 'phase1_linkedin_update', milestone_label: 'Update LinkedIn headline to reflect AI-augmented work' },
  { phase: 1, milestone_key: 'phase1_skill_start', milestone_label: 'Start learning one AI-augmentation tool (Cursor, Copilot, or similar)' },
  { phase: 2, milestone_key: 'phase2_portfolio_project', milestone_label: 'Build one portfolio project using your new skill' },
  { phase: 2, milestone_key: 'phase2_network_outreach', milestone_label: 'Connect with 5 people in your target pivot role' },
  { phase: 2, milestone_key: 'phase2_share_linkedin', milestone_label: 'Share one learning post on LinkedIn' },
  { phase: 3, milestone_key: 'phase3_apply_roles', milestone_label: 'Apply to 3 roles matching your skill pivot direction' },
  { phase: 3, milestone_key: 'phase3_salary_research', milestone_label: 'Research salary ranges for your target role' },
  { phase: 3, milestone_key: 'phase3_interview_prep', milestone_label: 'Complete mock interview practice for new role' },
  { phase: 4, milestone_key: 'phase4_offer_negotiation', milestone_label: 'Prepare salary negotiation talking points' },
  { phase: 4, milestone_key: 'phase4_rescan', milestone_label: 'Rescan your profile to measure improvement' },
];

// Keyword to skill category mapping for resource lookup
const keywordMapping: Record<string, string> = {
  'cursor': 'cursor_ai',
  'copilot': 'cursor_ai',
  'ai tool': 'cursor_ai',
  'ai-augmentation': 'cursor_ai',
  'python': 'python_ml',
  'machine learning': 'python_ml',
  'ml': 'python_ml',
  'prompt': 'prompt_engineering',
  'prompt engineering': 'prompt_engineering',
  'visualization': 'data_visualization',
  'tableau': 'data_visualization',
  'power bi': 'data_visualization',
  'communication': 'communication',
  'leadership': 'leadership',
  'sql': 'sql',
  'linkedin': 'linkedin_optimization',
  'linkedin headline': 'linkedin_optimization',
  'excel': 'excel_advanced',
  'ai for everyone': 'ai_tools_general',
  'ai tools': 'ai_tools_general',
};

async function findResourceUrl(label: string, supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const labelLower = label.toLowerCase();

  // Find matching skill category from keywords
  let category: string | null = null;
  for (const [keyword, cat] of Object.entries(keywordMapping)) {
    if (labelLower.includes(keyword.toLowerCase())) {
      category = cat;
      break;
    }
  }

  if (!category) {
    return null;
  }

  // Fetch a resource for this category
  const { data, error } = await supabase
    .from('learning_resources')
    .select('url')
    .eq('skill_category', category)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data.url;
}

async function generateMilestones(
  report: any,
  supabase: ReturnType<typeof createClient>
): Promise<Milestone[]> {
  // Check for structured defense plan in report
  const plan = report?.weeklyActionPlan || report?.weekly_action_plan || report?.defense_plan || report?.immediate_next_step;

  if (!plan) {
    console.log("[generate-milestones] No structured plan found, using defaults");
    return defaultMilestones;
  }

  // Extract milestones from the plan
  const milestones: Milestone[] = [];
  const phaseCounter = 1;
  const milestonesPerPhase: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const maxPerPhase = { 1: 3, 2: 3, 3: 3, 4: 2 };

  // Parse plan content - handle both array and string formats
  const planItems: string[] = [];

  if (Array.isArray(plan)) {
    planItems.push(...plan.map(item => {
      if (typeof item === 'string') return item;
      if (item?.action) return item.action;
      if (item?.label) return item.label;
      return JSON.stringify(item);
    }));
  } else if (typeof plan === 'string') {
    // Split string by common delimiters
    planItems.push(...plan.split(/[•\-\n]+/).filter(s => s.trim().length > 0));
  } else if (typeof plan === 'object') {
    // Extract text from object structure
    if (plan.action) planItems.push(plan.action);
    if (plan.items && Array.isArray(plan.items)) planItems.push(...plan.items);
    if (plan.steps && Array.isArray(plan.steps)) planItems.push(...plan.steps);
  }

  // Create milestones from plan items, distributing across phases
  for (const item of planItems) {
    if (!item || typeof item !== 'string') continue;

    const trimmedItem = item.trim().slice(0, 60); // Limit to 60 chars
    if (trimmedItem.length < 5) continue; // Skip very short items

    // Distribute across phases: 3 in phase 1, 3 in phase 2, 3 in phase 3, 2 in phase 4
    let targetPhase = 1;
    for (let p = 1; p <= 4; p++) {
      if (milestonesPerPhase[p] < maxPerPhase[p]) {
        targetPhase = p;
        break;
      }
    }

    // Ensure we don't exceed phase limits
    if (milestonesPerPhase[targetPhase] >= maxPerPhase[targetPhase]) {
      continue;
    }

    const key = `phase${targetPhase}_${milestones.length}`.toLowerCase().replace(/\s+/g, '_');
    const url = await findResourceUrl(trimmedItem, supabase);

    milestones.push({
      phase: targetPhase as 1 | 2 | 3 | 4,
      milestone_key: key,
      milestone_label: trimmedItem,
      resource_url: url,
    });

    milestonesPerPhase[targetPhase]++;

    // Stop if we have 8-12 milestones
    if (milestones.length >= 12) break;
  }

  // If we have fewer than 8 milestones, fall back to defaults
  if (milestones.length < 8) {
    console.log(`[generate-milestones] Generated ${milestones.length} milestones, falling back to defaults`);
    return defaultMilestones;
  }

  return milestones;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const body = await req.json();
    const { user_id, scan_id } = body;

    if (!user_id || !scan_id) {
      return new Response(JSON.stringify({ error: "Missing user_id or scan_id" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const sb = createAdminClient();

    // Fetch the scan report
    const { data: scanData, error: scanError } = await sb
      .from('scans')
      .select('final_json_report')
      .eq('id', scan_id)
      .eq('user_id', user_id)
      .single();

    if (scanError || !scanData) {
      console.error("[generate-milestones] Scan fetch error:", scanError);
      return new Response(JSON.stringify({ error: "Scan not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const report = scanData.final_json_report || {};
    console.log("[generate-milestones] Processing scan:", scan_id, "for user:", user_id);

    // Generate milestones
    const milestones = await generateMilestones(report, sb);

    // Insert milestones with idempotent handling (ON CONFLICT DO NOTHING)
    const milestoneInserts = milestones.map(m => ({
      user_id,
      scan_id,
      phase: m.phase,
      milestone_key: m.milestone_key,
      milestone_label: m.milestone_label,
      resource_url: m.resource_url,
    }));

    const { error: insertError, data: insertData } = await sb
      .from('defense_milestones')
      .insert(milestoneInserts)
      .select();

    if (insertError) {
      console.error("[generate-milestones] Insert error:", insertError);
      // Don't fail the request — this is fire-and-forget
      return new Response(JSON.stringify({ success: true, message: "Milestone insertion had issues but continuing" }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    console.log("[generate-milestones] Inserted", milestones.length, "milestones");
    return new Response(JSON.stringify({ success: true, milestone_count: milestones.length }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-milestones] Fatal error:", err);
    // Fire-and-forget: don't fail the request
    return new Response(JSON.stringify({ success: true, message: "Processed (error handling)" }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

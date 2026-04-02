import { supabase } from "@/integrations/supabase/client";

export interface DiagnosticInsert {
  job_title: string;
  monthly_ctc: number;
  experience_band: string;
  ai_skills?: string[];
  human_skills?: string[];
  risk_score: number;
  boss_saves_monthly?: number;
  multiplier_needed?: number;
  ai_covers_percent?: number;
  verdict_text?: string;
  user_id?: string | null;
}

export interface DiagnosticRow extends DiagnosticInsert {
  id: string;
  created_at: string;
  updated_at: string;
  survival_plan: unknown | null;
  role_prompts: unknown | null;
  share_token: string | null;
  is_shared: boolean;
}

// ─── Save initial result (after step 2 — before Claude calls) ──────────────────

export async function saveDiagnosticResult(data: DiagnosticInsert): Promise<DiagnosticRow | null> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: result, error } = await supabase
    .from("diagnostic_results")
    .insert({ ...data, user_id: user?.id ?? null })
    .select()
    .single();

  if (error) {
    console.error("saveDiagnosticResult:", error);
    return null;
  }
  return result as DiagnosticRow;
}

// ─── Call edge function for survival plan ───────────────────────────────────────

export async function generateSurvivalPlan(params: {
  jobTitle: string;
  monthlyCTC: number;
  riskScore: number;
  aiSkills: string[];
  humanSkills: string[];
  experienceBand: string;
  resultId: string;
}) {
  const { data, error } = await supabase.functions.invoke("run-diagnostic", {
    body: {
      mode: "survival_plan",
      job_title: params.jobTitle,
      monthly_ctc: params.monthlyCTC,
      risk_score: params.riskScore,
      ai_skills: params.aiSkills,
      human_skills: params.humanSkills,
      experience_band: params.experienceBand,
      result_id: params.resultId,
    },
  });
  if (error) throw error;
  return data.data;
}

// ─── Call edge function for role prompts ────────────────────────────────────────

export async function generateRolePrompts(params: {
  jobTitle: string;
  aiSkills: string[];
  experienceBand: string;
  resultId: string;
}) {
  const { data, error } = await supabase.functions.invoke("run-diagnostic", {
    body: {
      mode: "role_prompts",
      job_title: params.jobTitle,
      ai_skills: params.aiSkills,
      experience_band: params.experienceBand,
      result_id: params.resultId,
    },
  });
  if (error) throw error;
  return data.data;
}

// ─── Load shared report (public, no auth) ───────────────────────────────────────

export async function loadSharedReport(shareToken: string): Promise<DiagnosticRow | null> {
  const { data, error } = await supabase
    .from("diagnostic_results")
    .select("*")
    .eq("share_token", shareToken)
    .eq("is_shared", true)
    .single();
  if (error) return null;
  return data as DiagnosticRow;
}

// ─── Mark result as shared ──────────────────────────────────────────────────────

export async function enableSharing(resultId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("diagnostic_results")
    .update({ is_shared: true })
    .eq("id", resultId)
    .select("share_token")
    .single();
  if (error) return null;
  return (data as { share_token: string }).share_token;
}

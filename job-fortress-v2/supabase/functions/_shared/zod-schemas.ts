// ═══════════════════════════════════════════════════════════════
// Week 1 #9: Zod validation schemas for all LLM agent outputs.
// Validates AI responses before they reach business logic.
// ═══════════════════════════════════════════════════════════════

// Minimal Zod-like validator for Deno edge functions (no npm dependency needed).
// Implements the subset of Zod used here: object, string, number, array, boolean, enum, optional, nullable.

type Validator<T> = {
  parse(input: unknown): T;
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: string };
  optional(): Validator<T | undefined>;
  nullable(): Validator<T | null>;
};

function makeValidator<T>(check: (v: unknown) => T): Validator<T> {
  const self: Validator<T> = {
    parse(input) {
      return check(input);
    },
    safeParse(input) {
      try {
        return { success: true, data: check(input) };
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) };
      }
    },
    optional() {
      return makeValidator<T | undefined>((v) => (v === undefined ? undefined : check(v)));
    },
    nullable() {
      return makeValidator<T | null>((v) => (v === null ? null : check(v)));
    },
  };
  return self;
}

const z = {
  string: () => makeValidator<string>((v) => {
    if (typeof v !== "string") throw new Error(`Expected string, got ${typeof v}`);
    return v;
  }),
  number: () => makeValidator<number>((v) => {
    if (typeof v !== "number" || isNaN(v)) throw new Error(`Expected number, got ${typeof v}`);
    return v;
  }),
  boolean: () => makeValidator<boolean>((v) => {
    if (typeof v !== "boolean") throw new Error(`Expected boolean, got ${typeof v}`);
    return v;
  }),
  array: <T>(inner: Validator<T>) => makeValidator<T[]>((v) => {
    if (!Array.isArray(v)) throw new Error(`Expected array, got ${typeof v}`);
    return v.map((item, i) => {
      try { return inner.parse(item); } catch (e: any) { throw new Error(`[${i}]: ${e.message}`); }
    });
  }),
  object: <T extends Record<string, Validator<any>>>(shape: T) => {
    type Out = { [K in keyof T]: ReturnType<T[K]["parse"]> };
    return makeValidator<Out>((v) => {
      if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error(`Expected object, got ${typeof v}`);
      const result: any = {};
      for (const [key, validator] of Object.entries(shape)) {
        try {
          result[key] = validator.parse((v as any)[key]);
        } catch (e: any) {
          // If optional and undefined, that's fine (handled by optional validator)
          if ((v as any)[key] === undefined) {
            try { result[key] = validator.parse(undefined); } catch { throw new Error(`${key}: ${e.message}`); }
          } else {
            throw new Error(`${key}: ${e.message}`);
          }
        }
      }
      return result as Out;
    });
  },
  enum: <T extends string>(values: readonly T[]) => makeValidator<T>((v) => {
    if (typeof v !== "string" || !values.includes(v as T)) {
      throw new Error(`Expected one of [${values.join(", ")}], got "${v}"`);
    }
    return v as T;
  }),
  any: () => makeValidator<any>((v) => v),
  unknown: () => makeValidator<unknown>((v) => v),
};

// ═══ Agent 1 (Profiler) Output Schema ═══
export const Agent1Schema = z.object({
  current_role: z.string(),
  industry: z.string(),
  experience_years: z.number(),
  seniority_tier: z.enum(["EXECUTIVE", "SENIOR_LEADER", "MANAGER", "PROFESSIONAL", "ENTRY"]),
  execution_skills: z.array(z.string()),
  strategic_skills: z.array(z.string()),
  all_skills: z.array(z.string()),
  automatable_task_ratio: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  primary_ai_threat_vector: z.string().optional().nullable(),
  moat_indicators: z.array(z.string()).optional(),
  executive_impact: z.any().optional().nullable(),
});

// ═══ Agent 2A (Risk Analysis) Output Schema ═══
export const Agent2ASchema = z.object({
  cognitive_moat: z.string(),
  moat_skills: z.array(z.string()),
  pivot_title: z.string().optional(),
  arbitrage_companies_count: z.number().optional(),
  free_advice_1: z.string(),
  free_advice_2: z.string(),
  free_advice_3: z.string().optional(),
  dead_end_narrative: z.string().optional(),
  cultural_risk_assessment: z.any().optional().nullable(),
  pivot_rationale: z.string().optional().nullable(),
});

// ═══ Agent 2B (Action Plan) Output Schema ═══
export const Agent2BSchema = z.object({
  immediate_next_step: z.object({
    action: z.string(),
    rationale: z.string(),
    time_required: z.string(),
    deliverable: z.string(),
  }).optional().nullable(),
  weekly_action_plan: z.array(z.object({
    week: z.number(),
    theme: z.string(),
    action: z.string(),
    deliverable: z.string(),
    effort_hours: z.number(),
    fallback_action: z.string().optional(),
  })).optional(),
  skill_gap_map: z.array(z.object({
    missing_skill: z.string(),
    importance_for_pivot: z.number(),
    fastest_path: z.string(),
    weeks_to_proficiency: z.number(),
    salary_unlock_inr_monthly: z.number().optional(),
  })).optional(),
});

// ═══ ML Obsolescence (process-scan Agent 3) Output Schema ═══
export const MLObsolescenceSchema = z.object({
  judo_strategy: z.object({
    recommended_tool: z.string(),
    pitch: z.string(),
    survivability_after_judo: z.number(),
    months_gained: z.number(),
  }).optional().nullable(),
  weekly_survival_diet: z.object({
    theme: z.string(),
    read: z.object({ title: z.string(), action: z.string(), time_commitment: z.string() }),
    watch: z.object({ title: z.string(), action: z.string(), time_commitment: z.string() }),
    listen: z.object({ title: z.string(), action: z.string(), time_commitment: z.string() }),
  }).optional().nullable(),
  market_position_model: z.any().optional().nullable(),
  career_shock_simulator: z.any().optional().nullable(),
  automation_risk: z.number().optional().nullable(),
});

// ═══ RiskIQ Narrative Schema ═══
export const RiskIQNarrativeSchema = z.object({
  headline: z.string(),
  summary: z.string(),
});

/**
 * Safely validate agent output against a schema.
 * Returns validated data if it passes, or null with a logged warning.
 */
export function validateAgentOutput<T>(
  agentName: string,
  schema: Validator<T>,
  raw: unknown,
): T | null {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  console.warn(`[${agentName}] Schema validation failed: ${result.error}. Raw keys: ${raw && typeof raw === "object" ? Object.keys(raw).join(", ") : "N/A"}`);
  // Return null so callers can handle gracefully
  return null;
}

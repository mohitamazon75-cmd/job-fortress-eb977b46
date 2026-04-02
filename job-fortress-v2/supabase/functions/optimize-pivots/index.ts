// ═══════════════════════════════════════════════════════════════
// AIRMM Multi-Pivot Optimizer — Server-Side Edge Function
// IP-Protected: This logic is NOT exposed in the frontend bundle
// ═══════════════════════════════════════════════════════════════

import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";

// ── Rate limiting (per IP, 30 requests/min) ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── Types ──
type RiskTolerance = "LOW" | "MEDIUM" | "HIGH";

interface AIRMMState {
  currentIncome: number;
  humanCapital: { skillScore: number; adaptability: number };
  market: { demandMultiplier: number; automationPressure: number; contractionRate: number };
  network: { strength: number };
  financial: { monthlyBurn: number; liquidSavings: number };
  constraints: { availableHoursPerWeek: number; mobilityRestricted: boolean; riskTolerance: RiskTolerance };
  geography: { accessibility: number };
}

interface PivotOption {
  id: string;
  label: string;
  targetIncome: number;
  skillMatch: number;
  learningMonths: number;
  learningHoursTotal: number;
  hiringBarrier: number;
  credentialBarrier: number;
  relocationRequired: boolean;
}

// ── Core math (PROPRIETARY — server-side only) ──
const clamp = (x: number, min = 0, max = 1) => Math.max(min, Math.min(max, x));
const logistic = (z: number) => z > 20 ? 1 : z < -20 ? 0 : 1 / (1 + Math.exp(-z));

function computeDecayRate(state: AIRMMState): number {
  const { automationPressure, contractionRate } = state.market;
  const protection = 0.4 * state.humanCapital.skillScore + 0.3 * state.humanCapital.adaptability + 0.3 * state.network.strength;
  const risk = 0.6 * automationPressure + 0.4 * Math.max(0, -contractionRate);
  return clamp(risk * (1 - protection), 0.01, 0.25);
}

function incomeAt(state: AIRMMState, k: number): number {
  const lambda = computeDecayRate(state);
  const floor = state.currentIncome * 0.15;
  return Math.max(state.currentIncome * Math.exp(-lambda * k), floor);
}

function evaluatePivot(state: AIRMMState, pivot: PivotOption) {
  if (pivot.relocationRequired && state.constraints.mobilityRestricted) return { feasible: false as const };
  const weeks = pivot.learningMonths * 4.345;
  const reqHours = pivot.learningHoursTotal / Math.max(weeks, 1);
  if (reqHours > state.constraints.availableHoursPerWeek) return { feasible: false as const };
  const burn = Math.max(state.financial.monthlyBurn, 1);
  const runway = clamp(state.financial.liquidSavings / (burn * 6), 0, 1);
  const z = -1.2 + 1.8 * pivot.skillMatch + 1.2 * state.humanCapital.adaptability + 1.0 * state.network.strength + 0.8 * runway - 1.4 * pivot.hiringBarrier - 1.0 * pivot.credentialBarrier;
  const p = logistic(z);
  const expectedTime = Math.exp(Math.log(pivot.learningMonths + 1) + (0.5 + pivot.hiringBarrier) ** 2 / 2);
  const income = pivot.targetIncome * state.geography.accessibility;
  return { feasible: true as const, successProbability: p, timeMonths: expectedTime, income };
}

function evaluateTrajectory(state: AIRMMState, pivot: PivotOption, horizon = 60) {
  const t = evaluatePivot(state, pivot);
  if (!t.feasible) {
    const finalIncome = incomeAt(state, horizon);
    return { expectedValue: 0, downsideRisk: clamp((state.currentIncome - finalIncome) / state.currentIncome), successProbability: 0, feasible: false };
  }
  const DISCOUNT = 0.005;
  let value = 0;
  for (let k = 0; k <= horizon; k++) {
    const decayIncome = incomeAt(state, k);
    const pivotIncome = k >= t.timeMonths ? t.income : 0;
    const expectedIncome = (1 - t.successProbability) * decayIncome + t.successProbability * pivotIncome;
    value += expectedIncome * Math.exp(-DISCOUNT * k);
  }
  const finalIncome = (1 - t.successProbability) * incomeAt(state, horizon) + t.successProbability * t.income;
  const downside = clamp((state.currentIncome - finalIncome) / state.currentIncome);
  return { expectedValue: value, downsideRisk: downside, successProbability: t.successProbability, feasible: true };
}

function optimizePivots(state: AIRMMState, pivots: PivotOption[], horizonMonths = 60) {
  const ranked = pivots.map(p => {
    const r = evaluateTrajectory(state, p, horizonMonths);
    const riskPenalty = state.constraints.riskTolerance === "LOW" ? 1.5 : state.constraints.riskTolerance === "MEDIUM" ? 1.0 : 0.7;
    const score = r.expectedValue - riskPenalty * r.downsideRisk * state.currentIncome * horizonMonths;
    return { pivot: p, score, ...r };
  });
  ranked.sort((a, b) => b.score - a.score);
  const best = ranked[0];
  return { bestPivot: best?.pivot ?? null, expectedValue: best?.expectedValue ?? 0, downsideRisk: best?.downsideRisk ?? 1, successProbability: best?.successProbability ?? 0, ranked };
}

// ── Input validation ──
function validateState(s: any): s is AIRMMState {
  return s && typeof s.currentIncome === 'number' && s.humanCapital && s.market && s.network && s.financial && s.constraints && s.geography;
}

function validatePivots(p: any): p is PivotOption[] {
  return Array.isArray(p) && p.length > 0 && p.every((x: any) => x.id && typeof x.skillMatch === 'number');
}

// ── Handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in 1 minute." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    const { userId: _jwtUserId, blocked: jwtBlocked } = await validateJwtClaims(req, corsHeaders);
    if (jwtBlocked) return jwtBlocked;

    const { state, pivots, horizonMonths } = await req.json();

    if (!validateState(state)) {
      return new Response(JSON.stringify({ error: "Invalid state object" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!validatePivots(pivots)) {
      return new Response(JSON.stringify({ error: "Invalid pivots array" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = optimizePivots(state, pivots, horizonMonths || 60);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[optimize-pivots] error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

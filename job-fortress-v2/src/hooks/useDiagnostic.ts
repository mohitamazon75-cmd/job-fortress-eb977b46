import { useState, useCallback } from "react";
import {
  calculateRiskScore,
  computeMetrics,
  autoDetectSkills,
  getVerdict,
} from "@/utils/diagnosticCalculations";
import {
  saveDiagnosticResult,
  generateSurvivalPlan,
  generateRolePrompts,
  enableSharing,
} from "@/utils/diagnosticApi";

export type DiagnosticStep = 1 | 2 | 3 | 4 | 5;

export interface DiagnosticState {
  // Inputs
  jobTitle: string;
  monthlyCTC: number | "";
  experienceBand: string;
  aiSkills: Set<string>;
  humanSkills: Set<string>;

  // Computed
  riskScore: number;
  bossSavesMonthly: number;
  multiplierNeeded: number;
  aiCoversPercent: number;
  verdict: string;

  // Claude outputs
  survivalPlan: {
    headline: string;
    phases: Array<{
      phase_number: number;
      name: string;
      days: string;
      goal: string;
      tasks: Array<{
        week: string;
        tag: "ai" | "human" | "strategic";
        title: string;
        detail: string;
        boss_visibility: string;
      }>;
    }>;
  } | null;
  rolePrompts: Array<{
    name: string;
    use_case: string;
    category: string;
    time_saved: string;
    prompt: string;
  }> | null;

  // Meta
  resultId: string | null;
  shareToken: string | null;
  step: DiagnosticStep;
  isLoadingPlan: boolean;
  isLoadingPrompts: boolean;
  error: string | null;

  // Task completion (persisted to localStorage)
  completedTasks: Set<string>;

  // Resume prompt
  hasSavedState: boolean;
}

const STORAGE_KEY = "jobBachao_diagnostic_v1";

function getInitialState(): DiagnosticState {
  return {
    jobTitle: "",
    monthlyCTC: "",
    experienceBand: "3-5 yrs",
    aiSkills: new Set(),
    humanSkills: new Set(),
    riskScore: 0,
    bossSavesMonthly: 0,
    multiplierNeeded: 0,
    aiCoversPercent: 0,
    verdict: "",
    survivalPlan: null,
    rolePrompts: null,
    resultId: null,
    shareToken: null,
    step: 1,
    isLoadingPlan: false,
    isLoadingPrompts: false,
    error: null,
    completedTasks: new Set(),
    hasSavedState: false,
  };
}

export function useDiagnostic() {
  const [state, setState] = useState<DiagnosticState>(() => {
    // Rehydrate from localStorage on mount
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const ageHours = (Date.now() - parsed.timestamp) / 3600000;
        if (ageHours < 72) {
          return {
            ...getInitialState(),
            ...parsed.data,
            aiSkills: new Set(parsed.data.aiSkills ?? []),
            humanSkills: new Set(parsed.data.humanSkills ?? []),
            completedTasks: new Set(parsed.data.completedTasks ?? []),
            hasSavedState: true,
          };
        }
      }
    } catch {
      // ignore parse errors
    }
    return getInitialState();
  });

  const update = useCallback((patch: Partial<DiagnosticState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const persistState = useCallback((newState: DiagnosticState) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          data: {
            ...newState,
            aiSkills: Array.from(newState.aiSkills),
            humanSkills: Array.from(newState.humanSkills),
            completedTasks: Array.from(newState.completedTasks),
          },
        })
      );
    } catch {
      // ignore storage errors
    }
  }, []);

  const setJobTitle = useCallback((value: string) => {
    const detected = autoDetectSkills(value);
    setState((prev) => ({
      ...prev,
      jobTitle: value,
      // Only auto-detect if user hasn't manually selected skills yet
      aiSkills: prev.aiSkills.size === 0 ? new Set(detected.ai) : prev.aiSkills,
      humanSkills: prev.humanSkills.size === 0 ? new Set(detected.human) : prev.humanSkills,
    }));
  }, []);

  const toggleSkill = useCallback((skill: string, type: "ai" | "human") => {
    setState((prev) => {
      const set = type === "ai" ? new Set(prev.aiSkills) : new Set(prev.humanSkills);
      if (set.has(skill)) {
        set.delete(skill);
      } else {
        set.add(skill);
      }
      return type === "ai" ? { ...prev, aiSkills: set } : { ...prev, humanSkills: set };
    });
  }, []);

  const toggleTask = useCallback(
    (taskId: string) => {
      setState((prev) => {
        const tasks = new Set(prev.completedTasks);
        if (tasks.has(taskId)) {
          tasks.delete(taskId);
        } else {
          tasks.add(taskId);
        }
        const next = { ...prev, completedTasks: tasks };
        persistState(next);
        return next;
      });
    },
    [persistState]
  );

  const proceedToRisk = useCallback(() => {
    const aiArr = Array.from(state.aiSkills);
    const huArr = Array.from(state.humanSkills);
    const score = calculateRiskScore(state.jobTitle, aiArr, huArr);
    const { bossSavesMonthly, multiplierNeeded, aiCoversPercent } = computeMetrics(
      state.monthlyCTC as number,
      score
    );
    const verdict = getVerdict(score, state.jobTitle, multiplierNeeded);

    const next: DiagnosticState = {
      ...state,
      riskScore: score,
      bossSavesMonthly,
      multiplierNeeded,
      aiCoversPercent,
      verdict,
      step: 2,
    };
    persistState(next);
    setState(next);
  }, [state, persistState]);

  const generatePlan = useCallback(async () => {
    update({ isLoadingPlan: true, error: null, step: 3 });

    // Small retry loop (2 attempts) before using fallback
    let plan = null;
    let attempts = 0;

    while (attempts < 2 && !plan) {
      try {
        // Save to DB first to get an ID
        const saved = await saveDiagnosticResult({
          job_title: state.jobTitle,
          monthly_ctc: state.monthlyCTC as number,
          experience_band: state.experienceBand,
          ai_skills: Array.from(state.aiSkills),
          human_skills: Array.from(state.humanSkills),
          risk_score: state.riskScore,
          boss_saves_monthly: state.bossSavesMonthly,
          multiplier_needed: state.multiplierNeeded,
          ai_covers_percent: state.aiCoversPercent,
          verdict_text: state.verdict,
        });

        const resultId = saved?.id ?? null;

        plan = await generateSurvivalPlan({
          jobTitle: state.jobTitle,
          monthlyCTC: state.monthlyCTC as number,
          riskScore: state.riskScore,
          aiSkills: Array.from(state.aiSkills),
          humanSkills: Array.from(state.humanSkills),
          experienceBand: state.experienceBand,
          resultId: resultId ?? "",
        });

        const next: DiagnosticState = {
          ...state,
          survivalPlan: plan,
          resultId,
          isLoadingPlan: false,
          step: 3,
        };
        persistState(next);
        setState(next);
        return;
      } catch {
        attempts++;
        if (attempts < 2) {
          // wait 1s before retry
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    // After 2 failed attempts, show error
    update({
      isLoadingPlan: false,
      error: "AI is processing — tap to retry",
      step: 3,
    });
  }, [state, update, persistState]);

  const generatePrompts = useCallback(async () => {
    update({ isLoadingPrompts: true, error: null });

    let prompts = null;
    let attempts = 0;

    while (attempts < 2 && !prompts) {
      try {
        prompts = await generateRolePrompts({
          jobTitle: state.jobTitle,
          aiSkills: Array.from(state.aiSkills),
          experienceBand: state.experienceBand,
          resultId: state.resultId ?? "",
        });

        const next: DiagnosticState = {
          ...state,
          rolePrompts: prompts,
          isLoadingPrompts: false,
          step: 4,
        };
        persistState(next);
        setState(next);
        return;
      } catch {
        attempts++;
        if (attempts < 2) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    update({
      isLoadingPrompts: false,
      error: "AI is processing — tap to retry",
    });
  }, [state, update, persistState]);

  const shareReport = useCallback(async () => {
    if (!state.resultId) return null;
    const token = await enableSharing(state.resultId);
    if (token) setState((prev) => ({ ...prev, shareToken: token }));
    return token;
  }, [state.resultId]);

  const restart = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(getInitialState());
  }, []);

  const dismissSavedState = useCallback(() => {
    update({ hasSavedState: false });
  }, [update]);

  return {
    state,
    setJobTitle,
    setMonthlyCTC: (v: number | "") => update({ monthlyCTC: v }),
    setExperienceBand: (v: string) => update({ experienceBand: v }),
    toggleSkill,
    toggleTask,
    proceedToRisk,
    generatePlan,
    generatePrompts,
    shareReport,
    restart,
    dismissSavedState,
    goToStep: (s: DiagnosticStep) => update({ step: s }),
    retryPlan: () => generatePlan(),
    retryPrompts: () => generatePrompts(),
  };
}

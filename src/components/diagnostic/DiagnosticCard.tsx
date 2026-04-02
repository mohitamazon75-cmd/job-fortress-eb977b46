import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useDiagnostic, type DiagnosticStep } from "@/hooks/useDiagnostic";
import DiagnosticHeader from "./DiagnosticHeader";
import DiagnosticFooter from "./DiagnosticFooter";
import Step1Input from "./steps/Step1Input";
import Step2Risk from "./steps/Step2Risk";
import Step3Plan from "./steps/Step3Plan";
import Step4Prompts from "./steps/Step4Prompts";
import Step5Report from "./steps/Step5Report";

const STEP_TITLES: Record<DiagnosticStep, string> = {
  1: "Is your boss silently calculating your replacement?",
  2: "The invoice your boss is looking at",
  3: "Your 90-day irreplaceability plan",
  4: "Prompts that make you 5× faster today",
  5: "Your diagnostic report",
};

const STEP_CTAS: Partial<Record<DiagnosticStep, string>> = {
  1: "Calculate my risk →",
  2: "Build my survival plan →",
  3: "Get my AI prompts →",
  4: "See my full report →",
};

// Input validation
function validateStep1(state: ReturnType<typeof useDiagnostic>["state"]) {
  const errors: { jobTitle?: string; monthlyCTC?: string; skills?: string } = {};
  if (!state.jobTitle || state.jobTitle.trim().length < 3) {
    errors.jobTitle = "Please enter your current role (min 3 characters)";
  }
  if (
    state.monthlyCTC === "" ||
    typeof state.monthlyCTC !== "number" ||
    state.monthlyCTC < 10000 ||
    state.monthlyCTC > 5000000
  ) {
    errors.monthlyCTC = "Please enter a valid monthly CTC (₹10,000 – ₹50,00,000)";
  }
  if (state.aiSkills.size + state.humanSkills.size === 0) {
    errors.skills = "Please select at least one skill to continue";
  }
  return errors;
}

export default function DiagnosticCard() {
  const hook = useDiagnostic();
  const { state } = hook;
  const [step1Errors, setStep1Errors] = useState<{
    jobTitle?: string;
    monthlyCTC?: string;
    skills?: string;
  }>({});

  // Resume banner
  const showResumeBanner = state.hasSavedState && state.step > 1;

  const handleCTA = () => {
    if (state.step === 1) {
      const errs = validateStep1(state);
      if (Object.keys(errs).length > 0) {
        setStep1Errors(errs);
        return;
      }
      setStep1Errors({});
      hook.proceedToRisk();
    } else if (state.step === 2) {
      hook.generatePlan();
    } else if (state.step === 3) {
      hook.generatePrompts();
    } else if (state.step === 4) {
      hook.goToStep(5);
    }
  };

  return (
    <div className="w-full max-w-[520px] mx-auto">
      {/* Resume banner */}
      {showResumeBanner && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5">
          <p className="text-xs font-medium text-primary">
            Resuming your last diagnostic
          </p>
          <button
            type="button"
            onClick={hook.restart}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-4"
          >
            Start fresh
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <DiagnosticHeader
          step={state.step}
          title={STEP_TITLES[state.step]}
          totalSteps={5}
        />

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {state.step === 1 && <Step1Input hook={hook} errors={step1Errors} />}
            {state.step === 2 && <Step2Risk hook={hook} />}
            {state.step === 3 && <Step3Plan hook={hook} />}
            {state.step === 4 && <Step4Prompts hook={hook} />}
            {state.step === 5 && <Step5Report hook={hook} />}
          </AnimatePresence>
        </div>

        {state.step < 5 && (
          <DiagnosticFooter
            step={state.step}
            ctaLabel={STEP_CTAS[state.step]!}
            isLoading={state.isLoadingPlan || state.isLoadingPrompts}
            error={state.step === 1 ? null : state.error}
            onCTA={handleCTA}
            onBack={state.step > 1 ? () => hook.goToStep((state.step - 1) as DiagnosticStep) : undefined}
            onRestart={hook.restart}
          />
        )}
      </div>
    </div>
  );
}

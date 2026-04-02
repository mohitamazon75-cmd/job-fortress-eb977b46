import { useEffect } from "react";
import { motion } from "framer-motion";
import SkillChip from "../shared/SkillChip";
import { AI_SKILLS, HUMAN_SKILLS, EXPERIENCE_BANDS, formatINR } from "@/utils/diagnosticCalculations";
import type { useDiagnostic } from "@/hooks/useDiagnostic";

type HookReturn = ReturnType<typeof useDiagnostic>;

interface Props {
  hook: HookReturn;
  errors: { jobTitle?: string; monthlyCTC?: string; skills?: string };
}

export default function Step1Input({ hook, errors }: Props) {
  const { state, setJobTitle, setMonthlyCTC, setExperienceBand, toggleSkill } = hook;

  // Format CTC display value in Indian numbering
  const ctcDisplay =
    state.monthlyCTC === ""
      ? ""
      : new Intl.NumberFormat("en-IN").format(state.monthlyCTC as number);

  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-5"
    >
      {/* Job title */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Your current role
        </label>
        <input
          type="text"
          placeholder="e.g. Marketing Manager, Senior Engineer"
          value={state.jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
        />
        {errors.jobTitle && (
          <p className="mt-1.5 text-xs text-destructive font-medium">{errors.jobTitle}</p>
        )}
      </div>

      {/* Monthly CTC */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Monthly CTC (gross)
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
            ₹
          </span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="2,00,000"
            value={ctcDisplay}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              if (raw === "") {
                setMonthlyCTC("");
              } else {
                const num = parseInt(raw, 10);
                if (!isNaN(num)) setMonthlyCTC(num);
              }
            }}
            className="w-full rounded-lg border border-border bg-background pl-8 pr-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
          />
        </div>
        {state.monthlyCTC !== "" && typeof state.monthlyCTC === "number" && state.monthlyCTC > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            ≈ {formatINR(state.monthlyCTC * 12)} per year
          </p>
        )}
        {errors.monthlyCTC && (
          <p className="mt-1.5 text-xs text-destructive font-medium">{errors.monthlyCTC}</p>
        )}
      </div>

      {/* Experience band */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Years of experience
        </label>
        <div className="grid grid-cols-4 gap-2">
          {EXPERIENCE_BANDS.map((band) => (
            <button
              key={band}
              type="button"
              onClick={() => setExperienceBand(band)}
              className={`py-2.5 rounded-lg text-xs font-bold border transition-all ${
                state.experienceBand === band
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {band}
            </button>
          ))}
        </div>
      </div>

      {/* AI-replaceable tasks */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Tasks AI can replace
          </label>
          <span className="text-[10px] text-destructive font-bold">
            {state.aiSkills.size} selected
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-2.5">
          Which of these does your job currently involve?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {AI_SKILLS.map((skill) => (
            <SkillChip
              key={skill}
              label={skill}
              selected={state.aiSkills.has(skill)}
              variant="ai"
              onClick={() => toggleSkill(skill, "ai")}
            />
          ))}
        </div>
      </div>

      {/* Human-moat skills */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Your human edge
          </label>
          <span className="text-[10px] text-green-600 dark:text-green-400 font-bold">
            {state.humanSkills.size} selected
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-2.5">
          Skills that require judgment, relationships, or trust
        </p>
        <div className="flex flex-wrap gap-1.5">
          {HUMAN_SKILLS.map((skill) => (
            <SkillChip
              key={skill}
              label={skill}
              selected={state.humanSkills.has(skill)}
              variant="human"
              onClick={() => toggleSkill(skill, "human")}
            />
          ))}
        </div>
        {errors.skills && (
          <p className="mt-2 text-xs text-destructive font-medium">{errors.skills}</p>
        )}
      </div>
    </motion.div>
  );
}

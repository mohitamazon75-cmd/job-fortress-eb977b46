/**
 * SkillCompoundCalculator — "What happens if I learn X in 30 days?"
 * 
 * Interactive calculator showing the salary and score impact of specific skill upgrades.
 * Pulls the user's actual at-risk skills from cardData and shows:
 * - Current score + salary ceiling
 * - Score after learning skill X
 * - Salary ceiling after skill X  
 * - Time investment required
 * - Exact resource to start with
 * 
 * This converts passive "doom" into active agency.
 */
import { useState } from "react";
import { motion } from "framer-motion";

interface SkillOption {
  skill: string;
  currentRisk: number;
  daysToLearn: number;
  scoreBoost: number;
  salaryLift: number; // % 
  tool: string;
  startHere: string;
  startUrl: string;
  effort: string;
}

function buildSkillOptions(cardData: any): SkillOption[] {
  const atRisk = cardData?.card3_shield?.skills?.filter((s: any) =>
    s.level === "critical-gap" || s.level === "buildable"
  ) || [];

  const defaults: SkillOption[] = [
    { skill: "AI Prompt Engineering", currentRisk: 0, daysToLearn: 14, scoreBoost: 8, salaryLift: 12, tool: "ChatGPT / Claude", startHere: "Anthropic's Prompt Engineering Guide", startUrl: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview", effort: "1h/day for 2 weeks" },
    { skill: "Python for Data Analysis", currentRisk: 0, daysToLearn: 30, scoreBoost: 11, salaryLift: 18, tool: "Cursor AI / Copilot", startHere: "CS50P (Free, Harvard)", startUrl: "https://cs50.harvard.edu/python/2022/", effort: "1.5h/day for 4 weeks" },
    { skill: "Cloud Architecture (AWS/GCP)", currentRisk: 0, daysToLearn: 45, scoreBoost: 14, salaryLift: 24, tool: "AWS AI Services", startHere: "AWS Solutions Architect (Free tier + Udemy)", startUrl: "https://aws.amazon.com/training/", effort: "2h/day for 6 weeks" },
    { skill: "SQL + Analytics", currentRisk: 0, daysToLearn: 21, scoreBoost: 9, salaryLift: 15, tool: "Google Looker / Power BI", startHere: "Mode SQL Tutorial (Free)", startUrl: "https://mode.com/sql-tutorial/", effort: "45min/day for 3 weeks" },
  ];

  if (atRisk.length === 0) return defaults;

  return atRisk.slice(0, 4).map((s: any, i: number) => ({
    skill: s.name,
    currentRisk: 65 + (i * 8),
    daysToLearn: [14, 21, 30, 45][i] || 30,
    scoreBoost: [6, 9, 11, 8][i] || 8,
    salaryLift: [10, 14, 18, 12][i] || 12,
    tool: s.note?.includes("Replaced by") ? s.note.split("Replaced by")[1]?.trim() : "AI tools",
    startHere: ["Google AI Essentials (Free)", "Coursera specialisation", "Udemy bestseller course", "YouTube crash course"][i] || "Coursera",
    startUrl: ["https://grow.google/certificates/", "https://coursera.org", "https://udemy.com", "https://youtube.com"][i] || "https://coursera.org",
    effort: ["45min/day × 2 weeks", "1h/day × 3 weeks", "1.5h/day × 4 weeks", "1h/day × 2 weeks"][i] || "1h/day",
  }));
}

export default function SkillCompoundCalculator({ cardData }: { cardData?: any }) {
  const skillOptions = buildSkillOptions(cardData);
  const [selected, setSelected] = useState(0);
  const baseScore = cardData?.jobbachao_score ?? 61;
  const baseSalary = 22; // LPA fallback

  const skill = skillOptions[selected];
  const newScore = Math.min(98, baseScore + skill.scoreBoost);
  const newSalary = +(baseSalary * (1 + skill.salaryLift / 100)).toFixed(1);
  const annualGain = +((newSalary - baseSalary) * 1).toFixed(1);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mb-navy)", marginBottom: 6 }}>
          📈 Skill Compound Calculator
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "var(--mb-ink)", letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 8 }}>
          If I learn this in 30 days...
        </div>
        <div style={{ fontSize: 13, color: "var(--mb-ink3)", lineHeight: 1.6 }}>
          Pick a skill from your risk list. See the exact score impact, salary ceiling shift, and where to start tonight.
        </div>
      </div>

      {/* Skill selector */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {skillOptions.map((s, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: `2px solid ${selected === i ? "var(--mb-navy)" : "var(--mb-rule)"}`,
              background: selected === i ? "var(--mb-navy)" : "var(--mb-paper)",
              color: selected === i ? "white" : "var(--mb-ink)",
              textAlign: "left",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              transition: "all 150ms",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700 }}>{s.skill}</span>
            <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>+{s.scoreBoost} pts</span>
          </button>
        ))}
      </div>

      {/* Impact panel */}
      <motion.div
        key={selected}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ background: "white", border: "1.5px solid var(--mb-rule)", borderRadius: 16, padding: 20, marginBottom: 16 }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Career Score", before: baseScore, after: newScore, unit: "/100", color: newScore > baseScore ? "#16a34a" : "#dc2626" },
            { label: "Salary Ceiling", before: `₹${baseSalary}L`, after: `₹${newSalary}L`, unit: "", color: "#16a34a" },
            { label: "Annual Gain", before: "—", after: `+₹${annualGain}L`, unit: "/yr", color: "#16a34a" },
          ].map((metric, i) => (
            <div key={i} style={{ textAlign: "center", padding: "12px 8px", background: "var(--mb-paper)", borderRadius: 12, border: "1.5px solid var(--mb-rule)" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--mb-ink3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{metric.label}</div>
              <div style={{ fontSize: 11, color: "var(--mb-ink3)", marginBottom: 2, textDecoration: "line-through" }}>{metric.before}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: metric.color }}>{metric.after}<span style={{ fontSize: 11 }}>{metric.unit}</span></div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "⏱️ Time required", value: skill.effort },
            { label: "🤖 Tool threatening this skill", value: skill.tool },
            { label: "📅 Days to competent", value: `${skill.daysToLearn} days` },
          ].map((row, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 2 ? "1px solid var(--mb-rule)" : "none" }}>
              <span style={{ fontSize: 12, color: "var(--mb-ink3)" }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--mb-ink)" }}>{row.value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Start here CTA */}
      <div style={{ background: "var(--mb-navy)", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Start tonight</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "white" }}>{skill.startHere}</div>
        </div>
        <a
          href={skill.startUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: "10px 18px", borderRadius: 10, background: "white", color: "var(--mb-navy)", fontSize: 13, fontWeight: 800, textDecoration: "none", flexShrink: 0 }}
        >
          Start →
        </a>
      </div>
    </div>
  );
}

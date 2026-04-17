/**
 * OfficePowerVocab — "Use This, Not That"
 * 
 * Professional vocabulary upgrade tool for the Indian tech workplace.
 * Shows the amateur phrase vs the power phrase, with context on WHY the
 * upgrade works. Filterable by situation: negotiation, performance review,
 * leadership, presenting data, handling conflict.
 * 
 * Designed to be fun, instantly useful, and shareable on LinkedIn.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface VocabEntry {
  situation: string;
  weak: string;
  power: string;
  why: string;
  example: string;
  emoji: string;
}

const VOCAB_DATA: VocabEntry[] = [
  // Negotiation
  { situation: "negotiation", emoji: "💰", weak: "I want a higher salary", power: "Based on market data for this role in Bengaluru, the 75th percentile is ₹X. I'd like to align to that.", why: "Anchors to external data, not personal need. Removes emotion, adds evidence.", example: "Use in: Annual appraisal, offer negotiation" },
  { situation: "negotiation", emoji: "🤝", weak: "Can you give me a better offer?", power: "I have a competing offer at ₹X. I'd prefer to stay here — what can we do to close the gap?", why: "Creates real leverage without burning the relationship. Gives them a reason to move.", example: "Use in: Counter-offer conversations" },
  { situation: "negotiation", emoji: "⏳", weak: "I need more time to decide", power: "I want to make this decision thoughtfully. Can I get back to you by Friday?", why: "Same request but signals respect for both sides, not just stalling.", example: "Use in: Any high-stakes decision" },
  { situation: "negotiation", emoji: "📊", weak: "I work really hard", power: "In Q3, I delivered X which resulted in Y outcome — that's the kind of impact I plan to continue.", why: "Work ethic is assumed. Outcomes with numbers are remembered.", example: "Use in: Appraisal, promotion conversations" },

  // Performance review
  { situation: "performance", emoji: "🎯", weak: "I did my best", power: "I delivered [outcome] with [constraint]. Here's what I'd do differently.", why: "Ownership + self-awareness. Shows you can improve, not just defend.", example: "Use in: Annual review, project retrospectives" },
  { situation: "performance", emoji: "📈", weak: "Things went well", power: "We achieved [metric] against a target of [metric], which represents a [%] improvement.", why: "Quantified outcomes are 3x more memorable in reviews than qualitative statements.", example: "Use in: Presenting your own achievements" },
  { situation: "performance", emoji: "🔄", weak: "That wasn't my fault", power: "In hindsight, I could have flagged the risk earlier. Here's how I'd handle it next time.", why: "Blame-shifting destroys trust. Accountability builds it — even when it wasn't your fault.", example: "Use in: Post-mortems, project failures" },
  { situation: "performance", emoji: "🌟", weak: "I want to grow", power: "I'd like to own [specific scope] in the next 6 months. Here's my plan to earn that.", why: "Vague ambition is noise. Specific scope with a plan is a proposal.", example: "Use in: Career growth conversations" },

  // Leadership & Influence
  { situation: "leadership", emoji: "💡", weak: "I think we should do X", power: "The data suggests X. I'd like to run a 2-week experiment to validate before we commit.", why: "Replaces opinion with hypothesis. De-risks the decision for your audience.", example: "Use in: Proposing changes, pitching ideas" },
  { situation: "leadership", emoji: "🛑", weak: "I disagree", power: "I see this differently. Can I share the data I'm looking at?", why: "Opens dialogue instead of triggering defensiveness. You disagree with data, not with them.", example: "Use in: Any disagreement with leadership" },
  { situation: "leadership", emoji: "🤔", weak: "That's not possible", power: "Given our current constraints, here are three options with different tradeoffs.", why: "Never block — redirect. Gives the other person agency while being honest about limits.", example: "Use in: When asked for something unrealistic" },
  { situation: "leadership", emoji: "👥", weak: "The team is struggling", power: "We have a capacity issue that's creating delivery risk. Here's what we need to resolve it.", why: "Frame as a risk to the business, not a complaint about the team. Gets resources faster.", example: "Use in: Escalations, resource requests" },

  // Presenting data
  { situation: "data", emoji: "📊", weak: "As you can see from this chart...", power: "The key insight here is [X]. Everything else in this chart supports that.", why: "Never describe data — interpret it. Your job is to tell them what to think, not what to see.", example: "Use in: Any data presentation" },
  { situation: "data", emoji: "🎯", weak: "The numbers are mixed", power: "Two metrics improved, one declined. The decline in X is the most important story here.", why: "Acknowledge complexity but give them a clear takeaway. Ambiguity creates distrust.", example: "Use in: Monthly/quarterly business reviews" },
  { situation: "data", emoji: "⚡", weak: "We don't have enough data yet", power: "With current data, the signal points to X. I'll have higher confidence after [date/event].", why: "Gives a provisional answer while being honest about uncertainty. Never leave a vacuum.", example: "Use in: Early-stage analysis presentations" },
  { situation: "data", emoji: "🔍", weak: "I'll look into it", power: "I'll come back to you by [day] with a clear answer. What's the most important question for you?", why: "Commits to a timeline and narrows scope so you can actually deliver.", example: "Use in: When you're asked something you don't know" },

  // Conflict
  { situation: "conflict", emoji: "🤝", weak: "You're wrong", power: "Help me understand your reasoning — I'm seeing this data differently.", example: "Use in: Technical disagreements", why: "Curiosity is disarming. It also forces them to articulate their logic, which often exposes flaws." },
  { situation: "conflict", emoji: "🔥", weak: "This keeps happening", power: "I've noticed a pattern in the last 3 sprints. Can we address the root cause?", why: "Patterns are facts. 'This keeps happening' is a complaint. Name the pattern, propose a solution.", example: "Use in: Recurring process problems" },
  { situation: "conflict", emoji: "🧊", weak: "I'm frustrated", power: "I want to be direct — this situation is creating risk for the project. Can we align on a path forward?", why: "Emotion is valid but 'project risk' gets action. Name the business impact, not the feeling.", example: "Use in: When you're genuinely angry" },
  { situation: "conflict", emoji: "📝", weak: "We never agreed on that", power: "My recollection is different. Can we pull up the thread/doc and align on what was decided?", why: "Never claim memory in a dispute. Go to evidence. Both sides look better.", example: "Use in: Scope creep, miscommunication disputes" },
];

const SITUATIONS = [
  { id: "all", label: "All Situations", emoji: "🎯" },
  { id: "negotiation", label: "Negotiation", emoji: "💰" },
  { id: "performance", label: "Performance Review", emoji: "📈" },
  { id: "leadership", label: "Leadership", emoji: "💡" },
  { id: "data", label: "Presenting Data", emoji: "📊" },
  { id: "conflict", label: "Conflict", emoji: "🤝" },
];

export default function OfficePowerVocab({ cardData }: { cardData?: any }) {
  // Default to most relevant situation based on user's role and years
  const getDefaultFilter = () => {
    const title = (cardData?.user?.current_title || "").toLowerCase();
    const years = parseInt(cardData?.user?.years_experience || "0");
    if (years >= 8 || title.includes("lead") || title.includes("manager") || title.includes("director")) return "leadership";
    if (title.includes("data") || title.includes("analyst") || title.includes("bi")) return "data";
    if (title.includes("finance") || title.includes("ca") || title.includes("account")) return "negotiation";
    return "all";
  };
  const [filter, setFilter] = useState(getDefaultFilter);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const filtered = filter === "all" ? VOCAB_DATA : VOCAB_DATA.filter(v => v.situation === filter);

  const handleCopy = (idx: number, entry: VocabEntry) => {
    navigator.clipboard.writeText(`Instead of: "${entry.weak}"\nSay: "${entry.power}"\nWhy: ${entry.why}`).catch(() => {});
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mb-navy)", marginBottom: 6 }}>
          🗣️ Office Power Vocabulary
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "var(--mb-ink)", letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 8 }}>
          Use This, Not That
        </div>
        <div style={{ fontSize: 13, color: "var(--mb-ink3)", lineHeight: 1.6 }}>
          20 power phrases for the Indian tech workplace. The exact words that signal seniority, ownership, and strategic thinking — without sounding fake.
        </div>
      </div>

      {/* Situation filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {SITUATIONS.map(s => (
          <button
            key={s.id}
            onClick={() => { setFilter(s.id); setExpanded(null); }}
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              border: `1.5px solid ${filter === s.id ? "var(--mb-navy)" : "var(--mb-rule)"}`,
              background: filter === s.id ? "var(--mb-navy)" : "var(--mb-paper)",
              color: filter === s.id ? "white" : "var(--mb-ink3)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 150ms",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {s.emoji} {s.label}
          </button>
        ))}
      </div>

      {/* Vocab cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <AnimatePresence mode="popLayout">
          {filtered.map((entry, idx) => {
            const isOpen = expanded === idx;
            return (
              <motion.div
                key={`${entry.situation}-${idx}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2, delay: idx * 0.03 }}
                style={{ border: "1.5px solid var(--mb-rule)", borderRadius: 14, overflow: "hidden", background: "white" }}
              >
                {/* Collapsed — shows weak → power */}
                <button
                  onClick={() => setExpanded(isOpen ? null : idx)}
                  style={{ width: "100%", padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "flex-start", gap: 12 }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.3 }}>{entry.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Weak phrase — struck through */}
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "var(--mb-red, #dc2626)", textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0 }}>❌ Avoid</span>
                      <span style={{ fontSize: 12, color: "var(--mb-red, #dc2626)", textDecoration: "line-through", opacity: 0.7 }}>{entry.weak}</span>
                    </div>
                    {/* Power phrase */}
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "var(--mb-green, #16a34a)", textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0 }}>✅ Say</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--mb-ink)", lineHeight: 1.4 }}>{entry.power}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 14, color: "var(--mb-ink3)", flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 200ms" }}>▾</span>
                </button>

                {/* Expanded — shows WHY + example + copy */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: "hidden" }}
                    >
                      <div style={{ padding: "0 16px 16px 52px", borderTop: "1px solid var(--mb-rule)" }}>
                        <div style={{ paddingTop: 12, marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--mb-navy)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Why it works</div>
                          <div style={{ fontSize: 13, color: "var(--mb-ink2)", lineHeight: 1.65 }}>{entry.why}</div>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--mb-ink3)", fontStyle: "italic", marginBottom: 12 }}>📍 {entry.example}</div>
                        <button
                          onClick={() => handleCopy(idx, entry)}
                          style={{ padding: "7px 14px", borderRadius: 10, background: copied === idx ? "var(--mb-green, #16a34a)" : "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", color: copied === idx ? "white" : "var(--mb-ink3)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 150ms" }}
                        >
                          {copied === idx ? "✓ Copied" : "Copy phrase"}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 12, background: "var(--mb-navy-tint)", border: "1px solid var(--mb-navy-tint2)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--mb-navy)", marginBottom: 3 }}>💡 How to use this</div>
        <div style={{ fontSize: 11, color: "var(--mb-ink3)", lineHeight: 1.6 }}>Pick 2 phrases from your weakest area and use them deliberately in this week's meetings. Repetition builds the new vocabulary into muscle memory.</div>
      </div>
    </div>
  );
}

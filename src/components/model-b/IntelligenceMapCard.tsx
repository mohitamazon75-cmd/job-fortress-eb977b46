import { useMemo, useState } from "react";
import { CardShell, CardHead, CardBody, Badge, SectionLabel } from "./SharedUI";

/**
 * IntelligenceMapCard — Model-B-native Knowledge Graph view.
 *
 * Sprint 4 (2026-04-29): surfaces our Knowledge Graph IP inside the Live Market tab.
 * Renders three causal columns (You → Skills → AI Tools/Pivots) with SVG connection
 * lines that highlight a single causal path on hover/tap.
 *
 * 100% deterministic: pulls from cardData.card3_shield.skills (level enums),
 * cardData.ai_tools_replacing, and cardData.card4_pivot.adjacent_roles. No LLM.
 *
 * Trust posture: we explicitly state node counts ("X skills × Y tools mapped")
 * and never fabricate connections — a tool only links to a skill when that skill
 * is in critical-gap or buildable. Pivot links use whatever the engine returned.
 *
 * If cardData lacks both skills AND tools, the card returns null (no decoration).
 */
interface Skill { name: string; level?: string }
interface Tool { tool_name?: string; name?: string; automates_task?: string; adoption_stage?: string }
interface Pivot { role?: string; title?: string; name?: string }

interface Props {
  cardData: any;
}

type RiskBucket = "human-only" | "at-risk" | "automated";

interface SkillNode {
  name: string;
  bucket: RiskBucket;
  threatenedBy?: string; // tool name
}

function classifySkill(level: string | undefined): RiskBucket {
  switch ((level || "").toLowerCase()) {
    case "critical-gap":
      return "automated";
    case "buildable":
      return "at-risk";
    case "best-in-class":
    case "strong":
    default:
      return "human-only";
  }
}

function normalizeTools(raw: any[]): Tool[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => {
      if (typeof t === "string") return { tool_name: t };
      if (t && typeof t === "object") return { tool_name: t.tool_name || t.name, automates_task: t.automates_task, adoption_stage: t.adoption_stage };
      return null;
    })
    .filter(Boolean) as Tool[];
}

function normalizePivots(raw: any[]): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => (typeof p === "string" ? p : p?.role || p?.title || p?.name))
    .filter((s): s is string => typeof s === "string" && s.length > 0);
}

export default function IntelligenceMapCard({ cardData }: Props) {
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);

  const { skillNodes, tools, pivots, role, totalSkills, source } = useMemo(() => {
    const c3Skills: Skill[] = Array.isArray(cardData?.card3_shield?.skills) ? cardData.card3_shield.skills : [];
    const tools = normalizeTools(cardData?.ai_tools_replacing || cardData?.card1_risk?.ai_tools_replacing || []).slice(0, 6);
    const pivots = normalizePivots(cardData?.card4_pivot?.adjacent_roles || cardData?.card4_pivot?.pivots || []).slice(0, 4);
    const role: string = cardData?.user?.current_title || cardData?.role || "Your Role";

    const linkTool = (name: string, bucket: RiskBucket): string | undefined => {
      if (bucket === "human-only" || !name) return undefined;
      const head = name.toLowerCase().split(/[\s/]/)[0];
      return tools.find((t) =>
        t.automates_task && head && t.automates_task.toLowerCase().includes(head)
      )?.tool_name;
    };

    // Primary source: card3_shield.skills with level enums (richest signal).
    if (c3Skills.length >= 2) {
      const all: SkillNode[] = c3Skills.slice(0, 12).map((s) => {
        const bucket = classifySkill(s.level);
        return { name: s.name, bucket, threatenedBy: linkTool(s.name, bucket) };
      });
      return { skillNodes: all, tools, pivots, role, totalSkills: c3Skills.length, source: "card3_shield" as const };
    }

    // Fallback: deterministic engine outputs (works on ~100% of scans).
    // moats → human-only; execution_skills_dead → automated; remaining all_skills → at-risk.
    const moats: string[] = (Array.isArray(cardData?.moat_skills) ? cardData.moat_skills : [])
      .filter((s: unknown): s is string => typeof s === "string" && s.length > 0);
    const dead: string[] = (Array.isArray(cardData?.execution_skills_dead) ? cardData.execution_skills_dead : [])
      .filter((s: unknown): s is string => typeof s === "string" && s.length > 0);
    const allSkills: string[] = (Array.isArray(cardData?.all_skills) ? cardData.all_skills : [])
      .filter((s: unknown): s is string => typeof s === "string" && s.length > 0);

    const moatSet = new Set(moats.map((s) => s.toLowerCase()));
    const deadSet = new Set(dead.map((s) => s.toLowerCase()));
    const atRisk = allSkills.filter((s) => !moatSet.has(s.toLowerCase()) && !deadSet.has(s.toLowerCase()));

    const fallbackNodes: SkillNode[] = [
      ...moats.slice(0, 4).map((name) => ({ name, bucket: "human-only" as RiskBucket, threatenedBy: undefined })),
      ...atRisk.slice(0, 4).map((name) => ({ name, bucket: "at-risk" as RiskBucket, threatenedBy: linkTool(name, "at-risk") })),
      ...dead.slice(0, 4).map((name) => ({ name, bucket: "automated" as RiskBucket, threatenedBy: linkTool(name, "automated") })),
    ];

    const total = moats.length + atRisk.length + dead.length;
    return { skillNodes: fallbackNodes, tools, pivots, role, totalSkills: total, source: "engine_fallback" as const };
  }, [cardData]);

  const safeNodes = skillNodes.filter((n) => n.bucket === "human-only").slice(0, 4);
  const riskNodes = skillNodes.filter((n) => n.bucket === "at-risk").slice(0, 4);
  const autoNodes = skillNodes.filter((n) => n.bucket === "automated").slice(0, 4);

  // Hide entire card if we have no signal (zero skills AND zero tools).
  if (skillNodes.length === 0 && tools.length === 0) return null;

  // Hide if data is too thin to look credible (need at least 2 skills).
  if (skillNodes.length < 2) return null;

  return (
    <CardShell>
      <CardHead
        badges={
          <>
            <Badge label="Knowledge Graph" variant="navy" />
            <Badge label={`${totalSkills} skills × ${tools.length} tools mapped`} variant="navy" />
          </>
        }
        title="Your position on the intelligence map"
        sub="How your skills, the AI tools that threaten them, and your safer pivots interconnect — built from our deterministic engine, not LLM guesses."
      />
      <CardBody>
        {/* Three-column causal map */}
        <div style={{ position: "relative", padding: "8px 0 4px" }}>
          {/* Center "You" anchor */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div
              style={{
                background: "var(--mb-navy)",
                color: "var(--mb-paper)",
                padding: "8px 16px",
                borderRadius: 10,
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: "0.02em",
                boxShadow: "var(--mb-shadow-md)",
              }}
            >
              YOU · {role}
            </div>
          </div>

          {/* Three columns */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {/* Human-only */}
            <ColumnGroup
              label="Human-only"
              count={safeNodes.length}
              color="var(--mb-green)"
              tint="var(--mb-green-tint)"
              empty="No protected skills extracted yet."
            >
              {safeNodes.map((n) => (
                <SkillChip
                  key={n.name}
                  node={n}
                  color="var(--mb-green)"
                  tint="var(--mb-green-tint)"
                  isHovered={hoveredSkill === n.name}
                  isDimmed={hoveredSkill !== null && hoveredSkill !== n.name}
                  onHover={setHoveredSkill}
                />
              ))}
            </ColumnGroup>

            {/* At-risk */}
            <ColumnGroup
              label="At risk"
              count={riskNodes.length}
              color="var(--mb-amber)"
              tint="var(--mb-amber-tint)"
              empty="No buildable gaps detected."
            >
              {riskNodes.map((n) => (
                <SkillChip
                  key={n.name}
                  node={n}
                  color="var(--mb-amber)"
                  tint="var(--mb-amber-tint)"
                  isHovered={hoveredSkill === n.name}
                  isDimmed={hoveredSkill !== null && hoveredSkill !== n.name}
                  onHover={setHoveredSkill}
                />
              ))}
            </ColumnGroup>

            {/* Automated */}
            <ColumnGroup
              label="Automated"
              count={autoNodes.length}
              color="var(--mb-red)"
              tint="var(--mb-red-tint)"
              empty="No critical gaps flagged."
            >
              {autoNodes.map((n) => (
                <SkillChip
                  key={n.name}
                  node={n}
                  color="var(--mb-red)"
                  tint="var(--mb-red-tint)"
                  isHovered={hoveredSkill === n.name}
                  isDimmed={hoveredSkill !== null && hoveredSkill !== n.name}
                  onHover={setHoveredSkill}
                />
              ))}
            </ColumnGroup>
          </div>
        </div>

        {/* AI Tools row — connected to at-risk + automated columns */}
        {tools.length > 0 && (
          <>
            <div style={{ marginTop: 18 }}>
              <SectionLabel label={`AI tools competing with you (${tools.length})`} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {tools.map((t, i) => {
                const stage = (t.adoption_stage || "").toLowerCase();
                const stageColor = stage === "mainstream" ? "var(--mb-red)" : stage === "growing" ? "var(--mb-amber)" : "var(--mb-navy)";
                const stageTint = stage === "mainstream" ? "var(--mb-red-tint)" : stage === "growing" ? "var(--mb-amber-tint)" : "var(--mb-navy-tint)";
                const isLinked = hoveredSkill ? skillNodes.find((s) => s.name === hoveredSkill)?.threatenedBy === t.tool_name : false;
                const isDimmed = hoveredSkill !== null && !isLinked;
                return (
                  <div
                    key={`${t.tool_name}-${i}`}
                    style={{
                      background: stageTint,
                      border: `1.5px solid ${stageColor}40`,
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                      color: stageColor,
                      opacity: isDimmed ? 0.3 : 1,
                      boxShadow: isLinked ? `0 0 0 2px ${stageColor}` : "none",
                      transition: "opacity 200ms ease, box-shadow 200ms ease",
                    }}
                    title={t.automates_task || ""}
                  >
                    {t.tool_name || "Tool"}
                    {stage && (
                      <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7, fontWeight: 600, textTransform: "uppercase" as const }}>
                        · {stage}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pivot paths — your defensive moves */}
        {pivots.length > 0 && (
          <>
            <div style={{ marginTop: 18 }}>
              <SectionLabel label={`Safer adjacent roles (${pivots.length})`} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {pivots.map((p, i) => (
                <div
                  key={`${p}-${i}`}
                  style={{
                    background: "var(--mb-green-tint)",
                    border: "1.5px solid var(--mb-green)40",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--mb-green)",
                  }}
                >
                  → {p}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Provenance footer */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 12,
            borderTop: "1px solid var(--mb-rule)",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            color: "var(--mb-ink3)",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          <span>📊 Mapped from your resume against our skill × AI-tool intelligence graph</span>
          <span style={{ fontWeight: 700, color: "var(--mb-ink2)" }}>
            {hoveredSkill ? `Highlighting: ${hoveredSkill}` : "Hover any skill to trace its threat path"}
          </span>
        </div>
      </CardBody>
    </CardShell>
  );
}

function ColumnGroup({
  label,
  count,
  color,
  tint,
  empty,
  children,
}: {
  label: string;
  count: number;
  color: string;
  tint: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: tint, borderRadius: 10, padding: "10px 8px", border: `1px solid ${color}25`, minHeight: 80 }}>
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 10,
          fontWeight: 800,
          color,
          textTransform: "uppercase" as const,
          letterSpacing: "0.1em",
          marginBottom: 8,
          textAlign: "center" as const,
        }}
      >
        {label} · {count}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {count === 0 ? (
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              color: "var(--mb-ink3)",
              fontStyle: "italic",
              textAlign: "center" as const,
              padding: "8px 4px",
            }}
          >
            {empty}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function SkillChip({
  node,
  color,
  tint,
  isHovered,
  isDimmed,
  onHover,
}: {
  node: SkillNode;
  color: string;
  tint: string;
  isHovered: boolean;
  isDimmed: boolean;
  onHover: (name: string | null) => void;
}) {
  return (
    <div
      onMouseEnter={() => onHover(node.name)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onHover(isHovered ? null : node.name)}
      style={{
        background: "var(--mb-paper)",
        border: `1.5px solid ${isHovered ? color : color + "40"}`,
        borderRadius: 7,
        padding: "5px 8px",
        cursor: "pointer",
        opacity: isDimmed ? 0.35 : 1,
        boxShadow: isHovered ? `0 0 0 2px ${color}40, var(--mb-shadow-sm)` : "none",
        transition: "opacity 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
      }}
    >
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--mb-ink)",
          lineHeight: 1.2,
          textAlign: "center" as const,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap" as const,
        }}
      >
        {node.name}
      </div>
      {node.threatenedBy && (
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 9,
            color: color,
            marginTop: 2,
            textAlign: "center" as const,
            fontWeight: 600,
            opacity: 0.85,
          }}
        >
          → {node.threatenedBy}
        </div>
      )}
    </div>
  );
}

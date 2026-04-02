import { motion } from 'framer-motion';
import { ScanReport, normalizeTools } from '@/lib/scan-engine';
import { Brain, AlertTriangle, Shield, ArrowRight, Zap, Database } from 'lucide-react';

interface KnowledgeGraphViewProps {
  report: ScanReport;
}

interface SkillNode {
  name: string;
  risk: number;
  type: 'safe' | 'at-risk' | 'automated';
  threatenedBy?: string;
}

export default function KnowledgeGraphView({ report }: KnowledgeGraphViewProps) {
  const skillAdjustments = report.score_breakdown?.skill_adjustments || [];
  const tools = normalizeTools(report.ai_tools_replacing || []);
  const moatSkills = report.moat_skills || [];
  const pivotRoles = (report.pivot_roles || []).slice(0, 3);
  const role = report.role || 'Your Role';

  // Build skill nodes
  const skillNodes: SkillNode[] = skillAdjustments.map(sa => {
    const matchedTool = tools.find(t =>
      t.automates_task?.toLowerCase().includes(sa.skill_name.toLowerCase().split(' ')[0])
    );
    return {
      name: sa.skill_name,
      risk: sa.automation_risk,
      type: sa.automation_risk >= 75 ? 'automated' : sa.automation_risk >= 40 ? 'at-risk' : 'safe',
      threatenedBy: matchedTool?.tool_name,
    };
  });

  // Add moat skills not in adjustments
  const seenSkills = new Set(skillNodes.map(s => s.name.toLowerCase()));
  moatSkills.forEach(ms => {
    if (!seenSkills.has(ms.toLowerCase())) {
      skillNodes.push({ name: ms, risk: 10, type: 'safe' });
    }
  });

  const safeNodes = skillNodes.filter(n => n.type === 'safe');
  const riskNodes = skillNodes.filter(n => n.type === 'at-risk');
  const autoNodes = skillNodes.filter(n => n.type === 'automated');
  const threatTools = tools.slice(0, 5);

  if (skillNodes.length === 0) return null;

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'safe': return 'border-prophet-green/40 bg-prophet-green/10 text-prophet-green';
      case 'at-risk': return 'border-prophet-gold/40 bg-prophet-gold/10 text-prophet-gold';
      case 'automated': return 'border-destructive/40 bg-destructive/10 text-destructive';
      default: return 'border-border bg-muted text-foreground';
    }
  };

  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-card p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10">
          <Database className="w-4.5 h-4.5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-black text-foreground uppercase tracking-tight">Knowledge Graph Position</h3>
          <p className="text-[11px] text-muted-foreground">Where you sit in our intelligence map of {skillNodes.length} skills × {tools.length} AI tools</p>
        </div>
      </div>

      {/* Central role node + radiating skills */}
      <div className="relative">
        {/* Center node */}
        <div className="flex justify-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="px-5 py-3 rounded-xl border-2 border-primary bg-primary/10 text-center"
          >
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">You</p>
            <p className="text-sm font-black text-primary">{role}</p>
          </motion.div>
        </div>

        {/* Three columns: Safe / At-Risk / Automated */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {/* Safe skills */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 mb-2">
              <Shield className="w-3.5 h-3.5 text-prophet-green" />
              <span className="text-[11px] font-black uppercase tracking-widest text-prophet-green">
                Human-Only ({safeNodes.length})
              </span>
            </div>
            {safeNodes.slice(0, 4).map((node, i) => (
              <motion.div
                key={node.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06 }}
                className={`px-2.5 py-2 rounded-lg border text-center ${getNodeColor(node.type)}`}
              >
                <p className="text-[11px] font-bold truncate">{node.name}</p>
                <p className="text-[11px] opacity-70">{node.risk}% risk</p>
              </motion.div>
            ))}
            {safeNodes.length > 4 && (
              <p className="text-[11px] text-muted-foreground text-center">+{safeNodes.length - 4} more</p>
            )}
          </div>

          {/* At-risk skills */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-prophet-gold" />
              <span className="text-[11px] font-black uppercase tracking-widest text-prophet-gold">
                At Risk ({riskNodes.length})
              </span>
            </div>
            {riskNodes.slice(0, 4).map((node, i) => (
              <motion.div
                key={node.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                className={`px-2.5 py-2 rounded-lg border text-center ${getNodeColor(node.type)}`}
              >
                <p className="text-[11px] font-bold truncate">{node.name}</p>
                <p className="text-[11px] opacity-70">{node.risk}% risk</p>
                {node.threatenedBy && (
                  <p className="text-[10px] opacity-50 truncate mt-0.5">→ {node.threatenedBy}</p>
                )}
              </motion.div>
            ))}
            {riskNodes.length > 4 && (
              <p className="text-[11px] text-muted-foreground text-center">+{riskNodes.length - 4} more</p>
            )}
          </div>

          {/* Automated skills */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5 text-destructive" />
              <span className="text-[11px] font-black uppercase tracking-widest text-destructive">
                Automated ({autoNodes.length})
              </span>
            </div>
            {autoNodes.slice(0, 4).map((node, i) => (
              <motion.div
                key={node.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.06 }}
                className={`px-2.5 py-2 rounded-lg border text-center ${getNodeColor(node.type)}`}
              >
                <p className="text-[11px] font-bold truncate">{node.name}</p>
                <p className="text-[11px] opacity-70">{node.risk}% risk</p>
                {node.threatenedBy && (
                  <p className="text-[10px] opacity-50 truncate mt-0.5">→ {node.threatenedBy}</p>
                )}
              </motion.div>
            ))}
            {autoNodes.length > 4 && (
              <p className="text-[11px] text-muted-foreground text-center">+{autoNodes.length - 4} more</p>
            )}
          </div>
        </div>
      </div>

      {/* AI Tools — Professional categorized view */}
      {threatTools.length > 0 && (() => {
        const normalize = (s: string) => (s || '').toLowerCase().trim();
        const mainstream = threatTools.filter(t => normalize(t.adoption_stage) === 'mainstream');
        const growing = threatTools.filter(t => normalize(t.adoption_stage) === 'growing');
        const early = threatTools.filter(t => !['mainstream', 'growing'].includes(normalize(t.adoption_stage)));

        const categories = [
          { label: 'Mainstream', tools: mainstream, color: 'text-destructive', border: 'border-destructive/25', bg: 'bg-destructive/[0.06]', dot: 'bg-destructive' },
          { label: 'Growing', tools: growing, color: 'text-prophet-gold', border: 'border-prophet-gold/25', bg: 'bg-prophet-gold/[0.06]', dot: 'bg-prophet-gold' },
          { label: 'Early Stage', tools: early, color: 'text-primary', border: 'border-primary/25', bg: 'bg-primary/[0.06]', dot: 'bg-primary' },
        ].filter(c => c.tools.length > 0);

        return (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-foreground" />
                <h4 className="text-xs font-black uppercase tracking-wider text-foreground">AI Tools Competing With You</h4>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Live · Latest</span>
            </div>

            <div className="space-y-2.5">
              {categories.map((cat) => (
                <div key={cat.label} className={`rounded-lg border ${cat.border} ${cat.bg} p-3`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={`w-2 h-2 rounded-full ${cat.dot}`} />
                    <span className={`text-[11px] font-black uppercase tracking-[0.15em] ${cat.color}`}>{cat.label}</span>
                    <span className="text-[11px] text-muted-foreground ml-auto">{cat.tools.length} tool{cat.tools.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-1.5">
                    {cat.tools.map((tool, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.05 }}
                        className="flex items-start gap-2"
                      >
                        <span className={`text-[11px] font-bold ${cat.color} shrink-0`}>{tool.tool_name}</span>
                        {tool.automates_task && (
                          <span className="text-[10px] text-muted-foreground leading-tight">— {tool.automates_task}</span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Pivot paths */}
      {pivotRoles.length > 0 && (
        <div className="rounded-xl border border-prophet-green/15 bg-prophet-green/[0.03] p-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-prophet-green mb-2">
            Adjacent Safer Roles (Pivot Paths)
          </p>
          <div className="flex flex-wrap gap-2">
            {pivotRoles.map((pr: any, i: number) => {
              const name = typeof pr === 'string' ? pr : pr.role || pr.title || pr.name;
              return (
                <span key={i} className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-prophet-green/20 bg-prophet-green/10 text-prophet-green flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  {name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Data badge */}
      <p className="text-[11px] text-muted-foreground text-center">
        📊 <span className="font-bold">Computed</span> · Mapped from {skillNodes.length} skills × {tools.length} AI tools in our Knowledge Graph
      </p>
    </div>
  );
}

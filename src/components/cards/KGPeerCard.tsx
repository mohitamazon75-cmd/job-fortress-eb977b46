import { motion } from 'framer-motion';
import { ScanReport, normalizeTools } from '@/lib/scan-engine';
import { Database, Shield, AlertTriangle, Zap, ArrowRight, Network } from 'lucide-react';
import { computeStabilityScore } from '@/lib/stability-score';
import { useState } from 'react';
import { classifySkills, getSkillCounts } from '@/lib/unified-skill-classifier';

interface KGPeerCardProps {
  report: ScanReport;
}

interface SkillNode {
  name: string;
  risk: number;
  type: 'safe' | 'at-risk' | 'automated';
  threatenedBy?: string;
  weight?: number;
}

export default function KGPeerCard({ report }: KGPeerCardProps) {
  const score = computeStabilityScore(report);
  const tools = normalizeTools(report.ai_tools_replacing || []);
  const pivotRoles = (report.pivot_roles || []).slice(0, 3);
  const role = report.matched_job_family || report.role || 'Your Role';
  const skillAdjustments = report.score_breakdown?.skill_adjustments || [];
  const kgMatched = report.computation_method?.kg_skills_matched ?? skillAdjustments.length;
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  // USE SHARED CLASSIFIER — single source of truth
  const classified = classifySkills(report);
  const skillNodes: SkillNode[] = classified.map(c => ({
    name: c.name,
    risk: c.risk,
    type: c.status,
    threatenedBy: c.replacedBy ?? undefined,
    weight: c.weight,
  }));

  const safeNodes = skillNodes.filter(n => n.type === 'safe');
  const riskNodes = skillNodes.filter(n => n.type === 'at-risk');
  const autoNodes = skillNodes.filter(n => n.type === 'automated');

  // Peer percentile from engine — only use if actually provided by backend
  const percentile = report.peer_percentile_estimate ?? (report.survivability?.peer_percentile_estimate
    ? parseInt(report.survivability.peer_percentile_estimate.replace(/[^\d]/g, '')) || undefined
    : undefined);
  const hasRealPercentile = percentile != null;
  const percentileNum = typeof percentile === 'string' 
    ? parseInt((percentile as string).replace(/[^\d]/g, '')) || 50
    : (percentile as number) ?? 50;

  if (skillNodes.length === 0) return null;

  const getNodeStyle = (type: string) => {
    switch (type) {
      case 'safe': return { border: 'border-prophet-green/40', bg: 'bg-prophet-green/10', text: 'text-prophet-green', glow: 'shadow-prophet-green/20' };
      case 'at-risk': return { border: 'border-prophet-gold/40', bg: 'bg-prophet-gold/10', text: 'text-prophet-gold', glow: 'shadow-prophet-gold/20' };
      case 'automated': return { border: 'border-destructive/40', bg: 'bg-destructive/10', text: 'text-destructive', glow: 'shadow-destructive/20' };
      default: return { border: 'border-border', bg: 'bg-muted', text: 'text-foreground', glow: '' };
    }
  };

  return (
    <div className="space-y-5">
      {/* KG Header with provenance */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 22 }}
        className="rounded-2xl border-2 border-primary/20 bg-primary/[0.03] p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10">
            <Database className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-black text-foreground uppercase tracking-tight">Your Knowledge Graph Position</h3>
            <p className="text-[10px] text-muted-foreground">
              {kgMatched} skills matched against {tools.length} AI tools in our structured graph
            </p>
          </div>
        </div>

        {/* Interactive Graph Visualization */}
        <div className="relative py-4">
          {/* Central role node */}
          <div className="flex justify-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 15, delay: 0.1 }}
              className="relative z-10"
            >
              <div className="px-5 py-3 rounded-xl border-2 border-primary bg-primary/10 text-center shadow-lg shadow-primary/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">You</p>
                <p className="text-sm font-black text-primary">{role.split(' ').slice(0, 3).join(' ')}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{skillNodes.length} skills · {tools.length} threats</p>
              </div>
            </motion.div>
          </div>

          {/* Radiating Connections — 3 columns */}
          <div className="grid grid-cols-3 gap-2">
            {/* Safe Column */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 mb-2">
                <Shield className="w-3 h-3 text-prophet-green" />
                <span className="text-[10px] font-black uppercase tracking-widest text-prophet-green">
                  Human-Only ({safeNodes.length})
                </span>
              </div>
              {safeNodes.slice(0, 4).map((node, i) => {
                const style = getNodeStyle(node.type);
                const isExpanded = expandedNode === node.name;
                return (
                  <motion.button
                    key={node.name}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                    onClick={() => setExpandedNode(isExpanded ? null : node.name)}
                    className={`w-full px-2 py-2 rounded-lg border ${style.border} ${style.bg} text-left transition-all ${
                      isExpanded ? `shadow-md ${style.glow}` : ''
                    }`}
                  >
                    <p className={`text-[10px] font-bold truncate ${style.text}`}>{node.name}</p>
                    <p className="text-[10px] text-muted-foreground">{node.risk}% automatable</p>
                    {isExpanded && node.weight && (
                      <p className="text-[10px] text-muted-foreground mt-1 border-t border-border pt-1">
                        Weight: {(node.weight * 100).toFixed(0)}% of score
                      </p>
                    )}
                  </motion.button>
                );
              })}
              {safeNodes.length > 4 && (
                <p className="text-[10px] text-muted-foreground text-center">+{safeNodes.length - 4} more</p>
              )}
            </div>

            {/* At-Risk Column */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 mb-2">
                <AlertTriangle className="w-3 h-3 text-prophet-gold" />
                <span className="text-[10px] font-black uppercase tracking-widest text-prophet-gold">
                  At Risk ({riskNodes.length})
                </span>
              </div>
              {riskNodes.slice(0, 4).map((node, i) => {
                const style = getNodeStyle(node.type);
                const isExpanded = expandedNode === node.name;
                return (
                  <motion.button
                    key={node.name}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    onClick={() => setExpandedNode(isExpanded ? null : node.name)}
                    className={`w-full px-2 py-2 rounded-lg border ${style.border} ${style.bg} text-left transition-all ${
                      isExpanded ? `shadow-md ${style.glow}` : ''
                    }`}
                  >
                    <p className={`text-[10px] font-bold truncate ${style.text}`}>{node.name}</p>
                    <p className="text-[10px] text-muted-foreground">{node.risk}% automatable</p>
                    {isExpanded && (
                      <div className="text-[10px] text-muted-foreground mt-1 border-t border-border pt-1 space-y-0.5">
                        {node.threatenedBy && <p>→ {node.threatenedBy}</p>}
                        {node.weight && <p>Weight: {(node.weight * 100).toFixed(0)}%</p>}
                      </div>
                    )}
                  </motion.button>
                );
              })}
              {riskNodes.length > 4 && (
                <p className="text-[10px] text-muted-foreground text-center">+{riskNodes.length - 4} more</p>
              )}
            </div>

            {/* Automated Column */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 mb-2">
                <Zap className="w-3 h-3 text-destructive" />
                <span className="text-[10px] font-black uppercase tracking-widest text-destructive">
                  Automated ({autoNodes.length})
                </span>
              </div>
              {autoNodes.slice(0, 4).map((node, i) => {
                const style = getNodeStyle(node.type);
                const isExpanded = expandedNode === node.name;
                return (
                  <motion.button
                    key={node.name}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                    onClick={() => setExpandedNode(isExpanded ? null : node.name)}
                    className={`w-full px-2 py-2 rounded-lg border ${style.border} ${style.bg} text-left transition-all ${
                      isExpanded ? `shadow-md ${style.glow}` : ''
                    }`}
                  >
                    <p className={`text-[10px] font-bold truncate ${style.text}`}>{node.name}</p>
                    <p className="text-[10px] text-muted-foreground">{node.risk}% automatable</p>
                    {isExpanded && (
                      <div className="text-[10px] text-muted-foreground mt-1 border-t border-border pt-1 space-y-0.5">
                        {node.threatenedBy && <p>→ {node.threatenedBy}</p>}
                        {node.weight && <p>Weight: {(node.weight * 100).toFixed(0)}%</p>}
                      </div>
                    )}
                  </motion.button>
                );
              })}
              {autoNodes.length > 4 && (
                <p className="text-[10px] text-muted-foreground text-center">+{autoNodes.length - 4} more</p>
              )}
            </div>
          </div>
        </div>

        {/* AI Tools Threat Connections */}
        {tools.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-[11px] font-black uppercase tracking-widest text-destructive/60 mb-2">
              AI Tools Mapped to Your Skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tools.slice(0, 6).map((t, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.04 }}
                  className="text-[10px] font-semibold px-2 py-1 rounded-md bg-destructive/10 text-destructive border border-destructive/15"
                >
                  {t.tool_name}
                  <span className="ml-1 opacity-50 text-[10px]">· {t.adoption_stage}</span>
                </motion.span>
              ))}
            </div>
          </div>
        )}

        {/* Pivot Paths */}
        {pivotRoles.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[11px] font-black uppercase tracking-widest text-prophet-green/60 mb-2">
              Adjacent Safer Roles (Graph Distance ≤2)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {pivotRoles.map((p: any, i: number) => (
                <span key={i} className="text-[10px] font-semibold px-2 py-1 rounded-md bg-prophet-green/10 text-prophet-green border border-prophet-green/15 flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  {typeof p === 'string' ? p : p.role || p.label || p.title || 'N/A'}
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Peer Percentile — only show if real data exists */}
      {hasRealPercentile && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border-2 border-border bg-card p-5"
        >
          <div className="text-center mb-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Peer Comparison</p>
            <p className="text-4xl font-black text-foreground">
              {typeof percentile === 'string' ? percentile : `${Math.round(100 - percentileNum)}th`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              percentile among {report.industry || 'your industry'} professionals
            </p>
          </div>

          {/* Bell curve */}
          <div className="relative h-12 rounded-lg bg-muted overflow-hidden">
            <div className="absolute inset-0 flex items-end">
              {Array.from({ length: 20 }, (_, i) => {
                const x = (i + 0.5) / 20;
                const height = Math.exp(-0.5 * Math.pow((x - 0.5) / 0.18, 2)) * 100;
                const userBucket = Math.floor((100 - percentileNum) / 5);
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end px-[1px]">
                    <div
                      className={`rounded-t-sm transition-all ${i === userBucket ? 'bg-primary' : 'bg-muted-foreground/20'}`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-[10px] text-muted-foreground font-bold">
              <span>Stronger</span>
              <span>Weaker</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Data provenance badge */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center"
      >
        <p className="text-[11px] text-muted-foreground">
          📊 <span className="font-bold">Computed deterministically</span> · {kgMatched > 0 ? `${kgMatched} skills matched from KG` : 'Industry baseline'} ({report.computation_method?.numbers || '1,465-line engine'})
          {report.data_quality?.kg_coverage != null && report.data_quality.kg_coverage > 0 && (
            <span> · {report.data_quality.kg_coverage > 1 ? Math.min(100, Math.round(report.data_quality.kg_coverage)) : Math.round(report.data_quality.kg_coverage * 100)}% KG coverage</span>
          )}
        </p>
      </motion.div>
    </div>
  );
}

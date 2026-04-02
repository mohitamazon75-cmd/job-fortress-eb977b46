import { motion } from 'framer-motion';
import { Shield, AlertTriangle, Zap, TrendingUp, ChevronDown, ChevronUp, ArrowRight, Brain, BarChart3 } from 'lucide-react';
import { useState } from 'react';

interface SampleReportProps {
  onCTA: () => void;
}

const SAMPLE_SKILLS = [
  { name: 'Data Analysis', risk: 78, type: 'automated' as const, tool: 'Power BI Copilot' },
  { name: 'Excel Modeling', risk: 82, type: 'automated' as const, tool: 'Google Sheets AI' },
  { name: 'Client Presentations', risk: 22, type: 'safe' as const },
  { name: 'Stakeholder Management', risk: 12, type: 'safe' as const },
  { name: 'Market Research', risk: 65, type: 'at-risk' as const, tool: 'Perplexity AI' },
  { name: 'Financial Reporting', risk: 71, type: 'at-risk' as const, tool: 'Botkeeper' },
];

const WATERFALL = [
  { label: 'AI Resistance', pts: -18, color: 'destructive' },
  { label: 'Market Position', pts: +7, color: 'prophet-green' },
  { label: 'Human Edge', pts: +12, color: 'prophet-green' },
  { label: 'Income Stability', pts: -4, color: 'destructive' },
  { label: 'Seniority Shield', pts: +11, color: 'prophet-green' },
];

export default function SampleReport({ onCTA }: SampleReportProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.4 }}
      className="max-w-4xl mx-auto mt-12 sm:mt-16"
    >
      <div className="text-center mb-6">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">See What You'll Get</span>
        <h3 className="text-xl sm:text-2xl font-black text-foreground mt-1">Sample Analysis Report</h3>
        <p className="text-sm text-muted-foreground mt-1">Real output from our engine — anonymized for privacy</p>
      </div>

      <div className="rounded-2xl border-2 border-primary/20 bg-card overflow-hidden">
        {/* Profile header */}
        <div className="px-5 sm:px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sample Profile</p>
              <p className="text-base font-black text-foreground">Marketing Manager · 7 yrs · Mumbai</p>
              <p className="text-xs text-muted-foreground">FMCG Industry · Tier-1 Metro</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Career Position Score</p>
              <p className="text-3xl font-black text-prophet-gold">47<span className="text-lg text-muted-foreground">/100</span></p>
            </div>
          </div>
        </div>

        {/* Score decomposition waterfall */}
        <div className="px-5 sm:px-6 py-4 border-b border-border">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
            <BarChart3 className="w-3 h-3" />
            Score Decomposition
            <span className="text-[10px] font-medium text-primary ml-1">📊 Computed</span>
          </p>
          <div className="space-y-2">
            {WATERFALL.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.6 + i * 0.08 }}
                className="flex items-center gap-3"
              >
                <span className="text-xs font-semibold text-muted-foreground w-28 sm:w-32 text-right">{item.label}</span>
                <div className="flex-1 h-6 bg-muted/50 rounded-md overflow-hidden relative">
                  <motion.div
                    className={`h-full rounded-md ${item.pts > 0 ? 'bg-prophet-green/30' : 'bg-destructive/30'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(Math.abs(item.pts) * 4, 100)}%` }}
                    transition={{ delay: 1.8 + i * 0.1, duration: 0.5 }}
                  />
                  <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black ${item.pts > 0 ? 'text-prophet-green' : 'text-destructive'}`}>
                    {item.pts > 0 ? '+' : ''}{item.pts} pts
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Skill risk preview */}
        <div className="px-5 sm:px-6 py-4 border-b border-border">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
            <Brain className="w-3 h-3" />
            Skill Risk Breakdown (6 of 12 skills)
            <span className="text-[10px] font-medium text-primary ml-1">📊 Computed</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SAMPLE_SKILLS.map((skill, i) => (
              <motion.div
                key={skill.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.0 + i * 0.06 }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                  skill.type === 'safe' ? 'border-prophet-green/20 bg-prophet-green/5' :
                  skill.type === 'at-risk' ? 'border-prophet-gold/20 bg-prophet-gold/5' :
                  'border-destructive/20 bg-destructive/5'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {skill.type === 'safe' ? <Shield className="w-3.5 h-3.5 text-prophet-green flex-shrink-0" /> :
                   skill.type === 'at-risk' ? <AlertTriangle className="w-3.5 h-3.5 text-prophet-gold flex-shrink-0" /> :
                   <Zap className="w-3.5 h-3.5 text-destructive flex-shrink-0" />}
                  <span className="text-xs font-bold text-foreground truncate">{skill.name}</span>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className={`text-xs font-black ${
                    skill.type === 'safe' ? 'text-prophet-green' :
                    skill.type === 'at-risk' ? 'text-prophet-gold' : 'text-destructive'
                  }`}>{skill.risk}%</span>
                  {skill.tool && <p className="text-[10px] text-muted-foreground">→ {skill.tool}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Expandable dossier snippet */}
        <div className="px-5 sm:px-6 py-4 border-b border-border">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between text-left"
          >
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Brain className="w-3 h-3" />
              AI Intelligence Dossier Preview
              <span className="text-[10px] font-medium text-primary ml-1">🧠 AI-Assisted</span>
            </p>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3 text-sm text-muted-foreground leading-relaxed space-y-2"
            >
              <p>
                <span className="text-foreground font-semibold">Your core vulnerability:</span> 62% of your daily tasks involve data manipulation and report generation — areas where AI tools like Power BI Copilot and Sheets AI are achieving 85%+ accuracy.
              </p>
              <p>
                <span className="text-foreground font-semibold">Your hidden moat:</span> Client relationship management and cross-functional stakeholder alignment are skills that remain deeply human. Companies are <em>increasing</em> investment in these capabilities.
              </p>
              <p className="text-primary font-semibold text-xs">
                Full dossier includes: 90-day action plan, package upgrade paths, pivot role analysis, and 5 personalized side income strategies.
              </p>
            </motion.div>
          )}
        </div>

        {/* CTA */}
        <div className="px-5 sm:px-6 py-5 bg-muted/20">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCTA}
            className="w-full py-4 rounded-xl text-primary-foreground font-bold text-base flex items-center justify-center gap-3"
            style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-primary)' }}
          >
            Get Your Personalized Report
            <ArrowRight className="w-5 h-5" />
          </motion.button>
          <p className="text-center text-[10px] text-muted-foreground mt-2">
            Your analysis will be <span className="font-bold text-foreground">10x more detailed</span> with your actual LinkedIn or resume data
          </p>
        </div>
      </div>
    </motion.div>
  );
}

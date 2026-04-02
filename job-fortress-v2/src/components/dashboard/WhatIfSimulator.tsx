import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowDown, ArrowUp, Minus, Loader2, Database, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface WhatIfSimulatorProps {
  scanId: string;
}

interface SimResult {
  skill: string;
  skill_in_kg: boolean;
  skill_automation_risk: number | null;
  current_di: number;
  new_di: number;
  di_delta: number;
  current_survivability: number;
  new_survivability: number;
  survivability_delta: number;
  current_months: number;
  new_months: number;
  months_delta: number;
  insight: string;
}

export default function WhatIfSimulator({ scanId }: WhatIfSimulatorProps) {
  const [skill, setSkill] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateSkillInput = (input: string): string | null => {
    const trimmed = input.trim();
    if (trimmed.length < 2) return 'Please enter at least 2 characters';
    if (trimmed.length > 60) return 'Skill name is too long';
    const alphaCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
    if (alphaCount < 2) return 'Please enter a valid professional skill';
    // Basic client-side blocklist (server has comprehensive one)
    const blocked = ['sex', 'porn', 'fuck', 'shit', 'test', 'asdf', 'hello', 'lol', 'nothing', 'xxx'];
    const words = trimmed.toLowerCase().split(/[\s\-_.,]+/);
    if (words.some(w => blocked.includes(w))) return 'Please enter a professional or technical skill (e.g., "Machine Learning")';
    return null;
  };

  const handleSimulate = async () => {
    if (!skill.trim()) return;
    const validationError = validateSkillInput(skill);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('simulate-skill', {
        body: { scanId, newSkill: skill.trim() },
      });

      if (fnError) throw fnError;
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const DeltaIndicator = ({ value, label, suffix = '', inverse = false }: { value: number; label: string; suffix?: string; inverse?: boolean }) => {
    const isPositive = inverse ? value < 0 : value > 0;
    const isNeutral = Math.abs(value) < 0.5;
    const displayVal = Math.abs(value);

    return (
      <div className="text-center">
        <div className={`text-lg font-black ${isNeutral ? 'text-muted-foreground' : isPositive ? 'text-prophet-green' : 'text-prophet-red'}`}>
          {isNeutral ? (
            <Minus className="w-4 h-4 inline" />
          ) : isPositive ? (
            <ArrowUp className="w-4 h-4 inline" />
          ) : (
            <ArrowDown className="w-4 h-4 inline" />
          )}
          {' '}{displayVal}{suffix}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    );
  };

  const SUGGESTED_SKILLS = [
    'Prompt Engineering', 'AI Strategy', 'System Design',
    'Cloud Architecture', 'Data Engineering', 'Product Management'
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-primary/20 bg-primary/[0.02] p-5 mb-8"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-black text-primary uppercase tracking-[0.15em]">
          What If I Learn...
        </h3>
      </div>

      {/* Quick suggestions */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {SUGGESTED_SKILLS.map((s) => (
          <button
            key={s}
            onClick={() => { setSkill(s); setResult(null); }}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSimulate()}
          placeholder="e.g. Prompt Engineering, Kubernetes, AI Strategy..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleSimulate}
          disabled={loading || !skill.trim()}
          className="px-4 py-2 rounded-lg text-sm font-bold text-primary-foreground disabled:opacity-50 transition-colors"
          style={{ background: 'var(--gradient-primary)' }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simulate'}
        </button>
      </div>

      {error && (
        <p className="text-xs text-prophet-red">{error}</p>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-foreground">
              If you add <span className="text-primary">{result.skill}</span>:
            </p>
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
              result.skill_in_kg
                ? 'bg-prophet-green/10 text-prophet-green'
                : 'bg-accent text-muted-foreground'
            }`}>
              {result.skill_in_kg ? (
                <><Database className="w-3 h-3" /> In Knowledge Graph</>
              ) : (
                <><AlertTriangle className="w-3 h-3" /> Estimated (not in KG)</>
              )}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <DeltaIndicator value={result.di_delta} label="Career Risk" suffix="%" inverse />
            <DeltaIndicator value={result.months_delta} label="Months Added" suffix="mo" />
            <DeltaIndicator value={result.survivability_delta} label="Resilience" suffix="pt" />
          </div>

          <div className="grid grid-cols-3 gap-4 text-center border-t border-border pt-3">
            <p className="text-[10px] text-muted-foreground">Risk: {result.current_di}% → {result.new_di}%</p>
            <p className="text-[10px] text-muted-foreground">Window: {result.current_months}mo → {result.new_months}mo</p>
            <p className="text-[10px] text-muted-foreground">Score: {result.current_survivability} → {result.new_survivability}</p>
          </div>

          {/* Insight */}
          <div className="rounded-lg bg-accent/50 px-3 py-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">{result.insight}</p>
          </div>

          {result.skill_automation_risk !== null && (
            <p className="text-[10px] text-muted-foreground text-center">
              {result.skill}'s own automation risk: <span className={`font-bold ${result.skill_automation_risk > 50 ? 'text-prophet-red' : 'text-prophet-green'}`}>{result.skill_automation_risk}%</span>
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

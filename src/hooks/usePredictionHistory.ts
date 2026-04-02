// ═══════════════════════════════════════════════════════════════
// usePredictionHistory — IP #2: Prediction Calibration Loop (React hook)
// ═══════════════════════════════════════════════════════════════
// Loads the user's validated skill predictions and computes a
// simple "accuracy score" to show on the score trend card:
//   "Your last scan predicted your React risk would rise — it did. ✓"
//
// Usage:
//   const { predictions, accuracy, loading } = usePredictionHistory();
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SkillPrediction {
  id: string;
  skill_name: string;
  predicted_risk_score: number;
  actual_risk_score: number | null;
  error_pct: number | null;
  direction_correct: boolean | null;
  months_elapsed: number | null;
  predicted_at: string;
  validated: boolean;
}

export interface PredictionAccuracy {
  total_validated: number;
  direction_accuracy_pct: number; // % where we correctly predicted rising/falling
  mean_error_pct: number;          // mean absolute % error
  grade: 'A' | 'B' | 'C' | 'D';  // overall grade
  headline: string;                // ready-to-render text
}

interface UsePredictionHistoryResult {
  predictions: SkillPrediction[];
  accuracy: PredictionAccuracy | null;
  loading: boolean;
  error: string | null;
}

function computeAccuracy(validated: SkillPrediction[]): PredictionAccuracy | null {
  if (validated.length === 0) return null;

  const withError = validated.filter(
    (p) => p.error_pct != null && p.direction_correct != null
  );
  if (withError.length === 0) return null;

  const meanError = withError.reduce((s, p) => s + (p.error_pct ?? 0), 0) / withError.length;
  const dirAccuracy = (withError.filter((p) => p.direction_correct).length / withError.length) * 100;

  let grade: 'A' | 'B' | 'C' | 'D';
  if (dirAccuracy >= 80 && meanError < 15) grade = 'A';
  else if (dirAccuracy >= 65 && meanError < 25) grade = 'B';
  else if (dirAccuracy >= 50) grade = 'C';
  else grade = 'D';

  const headline =
    dirAccuracy >= 75
      ? `Our predictions were correct ${Math.round(dirAccuracy)}% of the time for your profile`
      : dirAccuracy >= 55
      ? `Our predictions had ${Math.round(dirAccuracy)}% directional accuracy for you`
      : `Your career moves have been hard to predict — your profile is evolving fast`;

  return {
    total_validated: withError.length,
    direction_accuracy_pct: Math.round(dirAccuracy),
    mean_error_pct: Math.round(meanError * 10) / 10,
    grade,
    headline,
  };
}

export function usePredictionHistory(): UsePredictionHistoryResult {
  const [predictions, setPredictions] = useState<SkillPrediction[]>([]);
  const [accuracy, setAccuracy] = useState<PredictionAccuracy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const { data, error: dbError } = await supabase
          .from('skill_predictions')
          .select('id, skill_name, predicted_risk_score, actual_risk_score, error_pct, direction_correct, months_elapsed, predicted_at, validated')
          .order('predicted_at', { ascending: false })
          .limit(50);

        if (!cancelled) {
          if (dbError) {
            setError(dbError.message);
          } else {
            const preds = (data ?? []) as SkillPrediction[];
            setPredictions(preds);
            const validated = preds.filter((p) => p.validated);
            setAccuracy(computeAccuracy(validated));
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Could not load prediction history');
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { predictions, accuracy, loading, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// emotionEngine.js — pure utility, no React, no side effects
// ─────────────────────────────────────────────────────────────────────────────

// ── Constants ─────────────────────────────────────────────────────────────────

export const WELLNESS_ZONES = {
  green:  { label: "Great",      emoji: "😊", color: "#22c55e", bg: "#f0fdf4", range: [80, 100] },
  blue:   { label: "Good",       emoji: "🙂", color: "#3b82f6", bg: "#eff6ff", range: [60, 79]  },
  yellow: { label: "Okay",       emoji: "😐", color: "#eab308", bg: "#fefce8", range: [45, 59]  },
  orange: { label: "Unsettled",  emoji: "😔", color: "#f97316", bg: "#fff7ed", range: [25, 44]  },
  red:    { label: "Struggling", emoji: "😰", color: "#ef4444", bg: "#fef2f2", range: [0, 24]   },
};

export const PARENT_EMOTION_LABELS = {
  happy:     { parentLabel: "Happy & energized",    tip: "Great day to try something new together!" },
  neutral:   { parentLabel: "Calm & steady",        tip: "A relaxed, focused mood — good for learning." },
  surprised: { parentLabel: "Surprised or excited", tip: "Check in — could be positive excitement or mild stress." },
  sad:       { parentLabel: "Feeling down",         tip: "Give them some extra warmth and a listening ear today." },
  fearful:   { parentLabel: "Anxious or worried",   tip: "Spend a quiet moment together. Ask open questions, not yes/no." },
  disgusted: { parentLabel: "Frustrated",           tip: "They may need a break. Avoid pressure tasks for now." },
  angry:     { parentLabel: "Very upset",           tip: "Give space first, then connection. Avoid asking \"what's wrong\" directly." },
};

/** Raw wellness score assigned to each emotion (used for weighted average) */
const EMOTION_SCORES = {
  happy:     95,
  neutral:   65,
  surprised: 52,
  disgusted: 30,
  sad:       25,
  fearful:   20,
  angry:     15,
};

// ── scoreToZone ───────────────────────────────────────────────────────────────

/**
 * Map a 0–100 wellness score to a zone key.
 * @param {number} score
 * @returns {"green"|"blue"|"yellow"|"orange"|"red"}
 */
export function scoreToZone(score) {
  for (const [key, zone] of Object.entries(WELLNESS_ZONES)) {
    if (score >= zone.range[0] && score <= zone.range[1]) return key;
  }
  return "yellow"; // safe fallback
}

// ── analyzeExpressions ────────────────────────────────────────────────────────

/**
 * Analyse a face-api.js expressions object and return a wellness result.
 *
 * @param {Record<string, number>} expressions
 *   e.g. { happy: 0.87, neutral: 0.08, sad: 0.02, ... }
 * @returns {{
 *   dominantEmotion: string,
 *   dominantConfidence: number,   // integer 0–100
 *   wellnessScore: number,        // integer 0–100
 *   wellnessZone: string,
 *   zoneInfo: object,
 *   isConcerning: boolean
 * }}
 */
export function analyzeExpressions(expressions) {
  if (!expressions || typeof expressions !== "object") {
    return {
      dominantEmotion: "neutral",
      dominantConfidence: 0,
      wellnessScore: 65,
      wellnessZone: "blue",
      zoneInfo: WELLNESS_ZONES.blue,
      isConcerning: false,
    };
  }

  // ── 1. Find dominant emotion ──────────────────────────────────────────────
  let dominantEmotion = "neutral";
  let dominantConfidence = 0;

  for (const [emotion, confidence] of Object.entries(expressions)) {
    if (confidence > dominantConfidence) {
      dominantConfidence = confidence;
      dominantEmotion = emotion;
    }
  }

  // ── 2. Weighted average score across all known emotions ───────────────────
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [emotion, confidence] of Object.entries(expressions)) {
    const score = EMOTION_SCORES[emotion];
    if (score === undefined || typeof confidence !== "number") continue;
    weightedSum += score * confidence;
    totalWeight += confidence;
  }

  let rawScore = totalWeight > 0 ? weightedSum / totalWeight : 65;

  // ── 3. Confidence blending — low-confidence result blends toward neutral ──
  const CONFIDENCE_THRESHOLD = 0.70;
  if (dominantConfidence < CONFIDENCE_THRESHOLD) {
    const blendFactor = dominantConfidence / CONFIDENCE_THRESHOLD;
    rawScore = rawScore * blendFactor + 65 * (1 - blendFactor);
  }

  // ── 4. Clamp and round ────────────────────────────────────────────────────
  const wellnessScore = Math.round(Math.min(100, Math.max(0, rawScore)));
  const wellnessZone  = scoreToZone(wellnessScore);
  const zoneInfo      = WELLNESS_ZONES[wellnessZone];

  // ── 5. Concerning flag ────────────────────────────────────────────────────
  const isConcerning =
    (wellnessZone === "orange" || wellnessZone === "red") &&
    dominantConfidence > 0.55;

  return {
    dominantEmotion,
    dominantConfidence: Math.round(dominantConfidence * 100),  // 0–100 int
    wellnessScore,
    wellnessZone,
    zoneInfo,
    isConcerning,
  };
}

// ── detectAlertPattern ────────────────────────────────────────────────────────

/**
 * Evaluate recent scans for alert-worthy patterns.
 *
 * @param {Array<{ wellness_zone: string, wellness_score: number }>} recentScans
 *   Ordered newest-first.
 * @param {number} threshold   Number of consecutive bad scans that trigger an alert (default 2).
 * @returns {{ shouldAlert: boolean, alertType: string|null, zone: string|null, message: string|null }}
 */
export function detectAlertPattern(recentScans, threshold = 2) {
  const NO_ALERT = { shouldAlert: false, alertType: null, zone: null, message: null };

  if (!recentScans || recentScans.length === 0) return NO_ALERT;

  const concerning = new Set(["orange", "red"]);

  // ── Check B: most recent scan is red ─────────────────────────────────────
  const latest = recentScans[0];
  if (latest.wellness_zone === "red") {
    return {
      shouldAlert: true,
      alertType:   "single_scan",
      zone:        "red",
      message:     "Your child's latest check-in shows a very low wellness score. Consider checking in with them today.",
    };
  }

  // ── Check A: last `threshold` scans all orange or red ────────────────────
  if (recentScans.length >= threshold) {
    const lastN = recentScans.slice(0, threshold);
    if (lastN.every((s) => concerning.has(s.wellness_zone))) {
      return {
        shouldAlert: true,
        alertType:   "consecutive_pattern",
        zone:        latest.wellness_zone,
        message:     `Your child has had ${threshold} consecutive low-mood check-ins. This pattern may be worth a gentle conversation.`,
      };
    }
  }

  // ── Check C: weekly decline (6+ scans, first half avg vs second half avg) ─
  if (recentScans.length >= 6) {
    const half       = Math.floor(recentScans.length / 2);
    const recentHalf = recentScans.slice(0, half);       // newest
    const olderHalf  = recentScans.slice(half);          // oldest

    const avg = (arr) => arr.reduce((s, x) => s + (x.wellness_score ?? 0), 0) / arr.length;

    const recentAvg = avg(recentHalf);
    const olderAvg  = avg(olderHalf);

    if (olderAvg - recentAvg > 20) {
      return {
        shouldAlert: true,
        alertType:   "weekly_decline",
        zone:        latest.wellness_zone,
        message:     "Your child's wellness scores have been trending downward over the past week. A check-in with their teacher or counsellor may help.",
      };
    }
  }

  return NO_ALERT;
}

// ── getParentMessage ──────────────────────────────────────────────────────────

/**
 * Return a parent-friendly headline and tip for the scan result screen.
 *
 * @param {string} dominantEmotion
 * @param {string} zone             wellness zone key
 * @param {string} [childName]      optional child's first name for personalisation
 * @returns {{ headline: string, tip: string }}
 */
export function getParentMessage(dominantEmotion, zone, childName = "") {
  const emotionMeta = PARENT_EMOTION_LABELS[dominantEmotion] ?? PARENT_EMOTION_LABELS.neutral;
  const zoneMeta    = WELLNESS_ZONES[zone]                   ?? WELLNESS_ZONES.blue;
  const name        = childName ? childName.split(" ")[0] : "Your child";

  const positiveZones = new Set(["green", "blue"]);

  let headline;
  if (positiveZones.has(zone)) {
    headline = `${name} seems ${emotionMeta.parentLabel.toLowerCase()} today! ${zoneMeta.emoji}`;
  } else if (zone === "yellow") {
    headline = `${name} looks ${emotionMeta.parentLabel.toLowerCase()} right now ${zoneMeta.emoji}`;
  } else {
    headline = `Looks like today might be tough for ${name} ${zoneMeta.emoji}`;
  }

  return {
    headline,
    tip: emotionMeta.tip,
  };
}

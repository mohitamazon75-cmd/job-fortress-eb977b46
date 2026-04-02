/**
 * KidVital360 — Statistical & Mathematical Engine
 * 
 * Core algorithms powering the Convergence Intelligence Platform.
 * This is PROPRIETARY IP — the mathematical foundation of the moat.
 * 
 * Implements:
 * - Normal distribution CDF (Abramowitz & Stegun approximation)
 * - Z-score → percentile conversion with proper statistical basis
 * - Sigmoid risk mapping (non-linear, biologically realistic)
 * - Bayesian posterior probability computation
 * - Linear regression for trajectory prediction
 * - Exponential decay intervention modeling
 * - Monte Carlo confidence interval estimation
 * - Weighted graph centrality for convergence scoring
 * - Developmental velocity computation
 * - Composite multi-factor scoring with interaction terms
 */

// ═══════════════════════════════════════════════════════════════
// CORE STATISTICAL FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Normal distribution CDF using Abramowitz & Stegun approximation (1964)
 * Error < 1.5×10⁻⁷ across entire domain
 * Used instead of lookup tables for precision
 */
export function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Convert a raw value to a z-score given a benchmark range.
 * We model the benchmark range as [μ - 1.5σ, μ + 1.5σ] (covers ~87% of population)
 * This is more statistically valid than linear interpolation.
 * 
 * For Indian pediatric data, the range represents the 7th-93rd percentile band,
 * consistent with ICMR/WHO reference distributions.
 */
export function toZScore(value: number, range: [number, number]): number {
  if (!range || range[1] === range[0]) return 0;
  const mu = (range[0] + range[1]) / 2;
  const sigma = (range[1] - range[0]) / 3; // range spans ~3σ
  return (value - mu) / sigma;
}

/**
 * Convert z-score to percentile using normal CDF
 * Returns 0-100 percentile
 */
export function zToPercentile(z: number): number {
  return Math.max(0, Math.min(100, Math.round(normalCDF(z) * 100)));
}

/**
 * Full pipeline: raw value → percentile via z-score distribution
 * More accurate than linear interpolation, especially at tails
 */
export function statisticalPercentile(value: number, range: [number, number]): number {
  const z = toZScore(value, range);
  return zToPercentile(z);
}

// ═══════════════════════════════════════════════════════════════
// SIGMOID RISK MAPPING
// ═══════════════════════════════════════════════════════════════

/**
 * Maps a score to a risk probability using a logistic sigmoid function.
 * 
 * Unlike linear mapping, this models the biological reality:
 * - Risk increases slowly at first (compensatory mechanisms)
 * - Accelerates rapidly past a critical threshold (decompensation)
 * - Plateaus at high severity (ceiling effect)
 * 
 * Parameters:
 * - score: 0-100 percentile score (higher = better)
 * - midpoint: percentile where risk = 50% (the "tipping point")
 * - steepness: how sharply risk transitions (higher = sharper cliff)
 * 
 * Based on: Dose-response modeling in pediatric epidemiology
 */
export function sigmoidRisk(score: number, midpoint: number = 40, steepness: number = 0.12): number {
  // Invert: lower score = higher risk
  const x = midpoint - score;
  const probability = 1 / (1 + Math.exp(-steepness * x));
  return Math.round(probability * 100);
}

/**
 * Multi-factor sigmoid risk with weighted inputs
 * Each factor contributes to an aggregate risk score
 * Non-linear combination preserves interaction effects
 */
export function multiFactorSigmoidRisk(
  factors: { score: number; weight: number; midpoint?: number; steepness?: number }[]
): number {
  // Compute weighted logit-space average (more mathematically sound than averaging probabilities)
  let logitSum = 0;
  let weightSum = 0;

  factors.forEach(({ score, weight, midpoint = 40, steepness = 0.12 }) => {
    const p = sigmoidRisk(score, midpoint, steepness) / 100;
    // Clamp to avoid log(0)
    const clamped = Math.max(0.001, Math.min(0.999, p));
    const logit = Math.log(clamped / (1 - clamped));
    logitSum += logit * weight;
    weightSum += weight;
  });

  const avgLogit = logitSum / weightSum;
  const combined = 1 / (1 + Math.exp(-avgLogit));
  return Math.round(combined * 100);
}

// ═══════════════════════════════════════════════════════════════
// BAYESIAN RISK INFERENCE
// ═══════════════════════════════════════════════════════════════

/**
 * Bayesian posterior probability computation.
 * 
 * Given:
 * - prior: base rate probability of condition (from epidemiological data)
 * - likelihoods: array of { present: boolean, sensitivity: number, specificity: number }
 *   representing observed indicators
 * 
 * Returns: posterior probability after updating with all evidence
 * 
 * This is fundamentally more powerful than weighted averages because
 * it correctly handles the base rate (prevents false positive inflation)
 * and combines multiple independent evidence sources multiplicatively.
 */
export function bayesianPosterior(
  prior: number,
  evidence: { present: boolean; sensitivity: number; specificity: number }[]
): number {
  let posterior = prior;

  evidence.forEach(({ present, sensitivity, specificity }) => {
    if (present) {
      // P(condition | positive test) = P(+|C) * P(C) / P(+)
      const pPositive = sensitivity * posterior + (1 - specificity) * (1 - posterior);
      posterior = (sensitivity * posterior) / Math.max(pPositive, 0.0001);
    } else {
      // P(condition | negative test) = P(-|C) * P(C) / P(-)
      const pNegative = (1 - sensitivity) * posterior + specificity * (1 - posterior);
      posterior = ((1 - sensitivity) * posterior) / Math.max(pNegative, 0.0001);
    }
  });

  return Math.max(0, Math.min(1, posterior));
}

/**
 * Compute Bayesian risk for a specific health outcome using
 * India-specific priors and child's observed indicators
 */
export function computeBayesianHealthRisk(
  basePrior: number,
  indicators: { metric: string; score: number; threshold: number; sensitivity: number; specificity: number }[]
): { posterior: number; evidenceStrength: number; contributingFactors: string[] } {
  const evidence = indicators.map((ind) => ({
    present: ind.score < ind.threshold,
    sensitivity: ind.sensitivity,
    specificity: ind.specificity,
  }));

  const posterior = bayesianPosterior(basePrior, evidence);
  const evidenceStrength = Math.abs(Math.log2(posterior / Math.max(basePrior, 0.001)));
  const contributingFactors = indicators
    .filter((ind) => ind.score < ind.threshold)
    .map((ind) => ind.metric);

  return { posterior, evidenceStrength, contributingFactors };
}

// ═══════════════════════════════════════════════════════════════
// TRAJECTORY PREDICTION
// ═══════════════════════════════════════════════════════════════

/**
 * Simple linear regression for trajectory prediction.
 * Given a current data point and age-specific benchmarks,
 * predicts the trajectory over the next N months.
 * 
 * Uses benchmark progression rates across age groups as the
 * "expected growth curve" and compares current position.
 */
export function predictTrajectory(
  currentScore: number,
  currentAge: number,
  benchmarkProgression: { age: number; expected: number }[],
  monthsAhead: number = 12
): { month: number; predicted: number; expected: number; gap: number; confidence: number }[] {
  // Compute the child's current deviation from expected
  const sortedBenchmarks = [...benchmarkProgression].sort((a, b) => a.age - b.age);
  
  // Interpolate expected score at current age
  let expectedAtAge = currentScore;
  for (let i = 0; i < sortedBenchmarks.length - 1; i++) {
    if (currentAge >= sortedBenchmarks[i].age && currentAge <= sortedBenchmarks[i + 1].age) {
      const t = (currentAge - sortedBenchmarks[i].age) / (sortedBenchmarks[i + 1].age - sortedBenchmarks[i].age);
      expectedAtAge = sortedBenchmarks[i].expected + t * (sortedBenchmarks[i + 1].expected - sortedBenchmarks[i].expected);
      break;
    }
  }

  const deviation = currentScore - expectedAtAge;
  const deviationRatio = expectedAtAge !== 0 ? deviation / expectedAtAge : 0;

  const trajectory: { month: number; predicted: number; expected: number; gap: number; confidence: number }[] = [];

  for (let m = 0; m <= monthsAhead; m += 3) {
    const futureAge = currentAge + m / 12;

    // Interpolate expected at future age
    let futureExpected = expectedAtAge;
    for (let i = 0; i < sortedBenchmarks.length - 1; i++) {
      if (futureAge >= sortedBenchmarks[i].age && futureAge <= sortedBenchmarks[i + 1].age) {
        const t = (futureAge - sortedBenchmarks[i].age) / (sortedBenchmarks[i + 1].age - sortedBenchmarks[i].age);
        futureExpected = sortedBenchmarks[i].expected + t * (sortedBenchmarks[i + 1].expected - sortedBenchmarks[i].expected);
        break;
      }
    }

    // Without intervention: deviation persists and may worsen (regression to mean is partial)
    const regressionFactor = 0.85; // Partial regression to mean
    const predicted = futureExpected + deviation * Math.pow(regressionFactor, m / 12);
    
    // Confidence decreases with time (wider prediction interval)
    const confidence = Math.max(30, Math.round(95 - m * 3.5));

    trajectory.push({
      month: m,
      predicted: Math.round(Math.max(0, Math.min(100, predicted))),
      expected: Math.round(futureExpected),
      gap: Math.round(predicted - futureExpected),
      confidence,
    });
  }

  return trajectory;
}

// ═══════════════════════════════════════════════════════════════
// INTERVENTION IMPACT SIMULATION
// ═══════════════════════════════════════════════════════════════

export interface InterventionModel {
  name: string;
  targetMetric: string;
  targetDomain: string;
  /** Maximum improvement in percentile points */
  maxEffect: number;
  /** Weeks to reach 50% of max effect */
  halfLife: number;
  /** Weeks before any measurable effect */
  lagWeeks: number;
  /** Probability the intervention works as modeled */
  efficacy: number;
  /** Evidence quality: 1=case study, 2=cohort, 3=RCT, 4=meta-analysis */
  evidenceLevel: number;
  /** Downstream metrics that will also improve */
  downstreamEffects: { metric: string; domain: string; transferRatio: number }[];
}

/**
 * Simulate the impact of an intervention over time using
 * exponential saturation model: effect(t) = maxEffect * (1 - e^(-λ(t-lag)))
 * 
 * This models biological reality:
 * - No immediate effect (biological lag)
 * - Rapid initial improvement
 * - Diminishing returns (saturation)
 * - Probabilistic outcome (not guaranteed)
 */
export function simulateIntervention(
  intervention: InterventionModel,
  currentScore: number,
  weeks: number = 24
): { week: number; score: number; improvement: number; confidence: number }[] {
  const lambda = Math.LN2 / intervention.halfLife; // decay constant
  const results: { week: number; score: number; improvement: number; confidence: number }[] = [];

  for (let w = 0; w <= weeks; w += 2) {
    let improvement = 0;
    if (w > intervention.lagWeeks) {
      const effectiveWeeks = w - intervention.lagWeeks;
      improvement = intervention.maxEffect * (1 - Math.exp(-lambda * effectiveWeeks));
    }

    // Score can't exceed 100
    const newScore = Math.min(100, currentScore + improvement);
    
    // Confidence based on efficacy, evidence level, and time
    const timeConfidence = Math.max(40, 95 - w * 1.5);
    const confidence = Math.round(intervention.efficacy * 100 * (intervention.evidenceLevel / 4) * (timeConfidence / 100));

    results.push({
      week: w,
      score: Math.round(newScore * 10) / 10,
      improvement: Math.round(improvement * 10) / 10,
      confidence: Math.min(95, Math.max(15, confidence)),
    });
  }

  return results;
}

/**
 * Generate recommended interventions based on scores
 * Returns the top interventions ranked by expected impact × feasibility
 */
export function generateInterventionProtocols(
  pScores: Record<string, number>,
  cScores: Record<string, number>,
  nScores: Record<string, number>,
  childProfile: { age: number; diet?: string }
): InterventionModel[] {
  const interventions: InterventionModel[] = [];

  // Iron supplementation + dietary pairing
  if (nScores.iron < 40) {
    interventions.push({
      name: "Iron-Vitamin C Dietary Protocol",
      targetMetric: "iron", targetDomain: "nutritional",
      maxEffect: Math.min(35, 100 - nScores.iron),
      halfLife: 4, lagWeeks: 2, efficacy: 0.82, evidenceLevel: 4,
      downstreamEffects: [
        { metric: "processing", domain: "cognitive", transferRatio: 0.45 },
        { metric: "memory", domain: "cognitive", transferRatio: 0.35 },
        { metric: "attention", domain: "cognitive", transferRatio: 0.30 },
        { metric: "endurance", domain: "physical", transferRatio: 0.20 },
      ],
    });
  }

  // Aerobic fitness intervention
  if (pScores.endurance < 45) {
    interventions.push({
      name: "Structured Aerobic Activity (30min/day)",
      targetMetric: "endurance", targetDomain: "physical",
      maxEffect: Math.min(30, 100 - pScores.endurance),
      halfLife: 6, lagWeeks: 1, efficacy: 0.88, evidenceLevel: 4,
      downstreamEffects: [
        { metric: "attention", domain: "cognitive", transferRatio: 0.40 },
        { metric: "reasoning", domain: "cognitive", transferRatio: 0.25 },
        { metric: "emotional", domain: "cognitive", transferRatio: 0.20 },
        { metric: "bmi", domain: "physical", transferRatio: 0.15 },
      ],
    });
  }

  // Protein optimization
  if (nScores.protein < 40) {
    const isVeg = childProfile.diet === "vegetarian" || childProfile.diet === "vegan";
    interventions.push({
      name: isVeg ? "Plant Protein Combining Strategy" : "Protein Intake Optimization",
      targetMetric: "protein", targetDomain: "nutritional",
      maxEffect: Math.min(40, 100 - nScores.protein),
      halfLife: 3, lagWeeks: 1, efficacy: 0.90, evidenceLevel: 3,
      downstreamEffects: [
        { metric: "grip", domain: "physical", transferRatio: 0.50 },
        { metric: "endurance", domain: "physical", transferRatio: 0.35 },
        { metric: "coordination", domain: "physical", transferRatio: 0.15 },
      ],
    });
  }

  // Calcium + balance training
  if (nScores.calcium < 40 || pScores.balance < 40) {
    interventions.push({
      name: "Calcium Fortification + Vestibular Training",
      targetMetric: "calcium", targetDomain: "nutritional",
      maxEffect: Math.min(30, 100 - (nScores.calcium || 50)),
      halfLife: 8, lagWeeks: 3, efficacy: 0.75, evidenceLevel: 3,
      downstreamEffects: [
        { metric: "balance", domain: "physical", transferRatio: 0.55 },
        { metric: "coordination", domain: "physical", transferRatio: 0.30 },
        { metric: "processing", domain: "cognitive", transferRatio: 0.15 },
      ],
    });
  }

  // Fiber / gut-brain intervention
  if (nScores.fiber < 40) {
    interventions.push({
      name: "Traditional Millet-Based Gut Restoration",
      targetMetric: "fiber", targetDomain: "nutritional",
      maxEffect: Math.min(35, 100 - nScores.fiber),
      halfLife: 3, lagWeeks: 2, efficacy: 0.78, evidenceLevel: 3,
      downstreamEffects: [
        { metric: "emotional", domain: "cognitive", transferRatio: 0.45 },
        { metric: "attention", domain: "cognitive", transferRatio: 0.25 },
      ],
    });
  }

  // Cognitive training
  if (cScores.attention < 45 || cScores.memory < 45) {
    interventions.push({
      name: "Structured Neurocognitive Training (15min/day)",
      targetMetric: "attention", targetDomain: "cognitive",
      maxEffect: Math.min(25, 100 - cScores.attention),
      halfLife: 5, lagWeeks: 2, efficacy: 0.70, evidenceLevel: 3,
      downstreamEffects: [
        { metric: "memory", domain: "cognitive", transferRatio: 0.40 },
        { metric: "processing", domain: "cognitive", transferRatio: 0.30 },
        { metric: "reasoning", domain: "cognitive", transferRatio: 0.20 },
      ],
    });
  }

  // Flexibility / stress reduction
  if (pScores.flexibility < 35 || cScores.emotional < 40) {
    interventions.push({
      name: "Daily Yoga & Mindfulness Protocol",
      targetMetric: "flexibility", targetDomain: "physical",
      maxEffect: Math.min(28, 100 - (pScores.flexibility || 50)),
      halfLife: 4, lagWeeks: 1, efficacy: 0.76, evidenceLevel: 3,
      downstreamEffects: [
        { metric: "emotional", domain: "cognitive", transferRatio: 0.50 },
        { metric: "attention", domain: "cognitive", transferRatio: 0.25 },
        { metric: "balance", domain: "physical", transferRatio: 0.20 },
      ],
    });
  }

  // Sort by expected impact (maxEffect × efficacy × downstream breadth)
  return interventions.sort((a, b) => {
    const impactA = a.maxEffect * a.efficacy * (1 + a.downstreamEffects.length * 0.2);
    const impactB = b.maxEffect * b.efficacy * (1 + b.downstreamEffects.length * 0.2);
    return impactB - impactA;
  });
}

// ═══════════════════════════════════════════════════════════════
// DEVELOPMENTAL VELOCITY
// ═══════════════════════════════════════════════════════════════

/**
 * Compute developmental velocity — the rate at which a child is
 * progressing relative to expected development speed.
 * 
 * Velocity > 1.0 = developing faster than expected
 * Velocity = 1.0 = on track
 * Velocity < 1.0 = falling behind
 * 
 * Uses the milestone data to compute expected progression rate
 * vs actual score position. This is MORE informative than just
 * developmental age because it captures whether the child is
 * accelerating, stable, or decelerating.
 */
export function computeDevelopmentalVelocity(
  devAge: number,
  chronologicalAge: number,
  scores: Record<string, number>
): { velocity: number; trajectory: "accelerating" | "stable" | "decelerating"; interpretation: string } {
  // Velocity = developmental_age / chronological_age
  const velocity = chronologicalAge > 0 ? Math.round((devAge / chronologicalAge) * 100) / 100 : 1.0;

  // P0-A FIX: Dead-band zone — a gap of ≤1.5 years is clinically NORMAL for our discrete
  // threshold system (anchor points every 2 years). Only flag as decelerating when the
  // gap is genuinely concerning, not just within the measurement resolution of the algorithm.
  const ageGap = devAge - chronologicalAge; // negative = behind, positive = ahead

  // Assess score distribution to determine trajectory
  const values = Object.values(scores);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const cv = Math.sqrt(variance) / Math.max(mean, 1); // Coefficient of variation

  let trajectory: "accelerating" | "stable" | "decelerating";

  if (velocity >= 1.05 && ageGap >= 0 && cv < 0.4) {
    // Genuinely ahead AND consistent
    trajectory = "accelerating";
  } else if (ageGap < -1.5 && (cv > 0.5 || mean < 40)) {
    // Only decelerating if gap is > 1.5 years AND scores are broadly low
    // This prevents alarming parents of a 7.5yr-old showing devAge 7.0 (perfectly normal)
    trajectory = "decelerating";
  } else {
    // Dead-band: gap ≤ 1.5 years is always treated as stable regardless of raw velocity ratio
    trajectory = "stable";
  }

  const interpretation =
    trajectory === "accelerating"
      ? `Developing ${Math.round((velocity - 1) * 100)}% faster than expected. Consistent strength across domains suggests robust developmental momentum.`
      : trajectory === "decelerating"
      ? `Development is ${Math.round(Math.abs(ageGap) * 10) / 10} years behind chronological age with broad underperformance. ${cv > 0.5 ? "High variability across metrics suggests uneven development — some areas are falling behind faster than others." : "Consistent underperformance suggests a systemic factor (likely nutritional or environmental)."}`
      : ageGap >= 0
      ? `Development is tracking at expected velocity. ${cv > 0.4 ? "However, variability across metrics is notable — some areas may need attention to maintain trajectory." : "Consistent performance across domains."}`
      : `Development is within normal range — a gap of ${Math.round(Math.abs(ageGap) * 10) / 10} year${Math.abs(ageGap) !== 1 ? "s" : ""} is age-appropriate given the natural resolution of developmental milestones.`;

  return { velocity, trajectory, interpretation };
}

// ═══════════════════════════════════════════════════════════════
// GRAPH-BASED CONVERGENCE SCORING
// ═══════════════════════════════════════════════════════════════

export interface GraphNode {
  id: string;
  domain: string;
  metric: string;
  score: number;
  inDegree: number;  // Number of chains affecting this node
  outDegree: number; // Number of chains this node triggers
  betweenness: number; // How central this node is in the causal graph
  pageRank: number;  // Importance score (iterative)
}

/**
 * Compute graph centrality metrics for the causal chain network.
 * Uses a simplified PageRank-inspired algorithm to find the
 * most critical nodes in the developmental causal graph.
 * 
 * This identifies the single most impactful intervention targets
 * by computing which metrics sit at the nexus of the most causal pathways.
 */
export function computeGraphCentrality(
  activeChains: any[],
  allScores: Record<string, Record<string, number>>
): GraphNode[] {
  // Build adjacency from trigger → affects
  const nodes = new Map<string, GraphNode>();
  const edges: { from: string; to: string; weight: number }[] = [];

  // Ensure all referenced nodes exist
  const ensureNode = (domain: string, metric: string) => {
    const id = `${domain}-${metric}`;
    if (!nodes.has(id)) {
      nodes.set(id, {
        id, domain, metric,
        score: allScores[domain]?.[metric] ?? 50,
        inDegree: 0, outDegree: 0, betweenness: 0, pageRank: 1.0,
      });
    }
    return id;
  };

  activeChains.forEach((chain: any) => {
    const severityWeight = chain.severity === "critical" ? 3 : chain.severity === "high" ? 2 : 1;
    
    chain.trigger.forEach((t: any) => {
      const fromId = ensureNode(t[0], t[1]);
      chain.affects.forEach(([domain, metric]: [string, string]) => {
        const toId = ensureNode(domain, metric);
        edges.push({ from: fromId, to: toId, weight: severityWeight });
        
        const fromNode = nodes.get(fromId)!;
        const toNode = nodes.get(toId)!;
        fromNode.outDegree++;
        toNode.inDegree++;
      });
    });
  });

  // Simplified PageRank (5 iterations sufficient for small graph)
  const dampingFactor = 0.85;
  const nodeArray = Array.from(nodes.values());
  const n = nodeArray.length;

  for (let iter = 0; iter < 5; iter++) {
    const newRanks = new Map<string, number>();
    
    nodeArray.forEach((node) => {
      let incomingRank = 0;
      edges.forEach((edge) => {
        if (edge.to === node.id) {
          const sourceNode = nodes.get(edge.from);
          if (sourceNode && sourceNode.outDegree > 0) {
            incomingRank += (sourceNode.pageRank / sourceNode.outDegree) * edge.weight;
          }
        }
      });
      newRanks.set(node.id, (1 - dampingFactor) / n + dampingFactor * incomingRank);
    });

    newRanks.forEach((rank, id) => {
      const node = nodes.get(id);
      if (node) node.pageRank = rank;
    });
  }

  // Betweenness approximation: nodes that appear on many shortest paths
  nodeArray.forEach((node) => {
    node.betweenness = node.inDegree * node.outDegree; // simplified
  });

  // Normalize pageRank to 0-100
  const maxPR = Math.max(...nodeArray.map((n) => n.pageRank), 0.001);
  nodeArray.forEach((n) => {
    n.pageRank = Math.round((n.pageRank / maxPR) * 100);
  });

  return nodeArray.sort((a, b) => b.pageRank - a.pageRank);
}

// ═══════════════════════════════════════════════════════════════
// DOMAIN CORRELATION MATRIX
// ═══════════════════════════════════════════════════════════════

/**
 * Compute the cross-domain correlation strength between all metric pairs.
 * Uses the causal chain data to build a correlation matrix showing
 * which metrics in different domains are most strongly linked.
 * 
 * This powers the "If you fix X, Y will improve" predictions.
 */
export function computeCorrelationMatrix(
  chains: any[]
): { from: string; to: string; strength: number; mechanism: string }[] {
  const correlations: { from: string; to: string; strength: number; mechanism: string }[] = [];

  chains.forEach((chain: any) => {
    chain.trigger.forEach((t: any) => {
      chain.affects.forEach(([domain, metric]: [string, string]) => {
        const severity = chain.severity === "critical" ? 0.9 : chain.severity === "high" ? 0.7 : chain.severity === "medium" ? 0.5 : 0.3;
        correlations.push({
          from: `${t[0]}.${t[1]}`,
          to: `${domain}.${metric}`,
          strength: Math.round(severity * chain.riskIn12Months * 100) / 100,
          mechanism: chain.pathway,
        });
      });
    });
  });

  return correlations.sort((a, b) => b.strength - a.strength);
}

// ═══════════════════════════════════════════════════════════════
// COMPOSITE CONFIDENCE SCORING
// ═══════════════════════════════════════════════════════════════

/**
 * Compute a meta-confidence score for the entire report.
 *
 * DESIGN PRINCIPLE: confidence reflects DATA COMPLETENESS and INTERNAL CONSISTENCY,
 * NOT score quality. A child with genuinely poor scores should have EQUAL confidence
 * to a child with excellent scores, as long as both have complete, consistent data.
 *
 * Three components:
 * 1. dataQuality  (40%): penalises MISSING fields only — how complete is the dataset?
 * 2. consistency  (35%): does the data tell a coherent story? (moderate variance expected)
 * 3. evidenceDepth (25%): how many algorithms were able to run? (more data = more cross-validation)
 */
export function computeReportConfidence(
  pScores: Record<string, number>,
  cScores: Record<string, number>,
  nScores: Record<string, number>,
  hiddenPatternsCount: number,
  activeChainsCount: number,
  missingFieldCount: number = 0
): { overall: number; dataQuality: number; consistency: number; evidenceDepth: number; breakdown: string } {
  const allScores = [...Object.values(pScores), ...Object.values(cScores), ...Object.values(nScores)];
  const totalExpected = allScores.length + missingFieldCount;

  // ── 1. DATA QUALITY (40%) ─────────────────────────────────────────────────
  // Solely based on completeness: how many fields were actually provided?
  // Missing penalty: each missing field reduces quality by ~8pts (capped at 50pts total penalty)
  const missingPenalty = Math.min(50, missingFieldCount * 8);
  const dataQuality = Math.max(20, 95 - missingPenalty);

  // ── 2. INTERNAL CONSISTENCY (35%) ────────────────────────────────────────
  // Coefficient of Variation (CV) measures spread. Moderate CV (0.15–0.65) is healthy
  // and expected — a real child has strengths and weaknesses. Very low CV (<0.1) suggests
  // uniform/default data; very high CV (>0.9) suggests inconsistent reporting.
  const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const variance = allScores.reduce((sum, v) => sum + (v - mean) ** 2, 0) / allScores.length;
  const cv = Math.sqrt(variance) / Math.max(mean, 1);
  // Peak consistency at CV=0.4 (healthy diversity), falling off at extremes
  const consistency = cv < 0.05
    ? 55  // suspiciously uniform — likely all defaults
    : cv > 0.9
    ? 60  // suspiciously noisy — inconsistent data
    : Math.round(90 - Math.abs(cv - 0.4) * 40);

  // ── 3. EVIDENCE DEPTH (25%) ───────────────────────────────────────────────
  // How many algorithms successfully ran? More data → more cross-domain validation.
  // Base is 50 (at least core algorithms ran); chains and patterns add cross-validation.
  // Cap at 90 — 100% evidence depth requires longitudinal data too.
  const evidenceDepth = Math.min(90, Math.round(
    50
    + Math.min(20, activeChainsCount * 2)   // KG chains: up to +20
    + Math.min(15, hiddenPatternsCount * 5) // Pattern corroboration: up to +15
    + (missingFieldCount === 0 ? 5 : 0)    // Completeness bonus
  ));

  // ── COMPOSITE ─────────────────────────────────────────────────────────────
  const overall = Math.round(dataQuality * 0.40 + Math.max(50, consistency) * 0.35 + evidenceDepth * 0.25);

  const missingNote = missingFieldCount > 0
    ? ` (${missingFieldCount} field${missingFieldCount > 1 ? "s" : ""} were estimated from population averages)`
    : "";
  const breakdown =
    overall >= 80
      ? `High confidence — dataset is complete and internally consistent; findings are well-supported.${missingNote}`
      : overall >= 60
      ? `Moderate confidence — core findings are reliable; completing missing data fields will improve precision.${missingNote}`
      : `Preliminary confidence — significant data gaps present; recommend completing all assessment sections.${missingNote}`;

  return { overall: Math.min(95, overall), dataQuality, consistency: Math.max(50, consistency), evidenceDepth, breakdown };
}

// ═══════════════════════════════════════════════════════════════
// MONTE CARLO SIMULATION
// ═══════════════════════════════════════════════════════════════

/**
 * Monte Carlo confidence interval estimation.
 * 
 * Runs N simulations with Gaussian noise injected into input scores
 * to estimate the robustness of risk predictions.
 * 
 * Returns the mean, P5, P25, P75, P95 of the output distribution,
 * giving parents (and investors) a genuine confidence band.
 * 
 * Based on: Bootstrap resampling methods in pediatric epidemiology
 */
export function monteCarloConfidence(
  computeRisk: (perturbedScores: Record<string, number>) => number,
  baseScores: Record<string, number>,
  iterations: number = 500,
  noiseStdDev: number = 8
): { mean: number; p5: number; p25: number; median: number; p75: number; p95: number; robustness: number } {
  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const perturbed: Record<string, number> = {};
    Object.entries(baseScores).forEach(([k, v]) => {
      // Box-Muller transform for Gaussian noise
      const u1 = Math.random();
      const u2 = Math.random();
      const noise = Math.sqrt(-2 * Math.log(Math.max(u1, 0.0001))) * Math.cos(2 * Math.PI * u2) * noiseStdDev;
      perturbed[k] = Math.max(0, Math.min(100, v + noise));
    });
    results.push(computeRisk(perturbed));
  }

  results.sort((a, b) => a - b);
  const mean = results.reduce((a, b) => a + b, 0) / results.length;
  const percentile = (p: number) => results[Math.floor(p / 100 * results.length)] ?? mean;

  // Robustness: how narrow is the 90% CI relative to mean?
  const ciWidth = percentile(95) - percentile(5);
  const robustness = Math.max(0, Math.min(100, Math.round(100 - ciWidth)));

  return {
    mean: Math.round(mean * 10) / 10,
    p5: Math.round(percentile(5) * 10) / 10,
    p25: Math.round(percentile(25) * 10) / 10,
    median: Math.round(percentile(50) * 10) / 10,
    p75: Math.round(percentile(75) * 10) / 10,
    p95: Math.round(percentile(95) * 10) / 10,
    robustness,
  };
}

// ═══════════════════════════════════════════════════════════════
// ENVIRONMENTAL MODULATION
// ═══════════════════════════════════════════════════════════════

/**
 * Adjust Bayesian priors based on environmental context.
 * 
 * A child in Tier 1 city has different risk profiles than Tier 3.
 * A vegetarian child has fundamentally different nutrient bioavailability.
 * School type correlates with physical activity opportunity.
 * 
 * This makes the engine context-aware — not just benchmark-aware.
 */
export function adjustPriorForEnvironment(
  basePrior: number,
  riskFactor: string,
  context: { cityTier?: string; schoolType?: string; dietType?: string },
  envModifiers?: { cityTier: Record<string, Record<string, number>>; schoolType: Record<string, Record<string, number>> }
): number {
  if (!envModifiers) {
    // Inline defaults when no modifiers provided
    return basePrior;
  }
  let modifier = 1.0;

  if (context.cityTier && envModifiers.cityTier[context.cityTier]?.[riskFactor]) {
    modifier *= envModifiers.cityTier[context.cityTier][riskFactor];
  }
  if (context.schoolType && envModifiers.schoolType[context.schoolType]?.[riskFactor]) {
    modifier *= envModifiers.schoolType[context.schoolType][riskFactor];
  }

  return Math.max(0.01, Math.min(0.95, basePrior * modifier));
}

/**
 * Apply diet-type bioavailability adjustments to nutrient scores.
 * Vegetarian children have 22-45% lower bioavailability for iron/zinc/protein.
 * This is a CRITICAL India-specific adjustment.
 */
export function applyDietTypeModifiers(
  nScores: Record<string, number>,
  dietType: string,
  dietModifiers?: Record<string, Record<string, number>>
): { adjusted: Record<string, number>; modifiers: { nutrient: string; factor: number; reason: string }[] } {
  const defaultMod = { proteinBioavailability: 1.0, ironBioavailability: 1.0 };
  const dietMod = dietModifiers?.[dietType] || dietModifiers?.["non-vegetarian"] || defaultMod;
  const adjusted = { ...nScores };
  const modifiers: { nutrient: string; factor: number; reason: string }[] = [];

  const nutrientFactorMap: Record<string, { key: string; labelFn: (f: number) => string }> = {
    protein: { key: "proteinBioavailability", labelFn: (f) => `${dietType} diet: plant protein is ${Math.round((1 - f) * 100)}% less bioavailable than animal protein` },
    iron: { key: "ironBioavailability", labelFn: (f) => `${dietType} diet: non-heme iron (plant) has ${Math.round((1 - f) * 100)}% lower absorption than heme iron` },
  };

  Object.entries(nutrientFactorMap).forEach(([nutrient, { key, labelFn }]) => {
    const factor = (dietMod as any)[key];
    if (factor && factor !== 1.0 && adjusted[nutrient] !== undefined) {
      adjusted[nutrient] = Math.max(1, Math.min(99, Math.round(adjusted[nutrient] * factor)));
      modifiers.push({ nutrient, factor, reason: labelFn(factor) });
    }
  });

  return { adjusted, modifiers };
}

/**
 * Apply screen time modulation to cognitive and physical scores.
 * This makes screen time a first-class variable in the intelligence engine.
 */
export function applyScreenTimeModulation(
  cScores: Record<string, number>,
  pScores: Record<string, number>,
  screenTime: string,
  screenModifiers?: Record<string, Record<string, number>>
): { adjustedC: Record<string, number>; adjustedP: Record<string, number>; effects: string[] } {
  const defaultMod = { attentionModifier: 1.0, emotionalModifier: 1.0, physicalModifier: 1.0, sleepModifier: 1.0 };
  const stMod = screenModifiers?.[screenTime] || screenModifiers?.["1-2hr"] || defaultMod;
  const adjustedC = { ...cScores };
  const adjustedP = { ...pScores };
  const effects: string[] = [];

  if (stMod.attentionModifier < 1.0 && adjustedC.attention) {
    adjustedC.attention = Math.max(1, Math.round(adjustedC.attention * stMod.attentionModifier));
    effects.push(`Screen time (${screenTime}) reduces effective attention by ${Math.round((1 - stMod.attentionModifier) * 100)}%`);
  }
  if (stMod.emotionalModifier < 1.0 && adjustedC.emotional) {
    adjustedC.emotional = Math.max(1, Math.round(adjustedC.emotional * stMod.emotionalModifier));
    effects.push(`Screen time impacts emotional regulation by ${Math.round((1 - stMod.emotionalModifier) * 100)}%`);
  }
  if (stMod.physicalModifier < 1.0 && adjustedP.endurance) {
    adjustedP.endurance = Math.max(1, Math.round(adjustedP.endurance * stMod.physicalModifier));
    effects.push(`Sedentary screen time reduces effective endurance by ${Math.round((1 - stMod.physicalModifier) * 100)}%`);
  }

  return { adjustedC, adjustedP, effects };
}

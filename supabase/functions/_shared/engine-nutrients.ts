/**
 * KidVital360 — Nutrient Interaction Matrix
 * 
 * Models the complex biochemical interactions between nutrients
 * that affect bioavailability and effective absorption.
 * 
 * This is critical because raw intake numbers are misleading:
 * - Iron + Vitamin C = 6x absorption increase
 * - Calcium + Iron = competitive absorption inhibition
 * - Zinc + Phytates = chelation-based reduction
 * - Vitamin D + Calcium = absorption enabler
 * 
 * Based on: ICMR 2023, WHO nutrient interaction guidelines,
 * NIN Hyderabad bioavailability studies
 */

export interface NutrientInteraction {
  nutrientA: string;
  nutrientB: string;
  type: "synergistic" | "antagonistic" | "enabling";
  /** Multiplier on effective absorption: >1 = boost, <1 = reduction */
  absorptionModifier: number;
  mechanism: string;
  /** Clinical significance: 1-5 scale */
  significance: number;
  /** Practical recommendation */
  recommendation: string;
}

export const NUTRIENT_INTERACTIONS: NutrientInteraction[] = [
  {
    nutrientA: "iron",
    nutrientB: "vitamin_c",
    type: "synergistic",
    absorptionModifier: 2.5,
    mechanism: "Ascorbic acid reduces ferric (Fe³⁺) to ferrous (Fe²⁺) iron, the form absorbed by enterocytes. Also chelates iron in the acidic stomach environment, preventing precipitation in alkaline duodenum.",
    significance: 5,
    recommendation: "Always pair iron-rich foods with Vitamin C sources: amla, lemon, orange. Add lemon to dal/palak. Halim seeds + amla juice is the optimal Indian combination.",
  },
  {
    nutrientA: "calcium",
    nutrientB: "iron",
    type: "antagonistic",
    absorptionModifier: 0.55,
    mechanism: "Calcium and iron compete for DMT1 (divalent metal transporter 1) in the duodenal brush border. 300mg calcium reduces non-heme iron absorption by 45%.",
    significance: 4,
    recommendation: "Never give milk/curd with iron-rich meals. Separate calcium and iron sources by at least 2 hours. Give iron-rich foods at lunch, calcium-rich foods at breakfast and dinner.",
  },
  {
    nutrientA: "calcium",
    nutrientB: "vitamin_d",
    type: "enabling",
    absorptionModifier: 1.8,
    mechanism: "Vitamin D upregulates calbindin-D9k protein in intestinal epithelium, which is essential for active calcium transcellular transport. Without Vitamin D, only passive paracellular absorption occurs (~10-15% efficiency).",
    significance: 5,
    recommendation: "15-20 min morning sunlight (before 10 AM) is non-negotiable for calcium absorption. In vitamin D deficient children, calcium supplementation alone is ineffective.",
  },
  {
    nutrientA: "zinc",
    nutrientB: "protein",
    type: "synergistic",
    absorptionModifier: 1.6,
    mechanism: "Amino acids (especially histidine, methionine, cysteine) form soluble chelates with zinc that enhance intestinal absorption. Animal proteins also release zinc from phytate complexes.",
    significance: 3,
    recommendation: "Pair zinc sources with protein: pumpkin seeds + dahi, chickpeas with paneer. Sprouting legumes before cooking reduces phytates and increases zinc bioavailability by 50%.",
  },
  {
    nutrientA: "iron",
    nutrientB: "fiber",
    type: "antagonistic",
    absorptionModifier: 0.70,
    mechanism: "Phytates and tannins in high-fiber foods bind divalent cations (Fe²⁺, Zn²⁺) in the intestinal lumen, forming insoluble complexes that are excreted. The effect is dose-dependent.",
    significance: 3,
    recommendation: "Soaking, sprouting, and fermenting grains/legumes reduces phytate content by 30-70%. Traditional Indian practices (dosa batter fermentation, sprout chaat) are scientifically optimal.",
  },
  {
    nutrientA: "omega3",
    nutrientB: "vitamin_d",
    type: "synergistic",
    absorptionModifier: 1.4,
    mechanism: "Omega-3 fatty acids improve vitamin D receptor (VDR) expression and increase 25(OH)D bioactivity. Fat-soluble vitamins require dietary fat for micelle formation and absorption.",
    significance: 3,
    recommendation: "Take vitamin D with omega-3 rich foods: flaxseed oil + fortified milk, fish + sunlight exposure. Fat enhances absorption of all fat-soluble vitamins (A, D, E, K).",
  },
  {
    nutrientA: "protein",
    nutrientB: "calcium",
    type: "synergistic",
    absorptionModifier: 1.3,
    mechanism: "Casein phosphopeptides (from dairy protein) enhance calcium solubility in the small intestine. Moderate protein intake also promotes calcitriol production by the kidneys.",
    significance: 3,
    recommendation: "Dairy is the ideal 2-in-1: paneer provides both protein and calcium. Ragi porridge with milk combines plant and dairy calcium with protein for optimal absorption.",
  },
  {
    nutrientA: "fiber",
    nutrientB: "water",
    type: "enabling",
    absorptionModifier: 1.5,
    mechanism: "Soluble fiber requires adequate hydration to form viscous gel in the gut, which slows glucose absorption and promotes prebiotic fermentation. Without water, high fiber causes constipation and reduces mineral absorption.",
    significance: 4,
    recommendation: "When increasing fiber (millets, vegetables), MUST increase water intake proportionally. Rule: 1 glass of water per 5g fiber added. Dehydration + high fiber = worse outcomes than low fiber.",
  },
];

/**
 * Compute the effective nutrient score after applying interaction effects.
 * This adjusts raw intake percentiles based on what the body can actually absorb
 * given the presence/absence of synergistic and antagonistic nutrients.
 * 
 * This is a KEY differentiator: no other child health tool does this.
 */
export function computeEffectiveNutrientScores(
  rawScores: Record<string, number>
): { adjusted: Record<string, number>; interactions: { nutrient: string; raw: number; adjusted: number; modifier: number; reason: string }[] } {
  const adjusted = { ...rawScores };
  const interactions: { nutrient: string; raw: number; adjusted: number; modifier: number; reason: string }[] = [];

  // Map simplified nutrient names to score keys
  const nutrientMap: Record<string, string> = {
    iron: "iron",
    calcium: "calcium",
    protein: "protein",
    fiber: "fiber",
    water: "water",
  };

  // Iron effective score
  if (rawScores.iron !== undefined) {
    let ironModifier = 1.0;
    const reasons: string[] = [];

    // Check calcium antagonism (high calcium reduces iron absorption)
    if (rawScores.calcium > 60) {
      ironModifier *= 0.85;
      reasons.push("High calcium intake reduces iron absorption by ~15%");
    }

    // Check fiber antagonism
    if (rawScores.fiber > 65) {
      ironModifier *= 0.90;
      reasons.push("High fiber (phytates) reduces iron absorption by ~10%");
    }

    // P1-C FIX: Removed self-referential iron penalty (circular reasoning removed).
    // Iron's own low value is the outcome; only external factors (calcium, fiber) modify it.

    const adjustedIron = Math.max(0, Math.min(100, Math.round(rawScores.iron * ironModifier)));
    if (adjustedIron !== rawScores.iron) {
      adjusted.iron = adjustedIron;
      interactions.push({ nutrient: "iron", raw: rawScores.iron, adjusted: adjustedIron, modifier: ironModifier, reason: reasons.join("; ") });
    }
  }

  // Calcium effective score
  if (rawScores.calcium !== undefined) {
    let calciumModifier = 1.0;
    const reasons: string[] = [];

    // Vitamin D deficiency is endemic in India (68%)
    // Assume suboptimal vitamin D unless calcium is very high
    if (rawScores.calcium < 50) {
      calciumModifier *= 0.75;
      reasons.push("68% of Indian children are Vitamin D deficient — calcium absorption likely impaired by 25%");
    }

    // Protein synergy
    if (rawScores.protein > 55) {
      calciumModifier *= 1.1;
      reasons.push("Good protein intake enhances calcium absorption via casein phosphopeptides");
    }

    const adjustedCalcium = Math.max(0, Math.min(100, Math.round(rawScores.calcium * calciumModifier)));
    if (adjustedCalcium !== rawScores.calcium) {
      adjusted.calcium = adjustedCalcium;
      interactions.push({ nutrient: "calcium", raw: rawScores.calcium, adjusted: adjustedCalcium, modifier: calciumModifier, reason: reasons.join("; ") });
    }
  }

  // Protein effective score
  if (rawScores.protein !== undefined) {
    let proteinModifier = 1.0;
    const reasons: string[] = [];

    // Water enables protein synthesis
    if (rawScores.water < 35) {
      proteinModifier *= 0.88;
      reasons.push("Dehydration impairs protein synthesis efficiency by ~12%");
    }

    // Caloric adequacy enables protein use for growth (vs energy)
    if (rawScores.calories < 35) {
      proteinModifier *= 0.80;
      reasons.push("Low caloric intake forces protein catabolism for energy — 20% less available for growth");
    }

    const adjustedProtein = Math.max(0, Math.min(100, Math.round(rawScores.protein * proteinModifier)));
    if (adjustedProtein !== rawScores.protein) {
      adjusted.protein = adjustedProtein;
      interactions.push({ nutrient: "protein", raw: rawScores.protein, adjusted: adjustedProtein, modifier: proteinModifier, reason: reasons.join("; ") });
    }
  }

  return { adjusted, interactions };
}

/**
 * Get relevant interaction recommendations for a child's profile
 */
export function getRelevantInteractions(
  nScores: Record<string, number>
): NutrientInteraction[] {
  return NUTRIENT_INTERACTIONS.filter((interaction) => {
    // Show interactions where at least one nutrient is concerning
    const nutrients = [interaction.nutrientA, interaction.nutrientB];
    const scoreKeys: Record<string, string> = {
      iron: "iron", calcium: "calcium", protein: "protein",
      fiber: "fiber", water: "water", vitamin_c: "iron", // proxy
      vitamin_d: "calcium", zinc: "iron", omega3: "iron",
    };
    
    return nutrients.some((n) => {
      const key = scoreKeys[n];
      return key && nScores[key] !== undefined && (nScores[key] < 50 || interaction.type === "antagonistic");
    });
  }).sort((a, b) => b.significance - a.significance);
}

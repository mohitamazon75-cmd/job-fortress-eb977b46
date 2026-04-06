/**
 * @fileoverview Industry automation floors, sub-sector taxonomy,
 * skill risk modifiers, and essential role detection.
 * Research-backed minimum risk scores per industry/sub-sector.
 */

// ── INDUSTRY AUTOMATION FLOOR SCORES ──
// Research-backed minimum automation risk per industry when KG skill matching is sparse.
// Sources: McKinsey GenAI Impact Report 2024, Goldman Sachs 2024, WEF Future of Jobs 2025
const INDUSTRY_AUTOMATION_FLOORS: Record<string, number> = {
  "marketing & advertising": 58,
  "it & software": 48,
  "finance & banking": 52,
  "creative & design": 45,
  "healthcare": 30,
  "education": 35,
  "manufacturing": 42,
  "other": 45,
};

// ── SUB-SECTOR TAXONOMY ──
// Granular automation floors within broad industries.
const SUB_SECTOR_AUTOMATION_FLOORS: Record<string, Record<string, number>> = {
  "it & software": {
    "it services & outsourcing": 62,
    "it consulting": 55,
    "saas product": 42,
    "enterprise software": 44,
    "cybersecurity": 35,
    "data engineering": 50,
    "data science & ml": 40,
    "devops & cloud": 48,
    "embedded systems": 38,
    "gaming": 42,
    "fintech": 50,
    "healthtech": 38,
    "edtech": 45,
    "ecommerce platform": 48,
  },
  "finance & banking": {
    "investment banking": 48,
    "retail banking": 58,
    "insurance": 55,
    "wealth management": 45,
    "fintech": 50,
    "accounting & audit": 60,
    "risk & compliance": 42,
  },
  "marketing & advertising": {
    "performance marketing": 65,
    "brand strategy": 42,
    "content marketing": 62,
    "social media": 58,
    "pr & communications": 48,
    "market research": 55,
    "seo & sem": 60,
  },
  "creative & design": {
    "graphic design": 55,
    "ux/ui design": 40,
    "video production": 48,
    "copywriting": 65,
    "creative direction": 30,
    "animation & motion": 45,
  },
  "healthcare": {
    "clinical practice": 22,
    "health administration": 48,
    "pharma & biotech": 35,
    "medical devices": 38,
    "telehealth": 42,
    "diagnostics & imaging": 40,
  },
  "education": {
    "k-12 teaching": 25,
    "higher education": 35,
    "corporate training": 50,
    "edtech product": 45,
    "tutoring & coaching": 38,
  },
  "manufacturing": {
    "production & assembly": 55,
    "quality engineering": 40,
    "supply chain": 48,
    "r&d & product design": 35,
    "process engineering": 42,
  },
};

// ── INDUSTRY-SPECIFIC SKILL RISK MODIFIERS (sub-sector aware) ──
const SUB_SECTOR_SKILL_MODIFIERS: Record<string, Record<string, Record<string, number>>> = {
  "it & software": {
    "it services & outsourcing": { "default": 8, "testing": 12, "support": 15, "documentation": 10, "project_management": 5 },
    "cybersecurity": { "default": -8, "threat_analysis": -12, "incident_response": -15, "compliance": -10 },
    "saas product": { "default": -3, "product_management": -8, "architecture": -10, "coding": 3 },
    "data science & ml": { "default": -5, "machine_learning": -10, "statistics": -8, "data_analysis": 5 },
  },
  "finance & banking": {
    "accounting & audit": { "default": 8, "bookkeeping": 15, "tax_preparation": 12, "audit_planning": -5 },
    "risk & compliance": { "default": -8, "regulatory_analysis": -12, "compliance": -10 },
  },
  "marketing & advertising": {
    "performance marketing": { "default": 5, "media_buying": 12, "analytics": 8, "strategy": -5 },
    "content marketing": { "default": 8, "copywriting": 15, "content_strategy": -3, "seo": 10 },
  },
};

// ── INDUSTRY-SPECIFIC SKILL RISK MODIFIERS (parent level) ──
const INDUSTRY_SKILL_MODIFIERS: Record<string, Record<string, number>> = {
  "it & software": { "default": 0 },
  "healthcare": { "default": -12, "data_analysis": -8, "documentation": 5, "compliance": -15, "patient_care": -20 },
  "finance & banking": { "default": 5, "data_analysis": 10, "compliance": -15, "risk_management": -10, "financial_modeling": 8 },
  "creative & design": { "default": -5, "content_creation": 15, "visual_design": 10, "copywriting": 18, "ux_design": -5 },
  "marketing & advertising": { "default": 8, "content_creation": 15, "copywriting": 20, "seo": 12, "data_analysis": 5 },
  "manufacturing": { "default": -8, "quality_control": -10, "process_automation": 10, "supply_chain": -5, "safety_management": -15 },
  "education": { "default": -10, "content_creation": 8, "assessment": 12, "curriculum_design": -8, "student_engagement": -18 },
};

export function getIndustryAutomationFloor(industry: string | null, subSector?: string | null): number {
  if (!industry) return 45;
  const key = industry.toLowerCase().trim();

  if (subSector) {
    const subKey = subSector.toLowerCase().trim();
    const sectorMap = SUB_SECTOR_AUTOMATION_FLOORS[key];
    if (sectorMap) {
      if (sectorMap[subKey] !== undefined) return sectorMap[subKey];
      for (const [k, v] of Object.entries(sectorMap)) {
        if (subKey.includes(k) || k.includes(subKey)) return v;
      }
    }
    for (const [, sMap] of Object.entries(SUB_SECTOR_AUTOMATION_FLOORS)) {
      if (sMap[subKey] !== undefined) return sMap[subKey];
      for (const [k, v] of Object.entries(sMap)) {
        if (subKey.includes(k) || k.includes(subKey)) return v;
      }
    }
  }

  if (INDUSTRY_AUTOMATION_FLOORS[key] !== undefined) return INDUSTRY_AUTOMATION_FLOORS[key];
  for (const [k, v] of Object.entries(INDUSTRY_AUTOMATION_FLOORS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return 45;
}

export function getIndustrySkillModifier(industry: string | null, skillName: string, subSector?: string | null): number {
  if (!industry) return 0;
  const indKey = industry.toLowerCase().trim();
  const skillKey = skillName.toLowerCase().replace(/[\s\-]+/g, '_');

  if (subSector) {
    const subKey = subSector.toLowerCase().trim();
    const sectorModifiers = SUB_SECTOR_SKILL_MODIFIERS[indKey];
    if (sectorModifiers) {
      const subModifiers = sectorModifiers[subKey];
      if (subModifiers) {
        if (subModifiers[skillKey] !== undefined) return subModifiers[skillKey];
        for (const [k, v] of Object.entries(subModifiers)) {
          if (k !== 'default' && (skillKey.includes(k) || k.includes(skillKey))) return v;
        }
        if (subModifiers["default"] !== undefined) return subModifiers["default"];
      }
      for (const [sk, sm] of Object.entries(sectorModifiers)) {
        if (subKey.includes(sk) || sk.includes(subKey)) {
          if (sm[skillKey] !== undefined) return sm[skillKey];
          for (const [k, v] of Object.entries(sm)) {
            if (k !== 'default' && (skillKey.includes(k) || k.includes(skillKey))) return v;
          }
          if (sm["default"] !== undefined) return sm["default"];
        }
      }
    }
  }

  let modifiers: Record<string, number> | undefined;
  modifiers = INDUSTRY_SKILL_MODIFIERS[indKey];
  if (!modifiers) {
    for (const [k, v] of Object.entries(INDUSTRY_SKILL_MODIFIERS)) {
      if (indKey.includes(k) || k.includes(indKey)) { modifiers = v; break; }
    }
  }
  if (!modifiers) return 0;
  if (modifiers[skillKey] !== undefined) return modifiers[skillKey];
  for (const [k, v] of Object.entries(modifiers)) {
    if (k !== 'default' && (skillKey.includes(k) || k.includes(skillKey))) return v;
  }
  return modifiers["default"] ?? 0;
}

// Industries/categories considered "essential" — structural societal demand
const ESSENTIAL_INDUSTRIES = new Set([
  "healthcare", "education", "public safety", "emergency services",
  "social work", "nursing", "medicine", "teaching",
]);

const ESSENTIAL_JOB_FAMILIES = new Set([
  "nurse", "doctor", "physician", "surgeon", "teacher", "professor",
  "educator", "social_worker", "paramedic", "firefighter", "police",
  "therapist", "counselor", "clinical", "pharmacist",
]);

export function isEssentialRole(industry: string | null, jobFamily: string | null): boolean {
  const industryLower = (industry || "").toLowerCase().trim();
  const familyLower = (jobFamily || "").toLowerCase().replace(/_/g, " ").trim();
  if (ESSENTIAL_INDUSTRIES.has(industryLower)) return true;
  for (const essential of ESSENTIAL_JOB_FAMILIES) {
    if (familyLower.includes(essential)) return true;
  }
  return false;
}

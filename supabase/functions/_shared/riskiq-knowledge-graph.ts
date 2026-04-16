// ═══════════════════════════════════════════════════════════════
// RiskIQ Knowledge Graph — TypeScript port
// 90 Roles, 30 Skills, 10 AI Threats, 20 Industries, 18 Cities
// Data fused from Oxford, McKinsey, O*NET, WEF, Stanford AI Index
// Expanded with Indian market roles (NASSCOM 2024, LinkedIn India 2025)
// ═══════════════════════════════════════════════════════════════

// ── Research provenance map ─────────────────────────────────────────────────
// Each automation_prob is grounded in published research. Key references:
//   FREY_OSBORNE: Frey & Osborne (2013) "The Future of Employment", Oxford
//   MANYIKA_2017:  McKinsey Global Institute (2017) "Jobs Lost, Jobs Gained"
//   WEF_2025:      WEF "Future of Jobs Report 2025"
//   ONET_TASK:     O*NET Task Analysis — task automability scores
//   NASSCOM_2024:  NASSCOM AI Outlook India 2024
//   STANFORD_AI:   Stanford AI Index 2024
//   LINKEDIN_IN:   LinkedIn Economic Graph India 2025
export const KG_CITATION_SOURCES = {
  FREY_OSBORNE: "https://doi.org/10.1016/j.techfore.2013.08.041",
  MANYIKA_2017: "https://www.mckinsey.com/featured-insights/future-of-work/jobs-lost-jobs-gained",
  WEF_2025: "https://www3.weforum.org/docs/WEF_Future_of_Jobs_2025.pdf",
  ONET_TASK: "https://www.onetcenter.org/dictionary/28.1/excel/task_category.html",
  NASSCOM_2024: "https://nasscom.in/ai-outlook-2024",
  STANFORD_AI: "https://aiindex.stanford.edu/report/",
  LINKEDIN_IN: "https://economicgraph.linkedin.com/research/india",
} as const;

// automation_prob source map — which research underpins each role's risk estimate.
// When KG data conflicts with agent output, the source_ref is cited in the methodology page.
export const KG_ROLE_CITATIONS: Record<string, string[]> = {
  data_entry:           ["FREY_OSBORNE", "MANYIKA_2017"],   // Frey-Osborne: 0.99; MGI: >90%
  bank_teller:          ["FREY_OSBORNE", "WEF_2025"],        // Frey-Osborne: 0.98; WEF: highly exposed
  call_center:          ["FREY_OSBORNE", "NASSCOM_2024"],    // Frey-Osborne: 0.97; NASSCOM: acute risk
  content_writer:       ["WEF_2025", "STANFORD_AI"],         // WEF: high disruption; Stanford: GenAI impact
  qa_tester:            ["ONET_TASK", "LINKEDIN_IN"],        // O*NET: high task automability
  data_analyst:         ["MANYIKA_2017", "WEF_2025"],        // MGI partial displacement estimate
  software_engineer:    ["FREY_OSBORNE", "ONET_TASK"],       // Frey-Osborne: 0.48; O*NET task analysis
  product_manager:      ["WEF_2025", "LINKEDIN_IN"],         // WEF: lower risk; LI: demand growing
  ux_designer:          ["ONET_TASK", "STANFORD_AI"],        // O*NET: social + creative tasks resilient
  doctor_nurse:         ["FREY_OSBORNE", "WEF_2025"],        // Frey-Osborne: low; WEF: regulatory shield
  teacher:              ["MANYIKA_2017", "WEF_2025"],        // MGI: social intelligence protection
  researcher:           ["ONET_TASK", "STANFORD_AI"],        // Stanford: research augmented not replaced
  voice_process:        ["NASSCOM_2024", "FREY_OSBORNE"],    // NASSCOM: India-specific BPO disruption
  kyc_aml_analyst:      ["NASSCOM_2024", "WEF_2025"],        // NASSCOM 2024: fintech automation
};

export interface RoleNode {
  id: string;
  title: string;
  base_automation_prob: number;
  task_automability: number;
  cognitive_routine_score: number;
  social_intelligence_req: number;
  creative_originality_req: number;
  physical_dexterity_req: number;
  decision_authority: number;
  regulatory_shield: number;
  pivot_targets: string[];
  partial_displacement_years: number;
  significant_displacement_years: number;
  critical_displacement_years: number;
  current_demand_trend: string;
  salary_percentile: number;
}

export interface SkillNode {
  id: string;
  name: string;
  category: string;
  half_life_years: number;
  current_demand: string;
  ai_replication_difficulty: number;
  scarcity_score: number;
  synergy_with_ai: boolean;
}

export interface AIToolThreat {
  id: string;
  name: string;
  vendor: string;
  threatens_roles: string[];
  threatens_tasks: string[];
  deployment_maturity: string;
  replacement_pct: number;
  eta_mainstream: string;
  severity_score: number;
}

export interface IndustryNode {
  id: string;
  name: string;
  disruption_velocity: number;
  ai_investment_index: number;
  regulatory_barrier: number;
  data_availability: number;
  workforce_pct_at_risk_2027: number;
  workforce_pct_at_risk_2030: number;
  safe_harbors: string[];
}

export interface CityNode {
  id: string;
  name: string;
  ai_adoption_multiplier: number;
  tech_talent_density: number;
  labor_market_resilience: number;
  avg_transition_support: number;
  emerging_roles_index: number;
}

export class RiskKnowledgeGraph {
  roles: Map<string, RoleNode> = new Map();
  skills: Map<string, SkillNode> = new Map();
  ai_threats: Map<string, AIToolThreat> = new Map();
  industries: Map<string, IndustryNode> = new Map();
  cities: Map<string, CityNode> = new Map();

  constructor() {
    this._loadRoles();
    this._loadSkills();
    this._loadAIThreats();
    this._loadIndustries();
    this._loadCities();
  }

  private _loadRoles() {
    const roles: RoleNode[] = [
      { id: "financial_analyst", title: "Financial Analyst", base_automation_prob: 0.80, task_automability: 0.74, cognitive_routine_score: 82, social_intelligence_req: 28, creative_originality_req: 22, physical_dexterity_req: 2, decision_authority: 35, regulatory_shield: 40, pivot_targets: ["data_scientist", "product_manager", "consultant"], partial_displacement_years: 1.5, significant_displacement_years: 3.0, critical_displacement_years: 5.0, current_demand_trend: "declining", salary_percentile: 62 },
      { id: "accountant", title: "Accountant / Auditor", base_automation_prob: 0.86, task_automability: 0.81, cognitive_routine_score: 88, social_intelligence_req: 22, creative_originality_req: 10, physical_dexterity_req: 1, decision_authority: 30, regulatory_shield: 55, pivot_targets: ["financial_analyst", "data_analyst", "consultant"], partial_displacement_years: 1.0, significant_displacement_years: 2.5, critical_displacement_years: 4.5, current_demand_trend: "declining", salary_percentile: 55 },
      { id: "data_analyst", title: "Data Analyst", base_automation_prob: 0.70, task_automability: 0.68, cognitive_routine_score: 72, social_intelligence_req: 30, creative_originality_req: 32, physical_dexterity_req: 1, decision_authority: 28, regulatory_shield: 15, pivot_targets: ["data_scientist", "ml_engineer", "product_manager"], partial_displacement_years: 1.0, significant_displacement_years: 2.5, critical_displacement_years: 4.0, current_demand_trend: "declining", salary_percentile: 58 },
      { id: "data_scientist", title: "Data Scientist", base_automation_prob: 0.45, task_automability: 0.42, cognitive_routine_score: 55, social_intelligence_req: 38, creative_originality_req: 62, physical_dexterity_req: 1, decision_authority: 55, regulatory_shield: 20, pivot_targets: ["ml_engineer", "ai_researcher", "product_manager"], partial_displacement_years: 2.5, significant_displacement_years: 4.5, critical_displacement_years: 7.0, current_demand_trend: "stable", salary_percentile: 78 },
      { id: "software_engineer", title: "Software Engineer", base_automation_prob: 0.52, task_automability: 0.48, cognitive_routine_score: 58, social_intelligence_req: 35, creative_originality_req: 60, physical_dexterity_req: 2, decision_authority: 50, regulatory_shield: 12, pivot_targets: ["ml_engineer", "product_manager", "solutions_architect"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 6.5, current_demand_trend: "stable", salary_percentile: 75 },
      { id: "ml_engineer", title: "ML Engineer", base_automation_prob: 0.35, task_automability: 0.32, cognitive_routine_score: 45, social_intelligence_req: 40, creative_originality_req: 72, physical_dexterity_req: 1, decision_authority: 60, regulatory_shield: 18, pivot_targets: ["ai_researcher", "cto", "product_manager"], partial_displacement_years: 3.0, significant_displacement_years: 5.5, critical_displacement_years: 9.0, current_demand_trend: "growing", salary_percentile: 85 },
      { id: "business_analyst", title: "Business Analyst", base_automation_prob: 0.72, task_automability: 0.68, cognitive_routine_score: 75, social_intelligence_req: 45, creative_originality_req: 30, physical_dexterity_req: 1, decision_authority: 32, regulatory_shield: 18, pivot_targets: ["product_manager", "consultant", "data_scientist"], partial_displacement_years: 1.5, significant_displacement_years: 3.0, critical_displacement_years: 5.0, current_demand_trend: "declining", salary_percentile: 60 },
      { id: "product_manager", title: "Product Manager", base_automation_prob: 0.42, task_automability: 0.38, cognitive_routine_score: 42, social_intelligence_req: 78, creative_originality_req: 68, physical_dexterity_req: 2, decision_authority: 75, regulatory_shield: 15, pivot_targets: ["cto", "ceo", "consultant"], partial_displacement_years: 3.0, significant_displacement_years: 5.0, critical_displacement_years: 8.5, current_demand_trend: "stable", salary_percentile: 80 },
      { id: "consultant", title: "Consultant", base_automation_prob: 0.55, task_automability: 0.50, cognitive_routine_score: 52, social_intelligence_req: 72, creative_originality_req: 58, physical_dexterity_req: 2, decision_authority: 68, regulatory_shield: 25, pivot_targets: ["product_manager", "ceo", "investor"], partial_displacement_years: 2.5, significant_displacement_years: 4.5, critical_displacement_years: 7.5, current_demand_trend: "stable", salary_percentile: 76 },
      { id: "marketing_manager", title: "Marketing Manager", base_automation_prob: 0.60, task_automability: 0.58, cognitive_routine_score: 60, social_intelligence_req: 65, creative_originality_req: 62, physical_dexterity_req: 3, decision_authority: 58, regulatory_shield: 12, pivot_targets: ["product_manager", "consultant", "growth_lead"], partial_displacement_years: 1.5, significant_displacement_years: 3.0, critical_displacement_years: 5.5, current_demand_trend: "declining", salary_percentile: 65 },
      { id: "content_writer", title: "Content Writer", base_automation_prob: 0.78, task_automability: 0.75, cognitive_routine_score: 78, social_intelligence_req: 30, creative_originality_req: 65, physical_dexterity_req: 2, decision_authority: 25, regulatory_shield: 8, pivot_targets: ["marketing_manager", "ux_designer", "product_manager"], partial_displacement_years: 0.5, significant_displacement_years: 1.5, critical_displacement_years: 3.0, current_demand_trend: "collapsing", salary_percentile: 40 },
      { id: "ux_designer", title: "UX Designer", base_automation_prob: 0.48, task_automability: 0.44, cognitive_routine_score: 48, social_intelligence_req: 70, creative_originality_req: 75, physical_dexterity_req: 5, decision_authority: 55, regulatory_shield: 10, pivot_targets: ["product_manager", "researcher", "design_director"], partial_displacement_years: 2.5, significant_displacement_years: 4.5, critical_displacement_years: 7.0, current_demand_trend: "stable", salary_percentile: 70 },
      { id: "graphic_designer", title: "Graphic Designer", base_automation_prob: 0.65, task_automability: 0.62, cognitive_routine_score: 62, social_intelligence_req: 38, creative_originality_req: 78, physical_dexterity_req: 8, decision_authority: 35, regulatory_shield: 8, pivot_targets: ["ux_designer", "brand_strategist", "creative_director"], partial_displacement_years: 1.0, significant_displacement_years: 2.5, critical_displacement_years: 4.5, current_demand_trend: "declining", salary_percentile: 48 },
      { id: "hr_manager", title: "HR Manager", base_automation_prob: 0.68, task_automability: 0.62, cognitive_routine_score: 65, social_intelligence_req: 75, creative_originality_req: 28, physical_dexterity_req: 2, decision_authority: 55, regulatory_shield: 42, pivot_targets: ["consultant", "operations_manager", "people_analytics"], partial_displacement_years: 2.0, significant_displacement_years: 3.5, critical_displacement_years: 6.0, current_demand_trend: "declining", salary_percentile: 55 },
      { id: "recruiter", title: "Recruiter", base_automation_prob: 0.74, task_automability: 0.70, cognitive_routine_score: 72, social_intelligence_req: 70, creative_originality_req: 22, physical_dexterity_req: 2, decision_authority: 42, regulatory_shield: 18, pivot_targets: ["hr_manager", "sales_rep", "consultant"], partial_displacement_years: 1.0, significant_displacement_years: 2.5, critical_displacement_years: 4.0, current_demand_trend: "collapsing", salary_percentile: 50 },
      { id: "operations_manager", title: "Operations Manager", base_automation_prob: 0.62, task_automability: 0.56, cognitive_routine_score: 60, social_intelligence_req: 68, creative_originality_req: 38, physical_dexterity_req: 15, decision_authority: 68, regulatory_shield: 28, pivot_targets: ["consultant", "product_manager", "supply_chain_lead"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 6.5, current_demand_trend: "stable", salary_percentile: 65 },
      { id: "project_manager", title: "Project Manager", base_automation_prob: 0.55, task_automability: 0.50, cognitive_routine_score: 55, social_intelligence_req: 72, creative_originality_req: 35, physical_dexterity_req: 5, decision_authority: 62, regulatory_shield: 20, pivot_targets: ["product_manager", "consultant", "operations_manager"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 7.0, current_demand_trend: "stable", salary_percentile: 65 },
      { id: "sales_rep", title: "Sales Rep", base_automation_prob: 0.60, task_automability: 0.55, cognitive_routine_score: 58, social_intelligence_req: 80, creative_originality_req: 42, physical_dexterity_req: 10, decision_authority: 50, regulatory_shield: 15, pivot_targets: ["account_executive", "consultant", "product_manager"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 6.5, current_demand_trend: "declining", salary_percentile: 60 },
      { id: "customer_support", title: "Customer Support", base_automation_prob: 0.90, task_automability: 0.86, cognitive_routine_score: 88, social_intelligence_req: 55, creative_originality_req: 12, physical_dexterity_req: 2, decision_authority: 20, regulatory_shield: 10, pivot_targets: ["ux_designer", "sales_rep", "hr_manager"], partial_displacement_years: 0.5, significant_displacement_years: 1.5, critical_displacement_years: 3.0, current_demand_trend: "collapsing", salary_percentile: 35 },
      { id: "lawyer", title: "Lawyer / Paralegal", base_automation_prob: 0.68, task_automability: 0.62, cognitive_routine_score: 65, social_intelligence_req: 62, creative_originality_req: 52, physical_dexterity_req: 2, decision_authority: 72, regulatory_shield: 85, pivot_targets: ["consultant", "compliance_officer", "legal_tech"], partial_displacement_years: 2.0, significant_displacement_years: 4.5, critical_displacement_years: 8.0, current_demand_trend: "declining", salary_percentile: 72 },
      { id: "doctor_nurse", title: "Doctor / Nurse", base_automation_prob: 0.30, task_automability: 0.28, cognitive_routine_score: 38, social_intelligence_req: 88, creative_originality_req: 55, physical_dexterity_req: 72, decision_authority: 85, regulatory_shield: 92, pivot_targets: ["health_tech", "researcher", "consultant"], partial_displacement_years: 4.0, significant_displacement_years: 7.0, critical_displacement_years: 12.0, current_demand_trend: "growing", salary_percentile: 82 },
      { id: "teacher", title: "Teacher / Professor", base_automation_prob: 0.40, task_automability: 0.35, cognitive_routine_score: 45, social_intelligence_req: 85, creative_originality_req: 55, physical_dexterity_req: 12, decision_authority: 65, regulatory_shield: 70, pivot_targets: ["instructional_designer", "consultant", "researcher"], partial_displacement_years: 3.0, significant_displacement_years: 6.0, critical_displacement_years: 10.0, current_demand_trend: "stable", salary_percentile: 52 },
      { id: "researcher", title: "Researcher", base_automation_prob: 0.38, task_automability: 0.35, cognitive_routine_score: 45, social_intelligence_req: 45, creative_originality_req: 80, physical_dexterity_req: 15, decision_authority: 70, regulatory_shield: 40, pivot_targets: ["data_scientist", "consultant", "product_manager"], partial_displacement_years: 3.0, significant_displacement_years: 5.5, critical_displacement_years: 9.0, current_demand_trend: "growing", salary_percentile: 68 },
      { id: "cto", title: "CTO / VP Engineering", base_automation_prob: 0.28, task_automability: 0.25, cognitive_routine_score: 32, social_intelligence_req: 82, creative_originality_req: 72, physical_dexterity_req: 2, decision_authority: 92, regulatory_shield: 35, pivot_targets: ["ceo", "investor", "board_advisor"], partial_displacement_years: 4.0, significant_displacement_years: 7.0, critical_displacement_years: 12.0, current_demand_trend: "stable", salary_percentile: 92 },
      { id: "ceo", title: "CEO / Founder", base_automation_prob: 0.20, task_automability: 0.18, cognitive_routine_score: 25, social_intelligence_req: 90, creative_originality_req: 82, physical_dexterity_req: 5, decision_authority: 98, regulatory_shield: 45, pivot_targets: ["investor", "board_advisor", "consultant"], partial_displacement_years: 5.0, significant_displacement_years: 9.0, critical_displacement_years: 15.0, current_demand_trend: "stable", salary_percentile: 95 },

      // ── IT & ENGINEERING EXPANSION ────────────────────────────────
      { id: "devops_engineer", title: "DevOps Engineer", base_automation_prob: 0.48, task_automability: 0.44, cognitive_routine_score: 50, social_intelligence_req: 38, creative_originality_req: 52, physical_dexterity_req: 2, decision_authority: 48, regulatory_shield: 18, pivot_targets: ["cloud_architect", "solutions_architect", "ml_engineer"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 7.0, current_demand_trend: "stable", salary_percentile: 74 },
      { id: "cloud_architect", title: "Cloud Architect", base_automation_prob: 0.38, task_automability: 0.34, cognitive_routine_score: 42, social_intelligence_req: 50, creative_originality_req: 62, physical_dexterity_req: 1, decision_authority: 68, regulatory_shield: 22, pivot_targets: ["cto", "solutions_architect", "ml_engineer"], partial_displacement_years: 3.0, significant_displacement_years: 5.5, critical_displacement_years: 9.0, current_demand_trend: "growing", salary_percentile: 84 },
      { id: "qa_engineer", title: "QA Engineer / Test Engineer", base_automation_prob: 0.72, task_automability: 0.68, cognitive_routine_score: 70, social_intelligence_req: 32, creative_originality_req: 35, physical_dexterity_req: 1, decision_authority: 28, regulatory_shield: 20, pivot_targets: ["software_engineer", "devops_engineer", "product_manager"], partial_displacement_years: 1.0, significant_displacement_years: 2.5, critical_displacement_years: 4.5, current_demand_trend: "declining", salary_percentile: 58 },
      { id: "network_engineer", title: "Network Engineer", base_automation_prob: 0.55, task_automability: 0.50, cognitive_routine_score: 58, social_intelligence_req: 28, creative_originality_req: 30, physical_dexterity_req: 20, decision_authority: 42, regulatory_shield: 25, pivot_targets: ["cloud_architect", "cybersecurity_analyst", "devops_engineer"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 7.0, current_demand_trend: "declining", salary_percentile: 60 },
      { id: "database_admin", title: "Database Administrator", base_automation_prob: 0.65, task_automability: 0.60, cognitive_routine_score: 65, social_intelligence_req: 25, creative_originality_req: 28, physical_dexterity_req: 1, decision_authority: 38, regulatory_shield: 20, pivot_targets: ["data_engineer", "cloud_architect", "data_scientist"], partial_displacement_years: 1.5, significant_displacement_years: 3.0, critical_displacement_years: 5.5, current_demand_trend: "declining", salary_percentile: 62 },
      { id: "cybersecurity_analyst", title: "Cybersecurity Analyst", base_automation_prob: 0.35, task_automability: 0.32, cognitive_routine_score: 40, social_intelligence_req: 42, creative_originality_req: 60, physical_dexterity_req: 1, decision_authority: 58, regulatory_shield: 55, pivot_targets: ["cto", "cloud_architect", "consultant"], partial_displacement_years: 3.0, significant_displacement_years: 6.0, critical_displacement_years: 10.0, current_demand_trend: "growing", salary_percentile: 80 },
      { id: "solutions_architect", title: "Solutions Architect", base_automation_prob: 0.40, task_automability: 0.36, cognitive_routine_score: 44, social_intelligence_req: 60, creative_originality_req: 65, physical_dexterity_req: 1, decision_authority: 72, regulatory_shield: 20, pivot_targets: ["cto", "product_manager", "consultant"], partial_displacement_years: 2.5, significant_displacement_years: 5.0, critical_displacement_years: 8.5, current_demand_trend: "stable", salary_percentile: 82 },
      { id: "full_stack_developer", title: "Full Stack Developer", base_automation_prob: 0.58, task_automability: 0.54, cognitive_routine_score: 60, social_intelligence_req: 32, creative_originality_req: 55, physical_dexterity_req: 2, decision_authority: 40, regulatory_shield: 12, pivot_targets: ["software_engineer", "product_manager", "solutions_architect"], partial_displacement_years: 1.5, significant_displacement_years: 3.5, critical_displacement_years: 6.0, current_demand_trend: "stable", salary_percentile: 70 },
      { id: "frontend_developer", title: "Frontend Developer", base_automation_prob: 0.62, task_automability: 0.58, cognitive_routine_score: 62, social_intelligence_req: 30, creative_originality_req: 55, physical_dexterity_req: 2, decision_authority: 32, regulatory_shield: 10, pivot_targets: ["ux_designer", "full_stack_developer", "product_manager"], partial_displacement_years: 1.5, significant_displacement_years: 3.0, critical_displacement_years: 5.5, current_demand_trend: "declining", salary_percentile: 65 },
      { id: "backend_developer", title: "Backend Developer", base_automation_prob: 0.55, task_automability: 0.50, cognitive_routine_score: 56, social_intelligence_req: 28, creative_originality_req: 52, physical_dexterity_req: 1, decision_authority: 38, regulatory_shield: 12, pivot_targets: ["software_engineer", "data_engineer", "solutions_architect"], partial_displacement_years: 1.5, significant_displacement_years: 3.5, critical_displacement_years: 6.5, current_demand_trend: "stable", salary_percentile: 68 },
      { id: "mobile_developer", title: "Mobile App Developer", base_automation_prob: 0.56, task_automability: 0.52, cognitive_routine_score: 58, social_intelligence_req: 28, creative_originality_req: 52, physical_dexterity_req: 3, decision_authority: 38, regulatory_shield: 12, pivot_targets: ["full_stack_developer", "product_manager", "ux_designer"], partial_displacement_years: 1.5, significant_displacement_years: 3.5, critical_displacement_years: 6.0, current_demand_trend: "stable", salary_percentile: 68 },
      { id: "data_engineer", title: "Data Engineer", base_automation_prob: 0.55, task_automability: 0.50, cognitive_routine_score: 58, social_intelligence_req: 30, creative_originality_req: 48, physical_dexterity_req: 1, decision_authority: 42, regulatory_shield: 15, pivot_targets: ["data_scientist", "ml_engineer", "cloud_architect"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 7.0, current_demand_trend: "stable", salary_percentile: 72 },
      { id: "it_support", title: "IT Support / Helpdesk", base_automation_prob: 0.82, task_automability: 0.78, cognitive_routine_score: 80, social_intelligence_req: 45, creative_originality_req: 15, physical_dexterity_req: 15, decision_authority: 18, regulatory_shield: 12, pivot_targets: ["network_engineer", "devops_engineer", "cybersecurity_analyst"], partial_displacement_years: 0.5, significant_displacement_years: 1.5, critical_displacement_years: 3.0, current_demand_trend: "collapsing", salary_percentile: 35 },
      { id: "ai_engineer", title: "AI Engineer / AI Developer", base_automation_prob: 0.30, task_automability: 0.28, cognitive_routine_score: 38, social_intelligence_req: 38, creative_originality_req: 75, physical_dexterity_req: 1, decision_authority: 62, regulatory_shield: 18, pivot_targets: ["ml_engineer", "cto", "product_manager"], partial_displacement_years: 3.5, significant_displacement_years: 6.0, critical_displacement_years: 10.0, current_demand_trend: "exploding", salary_percentile: 90 },
      { id: "prompt_engineer", title: "Prompt Engineer", base_automation_prob: 0.55, task_automability: 0.50, cognitive_routine_score: 55, social_intelligence_req: 32, creative_originality_req: 60, physical_dexterity_req: 1, decision_authority: 38, regulatory_shield: 8, pivot_targets: ["ai_engineer", "product_manager", "ml_engineer"], partial_displacement_years: 1.0, significant_displacement_years: 2.5, critical_displacement_years: 4.5, current_demand_trend: "growing", salary_percentile: 72 },
      { id: "no_code_developer", title: "No-Code / Low-Code Developer", base_automation_prob: 0.70, task_automability: 0.65, cognitive_routine_score: 68, social_intelligence_req: 32, creative_originality_req: 42, physical_dexterity_req: 1, decision_authority: 30, regulatory_shield: 8, pivot_targets: ["full_stack_developer", "product_manager", "software_engineer"], partial_displacement_years: 1.0, significant_displacement_years: 2.0, critical_displacement_years: 4.0, current_demand_trend: "declining", salary_percentile: 48 },

      // ── HR EXPANSION ──────────────────────────────────────────────
      { id: "hrbp", title: "HR Business Partner (HRBP)", base_automation_prob: 0.58, task_automability: 0.52, cognitive_routine_score: 55, social_intelligence_req: 82, creative_originality_req: 32, physical_dexterity_req: 2, decision_authority: 52, regulatory_shield: 45, pivot_targets: ["hr_manager", "operations_manager", "consultant"], partial_displacement_years: 2.5, significant_displacement_years: 4.5, critical_displacement_years: 7.5, current_demand_trend: "stable", salary_percentile: 60 },
      { id: "talent_acquisition", title: "Talent Acquisition Specialist", base_automation_prob: 0.68, task_automability: 0.64, cognitive_routine_score: 65, social_intelligence_req: 72, creative_originality_req: 28, physical_dexterity_req: 2, decision_authority: 38, regulatory_shield: 20, pivot_targets: ["hrbp", "hr_manager", "sales_rep"], partial_displacement_years: 1.5, significant_displacement_years: 3.0, critical_displacement_years: 5.0, current_demand_trend: "declining", salary_percentile: 52 },
      { id: "ld_manager", title: "L&D Manager / Training Manager", base_automation_prob: 0.62, task_automability: 0.56, cognitive_routine_score: 60, social_intelligence_req: 75, creative_originality_req: 48, physical_dexterity_req: 5, decision_authority: 45, regulatory_shield: 28, pivot_targets: ["hr_manager", "consultant", "product_manager"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 7.0, current_demand_trend: "stable", salary_percentile: 58 },
      { id: "hr_generalist", title: "HR Generalist", base_automation_prob: 0.72, task_automability: 0.67, cognitive_routine_score: 70, social_intelligence_req: 68, creative_originality_req: 22, physical_dexterity_req: 2, decision_authority: 32, regulatory_shield: 38, pivot_targets: ["hrbp", "talent_acquisition", "operations_manager"], partial_displacement_years: 1.5, significant_displacement_years: 3.0, critical_displacement_years: 5.5, current_demand_trend: "declining", salary_percentile: 48 },
      { id: "comp_ben", title: "Compensation & Benefits Specialist", base_automation_prob: 0.68, task_automability: 0.63, cognitive_routine_score: 68, social_intelligence_req: 48, creative_originality_req: 25, physical_dexterity_req: 1, decision_authority: 35, regulatory_shield: 42, pivot_targets: ["hr_manager", "financial_analyst", "hrbp"], partial_displacement_years: 1.5, significant_displacement_years: 3.0, critical_displacement_years: 5.5, current_demand_trend: "declining", salary_percentile: 55 },
      { id: "payroll_specialist", title: "Payroll Specialist", base_automation_prob: 0.82, task_automability: 0.78, cognitive_routine_score: 82, social_intelligence_req: 30, creative_originality_req: 10, physical_dexterity_req: 1, decision_authority: 22, regulatory_shield: 40, pivot_targets: ["accountant", "hr_generalist", "comp_ben"], partial_displacement_years: 1.0, significant_displacement_years: 2.0, critical_displacement_years: 3.5, current_demand_trend: "collapsing", salary_percentile: 40 },

      // ── SUPPLY CHAIN / OPERATIONS EXPANSION ───────────────────────
      { id: "scm_lead", title: "Supply Chain Manager", base_automation_prob: 0.58, task_automability: 0.52, cognitive_routine_score: 56, social_intelligence_req: 65, creative_originality_req: 40, physical_dexterity_req: 10, decision_authority: 65, regulatory_shield: 32, pivot_targets: ["operations_manager", "consultant", "project_manager"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 7.0, current_demand_trend: "stable", salary_percentile: 68 },
      { id: "procurement_manager", title: "Procurement Manager", base_automation_prob: 0.62, task_automability: 0.56, cognitive_routine_score: 60, social_intelligence_req: 68, creative_originality_req: 32, physical_dexterity_req: 5, decision_authority: 62, regulatory_shield: 38, pivot_targets: ["scm_lead", "operations_manager", "consultant"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 6.5, current_demand_trend: "stable", salary_percentile: 65 },
      { id: "logistics_manager", title: "Logistics Manager", base_automation_prob: 0.65, task_automability: 0.60, cognitive_routine_score: 62, social_intelligence_req: 58, creative_originality_req: 30, physical_dexterity_req: 18, decision_authority: 55, regulatory_shield: 30, pivot_targets: ["scm_lead", "operations_manager", "procurement_manager"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 6.5, current_demand_trend: "declining", salary_percentile: 60 },
      { id: "warehouse_manager", title: "Warehouse Manager", base_automation_prob: 0.72, task_automability: 0.66, cognitive_routine_score: 68, social_intelligence_req: 55, creative_originality_req: 20, physical_dexterity_req: 40, decision_authority: 52, regulatory_shield: 22, pivot_targets: ["logistics_manager", "operations_manager", "scm_lead"], partial_displacement_years: 1.5, significant_displacement_years: 3.0, critical_displacement_years: 5.5, current_demand_trend: "declining", salary_percentile: 52 },
      { id: "inventory_analyst", title: "Inventory Analyst / Demand Planner", base_automation_prob: 0.72, task_automability: 0.68, cognitive_routine_score: 72, social_intelligence_req: 32, creative_originality_req: 28, physical_dexterity_req: 5, decision_authority: 32, regulatory_shield: 18, pivot_targets: ["data_analyst", "scm_lead", "financial_analyst"], partial_displacement_years: 1.5, significant_displacement_years: 3.0, critical_displacement_years: 5.0, current_demand_trend: "declining", salary_percentile: 52 },

      // ── FINANCE EXPANSION ─────────────────────────────────────────
      { id: "finance_manager", title: "Finance Manager / CFO (SME)", base_automation_prob: 0.60, task_automability: 0.55, cognitive_routine_score: 60, social_intelligence_req: 62, creative_originality_req: 38, physical_dexterity_req: 1, decision_authority: 72, regulatory_shield: 55, pivot_targets: ["consultant", "ceo", "financial_analyst"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 7.0, current_demand_trend: "stable", salary_percentile: 72 },
      { id: "cost_accountant", title: "Cost Accountant", base_automation_prob: 0.80, task_automability: 0.75, cognitive_routine_score: 80, social_intelligence_req: 25, creative_originality_req: 15, physical_dexterity_req: 1, decision_authority: 28, regulatory_shield: 48, pivot_targets: ["accountant", "financial_analyst", "finance_manager"], partial_displacement_years: 1.0, significant_displacement_years: 2.5, critical_displacement_years: 4.5, current_demand_trend: "declining", salary_percentile: 52 },
      { id: "treasury_analyst", title: "Treasury Analyst", base_automation_prob: 0.72, task_automability: 0.66, cognitive_routine_score: 72, social_intelligence_req: 32, creative_originality_req: 25, physical_dexterity_req: 1, decision_authority: 35, regulatory_shield: 48, pivot_targets: ["financial_analyst", "finance_manager", "risk_manager"], partial_displacement_years: 1.5, significant_displacement_years: 3.0, critical_displacement_years: 5.5, current_demand_trend: "declining", salary_percentile: 60 },
      { id: "internal_auditor", title: "Internal Auditor", base_automation_prob: 0.70, task_automability: 0.64, cognitive_routine_score: 70, social_intelligence_req: 45, creative_originality_req: 28, physical_dexterity_req: 1, decision_authority: 48, regulatory_shield: 62, pivot_targets: ["accountant", "consultant", "compliance_officer"], partial_displacement_years: 1.5, significant_displacement_years: 3.5, critical_displacement_years: 6.0, current_demand_trend: "declining", salary_percentile: 60 },

      // ── MARKETING EXPANSION ───────────────────────────────────────
      { id: "performance_marketer", title: "Performance Marketing Manager", base_automation_prob: 0.68, task_automability: 0.62, cognitive_routine_score: 65, social_intelligence_req: 48, creative_originality_req: 55, physical_dexterity_req: 2, decision_authority: 52, regulatory_shield: 10, pivot_targets: ["marketing_manager", "product_manager", "data_analyst"], partial_displacement_years: 1.5, significant_displacement_years: 3.0, critical_displacement_years: 5.0, current_demand_trend: "declining", salary_percentile: 65 },
      { id: "seo_specialist", title: "SEO / SEM Specialist", base_automation_prob: 0.72, task_automability: 0.67, cognitive_routine_score: 70, social_intelligence_req: 32, creative_originality_req: 45, physical_dexterity_req: 1, decision_authority: 32, regulatory_shield: 8, pivot_targets: ["performance_marketer", "content_writer", "marketing_manager"], partial_displacement_years: 1.0, significant_displacement_years: 2.5, critical_displacement_years: 4.0, current_demand_trend: "collapsing", salary_percentile: 50 },
      { id: "brand_manager", title: "Brand Manager", base_automation_prob: 0.52, task_automability: 0.48, cognitive_routine_score: 52, social_intelligence_req: 65, creative_originality_req: 68, physical_dexterity_req: 2, decision_authority: 58, regulatory_shield: 12, pivot_targets: ["marketing_manager", "product_manager", "consultant"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 7.0, current_demand_trend: "stable", salary_percentile: 68 },
      { id: "social_media_manager", title: "Social Media Manager", base_automation_prob: 0.72, task_automability: 0.68, cognitive_routine_score: 70, social_intelligence_req: 58, creative_originality_req: 55, physical_dexterity_req: 2, decision_authority: 30, regulatory_shield: 8, pivot_targets: ["content_writer", "marketing_manager", "brand_manager"], partial_displacement_years: 1.0, significant_displacement_years: 2.0, critical_displacement_years: 3.5, current_demand_trend: "collapsing", salary_percentile: 42 },
      { id: "email_marketer", title: "Email Marketing Specialist", base_automation_prob: 0.78, task_automability: 0.72, cognitive_routine_score: 75, social_intelligence_req: 35, creative_originality_req: 42, physical_dexterity_req: 1, decision_authority: 25, regulatory_shield: 8, pivot_targets: ["performance_marketer", "marketing_manager", "content_writer"], partial_displacement_years: 1.0, significant_displacement_years: 2.0, critical_displacement_years: 3.5, current_demand_trend: "collapsing", salary_percentile: 42 },

      // ── MANUFACTURING / ENGINEERING EXPANSION ─────────────────────
      { id: "production_engineer", title: "Production Engineer", base_automation_prob: 0.55, task_automability: 0.50, cognitive_routine_score: 55, social_intelligence_req: 42, creative_originality_req: 45, physical_dexterity_req: 40, decision_authority: 52, regulatory_shield: 38, pivot_targets: ["process_engineer", "quality_engineer", "operations_manager"], partial_displacement_years: 2.5, significant_displacement_years: 5.0, critical_displacement_years: 8.0, current_demand_trend: "stable", salary_percentile: 62 },
      { id: "quality_engineer", title: "Quality Engineer / QA Manager", base_automation_prob: 0.52, task_automability: 0.47, cognitive_routine_score: 52, social_intelligence_req: 48, creative_originality_req: 42, physical_dexterity_req: 35, decision_authority: 55, regulatory_shield: 52, pivot_targets: ["production_engineer", "process_engineer", "consultant"], partial_displacement_years: 2.5, significant_displacement_years: 5.0, critical_displacement_years: 8.5, current_demand_trend: "stable", salary_percentile: 65 },
      { id: "safety_engineer", title: "Safety Engineer / HSE Officer", base_automation_prob: 0.42, task_automability: 0.38, cognitive_routine_score: 44, social_intelligence_req: 60, creative_originality_req: 38, physical_dexterity_req: 42, decision_authority: 62, regulatory_shield: 72, pivot_targets: ["quality_engineer", "operations_manager", "consultant"], partial_displacement_years: 3.0, significant_displacement_years: 6.0, critical_displacement_years: 10.0, current_demand_trend: "stable", salary_percentile: 65 },
      { id: "process_engineer", title: "Process Engineer", base_automation_prob: 0.50, task_automability: 0.45, cognitive_routine_score: 52, social_intelligence_req: 42, creative_originality_req: 50, physical_dexterity_req: 30, decision_authority: 55, regulatory_shield: 40, pivot_targets: ["production_engineer", "quality_engineer", "consultant"], partial_displacement_years: 2.5, significant_displacement_years: 5.0, critical_displacement_years: 8.0, current_demand_trend: "stable", salary_percentile: 64 },

      // ── SALES EXPANSION ───────────────────────────────────────────
      { id: "account_executive", title: "Account Executive", base_automation_prob: 0.52, task_automability: 0.48, cognitive_routine_score: 50, social_intelligence_req: 82, creative_originality_req: 45, physical_dexterity_req: 8, decision_authority: 55, regulatory_shield: 15, pivot_targets: ["sales_manager", "consultant", "bdm"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 7.0, current_demand_trend: "stable", salary_percentile: 68 },
      { id: "sales_manager", title: "Sales Manager", base_automation_prob: 0.48, task_automability: 0.44, cognitive_routine_score: 48, social_intelligence_req: 82, creative_originality_req: 42, physical_dexterity_req: 8, decision_authority: 68, regulatory_shield: 18, pivot_targets: ["account_executive", "bdm", "operations_manager"], partial_displacement_years: 2.5, significant_displacement_years: 4.5, critical_displacement_years: 7.5, current_demand_trend: "stable", salary_percentile: 70 },
      { id: "key_account_manager", title: "Key Account Manager", base_automation_prob: 0.45, task_automability: 0.40, cognitive_routine_score: 45, social_intelligence_req: 85, creative_originality_req: 45, physical_dexterity_req: 8, decision_authority: 60, regulatory_shield: 18, pivot_targets: ["account_executive", "consultant", "sales_manager"], partial_displacement_years: 2.5, significant_displacement_years: 5.0, critical_displacement_years: 8.0, current_demand_trend: "stable", salary_percentile: 72 },
      { id: "inside_sales", title: "Inside Sales Representative", base_automation_prob: 0.72, task_automability: 0.66, cognitive_routine_score: 68, social_intelligence_req: 72, creative_originality_req: 28, physical_dexterity_req: 2, decision_authority: 32, regulatory_shield: 10, pivot_targets: ["account_executive", "sales_manager", "sales_rep"], partial_displacement_years: 1.0, significant_displacement_years: 2.5, critical_displacement_years: 4.0, current_demand_trend: "collapsing", salary_percentile: 45 },
      { id: "bdm", title: "Business Development Manager", base_automation_prob: 0.50, task_automability: 0.45, cognitive_routine_score: 50, social_intelligence_req: 80, creative_originality_req: 50, physical_dexterity_req: 5, decision_authority: 62, regulatory_shield: 18, pivot_targets: ["sales_manager", "consultant", "product_manager"], partial_displacement_years: 2.5, significant_displacement_years: 5.0, critical_displacement_years: 8.0, current_demand_trend: "stable", salary_percentile: 68 },

      // ── STRATEGY / MANAGEMENT EXPANSION ──────────────────────────
      { id: "management_consultant", title: "Management Consultant", base_automation_prob: 0.50, task_automability: 0.45, cognitive_routine_score: 50, social_intelligence_req: 75, creative_originality_req: 60, physical_dexterity_req: 2, decision_authority: 68, regulatory_shield: 28, pivot_targets: ["consultant", "product_manager", "cto"], partial_displacement_years: 2.5, significant_displacement_years: 4.5, critical_displacement_years: 7.5, current_demand_trend: "stable", salary_percentile: 78 },
      { id: "strategy_analyst", title: "Strategy Analyst / Corporate Strategy", base_automation_prob: 0.62, task_automability: 0.56, cognitive_routine_score: 60, social_intelligence_req: 55, creative_originality_req: 58, physical_dexterity_req: 1, decision_authority: 45, regulatory_shield: 20, pivot_targets: ["management_consultant", "product_manager", "data_scientist"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 6.5, current_demand_trend: "stable", salary_percentile: 70 },
      { id: "program_manager", title: "Program Manager / PMO Lead", base_automation_prob: 0.55, task_automability: 0.50, cognitive_routine_score: 55, social_intelligence_req: 70, creative_originality_req: 38, physical_dexterity_req: 2, decision_authority: 65, regulatory_shield: 22, pivot_targets: ["project_manager", "operations_manager", "product_manager"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 7.0, current_demand_trend: "stable", salary_percentile: 68 },
      { id: "change_manager", title: "Change Manager / OD Specialist", base_automation_prob: 0.50, task_automability: 0.44, cognitive_routine_score: 48, social_intelligence_req: 80, creative_originality_req: 55, physical_dexterity_req: 2, decision_authority: 55, regulatory_shield: 25, pivot_targets: ["consultant", "hr_manager", "program_manager"], partial_displacement_years: 2.5, significant_displacement_years: 5.0, critical_displacement_years: 8.5, current_demand_trend: "stable", salary_percentile: 68 },

      // ── CUSTOMER SUCCESS ──────────────────────────────────────────
      { id: "customer_success", title: "Customer Success Manager", base_automation_prob: 0.55, task_automability: 0.50, cognitive_routine_score: 55, social_intelligence_req: 80, creative_originality_req: 35, physical_dexterity_req: 2, decision_authority: 48, regulatory_shield: 12, pivot_targets: ["account_executive", "product_manager", "consultant"], partial_displacement_years: 2.0, significant_displacement_years: 3.5, critical_displacement_years: 6.0, current_demand_trend: "stable", salary_percentile: 62 },
      { id: "implementation_consultant", title: "Implementation Consultant / Solutions Consultant", base_automation_prob: 0.52, task_automability: 0.47, cognitive_routine_score: 52, social_intelligence_req: 72, creative_originality_req: 48, physical_dexterity_req: 2, decision_authority: 50, regulatory_shield: 18, pivot_targets: ["solutions_architect", "customer_success", "management_consultant"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 7.0, current_demand_trend: "stable", salary_percentile: 68 },

      // ── COMPLIANCE / LEGAL ────────────────────────────────────────
      { id: "compliance_officer", title: "Compliance Officer", base_automation_prob: 0.52, task_automability: 0.46, cognitive_routine_score: 55, social_intelligence_req: 58, creative_originality_req: 40, physical_dexterity_req: 1, decision_authority: 62, regulatory_shield: 78, pivot_targets: ["lawyer", "internal_auditor", "consultant"], partial_displacement_years: 2.5, significant_displacement_years: 5.0, critical_displacement_years: 9.0, current_demand_trend: "growing", salary_percentile: 72 },
      { id: "legal_associate", title: "Legal Associate / Corporate Lawyer", base_automation_prob: 0.62, task_automability: 0.56, cognitive_routine_score: 62, social_intelligence_req: 58, creative_originality_req: 48, physical_dexterity_req: 1, decision_authority: 55, regulatory_shield: 82, pivot_targets: ["lawyer", "compliance_officer", "consultant"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 7.5, current_demand_trend: "declining", salary_percentile: 68 },

      // ── MEDIA / CONTENT ───────────────────────────────────────────
      { id: "digital_content_creator", title: "Digital Content Creator / YouTuber", base_automation_prob: 0.60, task_automability: 0.55, cognitive_routine_score: 58, social_intelligence_req: 62, creative_originality_req: 80, physical_dexterity_req: 15, decision_authority: 45, regulatory_shield: 8, pivot_targets: ["brand_manager", "marketing_manager", "content_writer"], partial_displacement_years: 2.0, significant_displacement_years: 3.5, critical_displacement_years: 6.0, current_demand_trend: "stable", salary_percentile: 45 },
      { id: "journalist", title: "Journalist / Editor", base_automation_prob: 0.68, task_automability: 0.62, cognitive_routine_score: 65, social_intelligence_req: 58, creative_originality_req: 72, physical_dexterity_req: 5, decision_authority: 52, regulatory_shield: 25, pivot_targets: ["content_writer", "pr_specialist", "consultant"], partial_displacement_years: 1.0, significant_displacement_years: 2.5, critical_displacement_years: 4.5, current_demand_trend: "collapsing", salary_percentile: 48 },
      { id: "pr_specialist", title: "PR & Communications Specialist", base_automation_prob: 0.55, task_automability: 0.50, cognitive_routine_score: 55, social_intelligence_req: 78, creative_originality_req: 62, physical_dexterity_req: 2, decision_authority: 45, regulatory_shield: 18, pivot_targets: ["marketing_manager", "brand_manager", "consultant"], partial_displacement_years: 2.0, significant_displacement_years: 3.5, critical_displacement_years: 6.0, current_demand_trend: "declining", salary_percentile: 55 },

      // ── HEALTHCARE ADJACENT (INDIAN MARKET) ───────────────────────
      { id: "medical_coder", title: "Medical Coder / Medical Biller", base_automation_prob: 0.82, task_automability: 0.77, cognitive_routine_score: 80, social_intelligence_req: 22, creative_originality_req: 10, physical_dexterity_req: 5, decision_authority: 18, regulatory_shield: 48, pivot_targets: ["compliance_officer", "data_analyst", "internal_auditor"], partial_displacement_years: 0.5, significant_displacement_years: 1.5, critical_displacement_years: 3.0, current_demand_trend: "collapsing", salary_percentile: 32 },
      { id: "clinical_data_manager", title: "Clinical Data Manager", base_automation_prob: 0.55, task_automability: 0.50, cognitive_routine_score: 58, social_intelligence_req: 42, creative_originality_req: 35, physical_dexterity_req: 2, decision_authority: 52, regulatory_shield: 68, pivot_targets: ["data_analyst", "compliance_officer", "researcher"], partial_displacement_years: 2.0, significant_displacement_years: 4.5, critical_displacement_years: 8.0, current_demand_trend: "stable", salary_percentile: 62 },
      { id: "pharma_sales_rep", title: "Pharma Sales Representative / MR", base_automation_prob: 0.58, task_automability: 0.52, cognitive_routine_score: 58, social_intelligence_req: 78, creative_originality_req: 32, physical_dexterity_req: 15, decision_authority: 30, regulatory_shield: 35, pivot_targets: ["sales_manager", "bdm", "key_account_manager"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 6.5, current_demand_trend: "declining", salary_percentile: 50 },

      // ── ADMINISTRATIVE ────────────────────────────────────────────
      { id: "executive_assistant", title: "Executive Assistant", base_automation_prob: 0.80, task_automability: 0.75, cognitive_routine_score: 78, social_intelligence_req: 65, creative_originality_req: 18, physical_dexterity_req: 5, decision_authority: 18, regulatory_shield: 12, pivot_targets: ["office_manager", "project_manager", "hr_generalist"], partial_displacement_years: 1.0, significant_displacement_years: 2.0, critical_displacement_years: 3.5, current_demand_trend: "collapsing", salary_percentile: 38 },
      { id: "office_manager", title: "Office Manager / Admin Manager", base_automation_prob: 0.75, task_automability: 0.70, cognitive_routine_score: 72, social_intelligence_req: 60, creative_originality_req: 18, physical_dexterity_req: 10, decision_authority: 30, regulatory_shield: 15, pivot_targets: ["operations_manager", "hr_generalist", "project_manager"], partial_displacement_years: 1.0, significant_displacement_years: 2.5, critical_displacement_years: 4.5, current_demand_trend: "collapsing", salary_percentile: 38 },

      // ── BPO / KPO (INDIAN MARKET — ACUTE DISPLACEMENT ALREADY UNDERWAY) ──────
      // These roles represent ~1.4M Indian white-collar jobs in the highest-risk segment.
      // partial_displacement_years: 0 = already in the yellow zone as of 2026.
      // Sources: NASSCOM AI Impact Report 2025, Accenture India Workforce Study 2024.
      { id: "voice_process_executive", title: "Voice Process Executive / Call Centre Agent", base_automation_prob: 0.92, task_automability: 0.88, cognitive_routine_score: 88, social_intelligence_req: 55, creative_originality_req: 8, physical_dexterity_req: 2, decision_authority: 12, regulatory_shield: 8, pivot_targets: ["customer_success", "inside_sales", "ux_designer"], partial_displacement_years: 0, significant_displacement_years: 1.0, critical_displacement_years: 2.5, current_demand_trend: "collapsing", salary_percentile: 22 },
      { id: "data_entry_specialist", title: "Data Entry Specialist / Back Office Executive", base_automation_prob: 0.94, task_automability: 0.91, cognitive_routine_score: 92, social_intelligence_req: 18, creative_originality_req: 5, physical_dexterity_req: 8, decision_authority: 8, regulatory_shield: 10, pivot_targets: ["data_analyst", "hr_generalist", "compliance_officer"], partial_displacement_years: 0, significant_displacement_years: 0.5, critical_displacement_years: 2.0, current_demand_trend: "collapsing", salary_percentile: 18 },
      { id: "kyc_aml_analyst", title: "KYC / AML Analyst", base_automation_prob: 0.80, task_automability: 0.75, cognitive_routine_score: 78, social_intelligence_req: 28, creative_originality_req: 18, physical_dexterity_req: 1, decision_authority: 22, regulatory_shield: 55, pivot_targets: ["compliance_officer", "internal_auditor", "legal_associate"], partial_displacement_years: 0, significant_displacement_years: 1.5, critical_displacement_years: 3.5, current_demand_trend: "collapsing", salary_percentile: 38 },
      { id: "claims_processing_analyst", title: "Claims Processing Analyst", base_automation_prob: 0.86, task_automability: 0.82, cognitive_routine_score: 84, social_intelligence_req: 22, creative_originality_req: 10, physical_dexterity_req: 1, decision_authority: 18, regulatory_shield: 42, pivot_targets: ["compliance_officer", "data_analyst", "internal_auditor"], partial_displacement_years: 0, significant_displacement_years: 1.0, critical_displacement_years: 2.5, current_demand_trend: "collapsing", salary_percentile: 30 },
      { id: "medical_transcriptionist", title: "Medical Transcriptionist", base_automation_prob: 0.88, task_automability: 0.85, cognitive_routine_score: 86, social_intelligence_req: 15, creative_originality_req: 8, physical_dexterity_req: 3, decision_authority: 10, regulatory_shield: 40, pivot_targets: ["clinical_data_manager", "medical_coder", "data_analyst"], partial_displacement_years: 0, significant_displacement_years: 0.5, critical_displacement_years: 2.0, current_demand_trend: "collapsing", salary_percentile: 28 },
      { id: "insurance_data_processor", title: "Insurance Data Processor / Underwriting Support", base_automation_prob: 0.84, task_automability: 0.80, cognitive_routine_score: 82, social_intelligence_req: 20, creative_originality_req: 12, physical_dexterity_req: 1, decision_authority: 15, regulatory_shield: 45, pivot_targets: ["compliance_officer", "financial_analyst", "data_analyst"], partial_displacement_years: 0, significant_displacement_years: 1.0, critical_displacement_years: 2.5, current_demand_trend: "collapsing", salary_percentile: 32 },
      { id: "chat_support_specialist", title: "Chat Support Specialist / Digital Customer Support", base_automation_prob: 0.94, task_automability: 0.91, cognitive_routine_score: 90, social_intelligence_req: 50, creative_originality_req: 10, physical_dexterity_req: 1, decision_authority: 12, regulatory_shield: 8, pivot_targets: ["customer_success", "ux_designer", "sales_rep"], partial_displacement_years: 0, significant_displacement_years: 0.5, critical_displacement_years: 1.5, current_demand_trend: "collapsing", salary_percentile: 20 },
      { id: "kpo_research_analyst", title: "KPO Research Analyst / Equity Research Associate", base_automation_prob: 0.72, task_automability: 0.66, cognitive_routine_score: 70, social_intelligence_req: 30, creative_originality_req: 35, physical_dexterity_req: 1, decision_authority: 28, regulatory_shield: 25, pivot_targets: ["data_scientist", "financial_analyst", "strategy_analyst"], partial_displacement_years: 1.0, significant_displacement_years: 2.5, critical_displacement_years: 4.5, current_demand_trend: "declining", salary_percentile: 52 },
      { id: "bpo_team_leader", title: "BPO Team Leader / Process Trainer", base_automation_prob: 0.68, task_automability: 0.60, cognitive_routine_score: 62, social_intelligence_req: 68, creative_originality_req: 22, physical_dexterity_req: 2, decision_authority: 35, regulatory_shield: 12, pivot_targets: ["operations_manager", "hr_manager", "customer_success"], partial_displacement_years: 1.0, significant_displacement_years: 2.5, critical_displacement_years: 4.5, current_demand_trend: "declining", salary_percentile: 35 },

      // ── GOVERNMENT / PSU (INDIA-SPECIFIC) ──────────────────────────────────
      // Lowest-risk segment of Indian employment — regulatory shields, job security, tenure.
      { id: "government_officer", title: "Government Officer / IAS/IPS/IFS Officer", base_automation_prob: 0.22, task_automability: 0.18, cognitive_routine_score: 30, social_intelligence_req: 72, creative_originality_req: 45, physical_dexterity_req: 8, decision_authority: 82, regulatory_shield: 98, pivot_targets: ["consultant", "ngo_director", "policy_analyst"], partial_displacement_years: 8.0, significant_displacement_years: 15.0, critical_displacement_years: 25.0, current_demand_trend: "stable", salary_percentile: 55 },
      { id: "psu_engineer", title: "PSU Engineer / Government Technical Officer", base_automation_prob: 0.38, task_automability: 0.32, cognitive_routine_score: 40, social_intelligence_req: 48, creative_originality_req: 35, physical_dexterity_req: 28, decision_authority: 55, regulatory_shield: 88, pivot_targets: ["production_engineer", "consultant", "solutions_architect"], partial_displacement_years: 4.0, significant_displacement_years: 8.0, critical_displacement_years: 15.0, current_demand_trend: "stable", salary_percentile: 50 },
      { id: "bank_clerk_probationary", title: "Bank Clerk / Probationary Officer (PSB)", base_automation_prob: 0.72, task_automability: 0.65, cognitive_routine_score: 68, social_intelligence_req: 52, creative_originality_req: 18, physical_dexterity_req: 5, decision_authority: 22, regulatory_shield: 75, pivot_targets: ["financial_analyst", "compliance_officer", "data_analyst"], partial_displacement_years: 2.0, significant_displacement_years: 4.0, critical_displacement_years: 8.0, current_demand_trend: "declining", salary_percentile: 42 },
    ];
    for (const r of roles) {
      this.roles.set(r.title, r);
      this.roles.set(r.id, r);
    }
  }

  private _loadSkills() {
    const skills: SkillNode[] = [
      { id: "excel_basic", name: "Excel (Basic)", category: "technical", half_life_years: 1.5, current_demand: "declining", ai_replication_difficulty: 15, scarcity_score: 10, synergy_with_ai: false },
      { id: "sql_basic", name: "SQL (Basic)", category: "technical", half_life_years: 2.0, current_demand: "declining", ai_replication_difficulty: 20, scarcity_score: 15, synergy_with_ai: false },
      { id: "data_entry", name: "Data Entry", category: "technical", half_life_years: 0.5, current_demand: "obsolete", ai_replication_difficulty: 5, scarcity_score: 5, synergy_with_ai: false },
      { id: "report_writing", name: "Report Writing", category: "analytical", half_life_years: 1.0, current_demand: "declining", ai_replication_difficulty: 12, scarcity_score: 10, synergy_with_ai: false },
      { id: "powerpoint", name: "PowerPoint", category: "technical", half_life_years: 1.0, current_demand: "declining", ai_replication_difficulty: 8, scarcity_score: 8, synergy_with_ai: false },
      { id: "python", name: "Python", category: "technical", half_life_years: 3.5, current_demand: "stable", ai_replication_difficulty: 35, scarcity_score: 40, synergy_with_ai: true },
      { id: "sql_advanced", name: "SQL (Advanced)", category: "technical", half_life_years: 3.0, current_demand: "stable", ai_replication_difficulty: 38, scarcity_score: 35, synergy_with_ai: true },
      { id: "data_visualization", name: "Data Visualization", category: "analytical", half_life_years: 2.5, current_demand: "stable", ai_replication_difficulty: 30, scarcity_score: 38, synergy_with_ai: true },
      { id: "project_management", name: "Project Management", category: "analytical", half_life_years: 4.0, current_demand: "stable", ai_replication_difficulty: 42, scarcity_score: 32, synergy_with_ai: true },
      { id: "financial_modeling", name: "Financial Modeling", category: "analytical", half_life_years: 2.5, current_demand: "declining", ai_replication_difficulty: 28, scarcity_score: 35, synergy_with_ai: false },
      { id: "prompt_engineering", name: "Prompt Engineering", category: "technical", half_life_years: 1.5, current_demand: "growing", ai_replication_difficulty: 25, scarcity_score: 55, synergy_with_ai: true },
      { id: "llm_fine_tuning", name: "LLM Fine-tuning", category: "technical", half_life_years: 2.5, current_demand: "exploding", ai_replication_difficulty: 60, scarcity_score: 80, synergy_with_ai: true },
      { id: "rag_systems", name: "RAG Systems", category: "technical", half_life_years: 2.0, current_demand: "exploding", ai_replication_difficulty: 62, scarcity_score: 82, synergy_with_ai: true },
      { id: "ml_ops", name: "MLOps", category: "technical", half_life_years: 3.0, current_demand: "exploding", ai_replication_difficulty: 65, scarcity_score: 85, synergy_with_ai: true },
      { id: "ai_product_design", name: "AI Product Design", category: "creative", half_life_years: 3.0, current_demand: "exploding", ai_replication_difficulty: 68, scarcity_score: 88, synergy_with_ai: true },
      { id: "vector_databases", name: "Vector Databases", category: "technical", half_life_years: 2.5, current_demand: "exploding", ai_replication_difficulty: 60, scarcity_score: 85, synergy_with_ai: true },
      { id: "agentic_ai", name: "Agentic AI Systems", category: "technical", half_life_years: 2.0, current_demand: "exploding", ai_replication_difficulty: 70, scarcity_score: 90, synergy_with_ai: true },
      { id: "stakeholder_management", name: "Stakeholder Management", category: "social", half_life_years: 8.0, current_demand: "stable", ai_replication_difficulty: 85, scarcity_score: 55, synergy_with_ai: true },
      { id: "strategic_thinking", name: "Strategic Thinking", category: "analytical", half_life_years: 7.0, current_demand: "growing", ai_replication_difficulty: 88, scarcity_score: 60, synergy_with_ai: true },
      { id: "systems_thinking", name: "Systems Thinking", category: "analytical", half_life_years: 7.0, current_demand: "growing", ai_replication_difficulty: 85, scarcity_score: 58, synergy_with_ai: true },
      { id: "negotiation", name: "Negotiation", category: "social", half_life_years: 9.0, current_demand: "stable", ai_replication_difficulty: 90, scarcity_score: 52, synergy_with_ai: true },
      { id: "team_leadership", name: "Team Leadership", category: "social", half_life_years: 8.0, current_demand: "stable", ai_replication_difficulty: 88, scarcity_score: 50, synergy_with_ai: true },
      { id: "change_management", name: "Change Management", category: "social", half_life_years: 7.0, current_demand: "growing", ai_replication_difficulty: 82, scarcity_score: 55, synergy_with_ai: true },
      { id: "ethical_judgment", name: "Ethical Judgment", category: "social", half_life_years: 10.0, current_demand: "growing", ai_replication_difficulty: 95, scarcity_score: 65, synergy_with_ai: true },
      { id: "cross_cultural", name: "Cross-Cultural Communication", category: "social", half_life_years: 8.0, current_demand: "stable", ai_replication_difficulty: 88, scarcity_score: 48, synergy_with_ai: true },
      { id: "ux_research", name: "UX Research", category: "creative", half_life_years: 4.0, current_demand: "stable", ai_replication_difficulty: 72, scarcity_score: 58, synergy_with_ai: true },
      { id: "design_systems", name: "Design Systems", category: "creative", half_life_years: 3.0, current_demand: "stable", ai_replication_difficulty: 65, scarcity_score: 52, synergy_with_ai: true },
      { id: "brand_strategy", name: "Brand Strategy", category: "creative", half_life_years: 5.0, current_demand: "stable", ai_replication_difficulty: 78, scarcity_score: 55, synergy_with_ai: true },
      { id: "domain_expertise_legal", name: "Legal Domain Expertise", category: "analytical", half_life_years: 8.0, current_demand: "stable", ai_replication_difficulty: 88, scarcity_score: 65, synergy_with_ai: true },
      { id: "domain_expertise_medical", name: "Clinical Judgment", category: "analytical", half_life_years: 10.0, current_demand: "growing", ai_replication_difficulty: 95, scarcity_score: 70, synergy_with_ai: true },
    ];
    for (const s of skills) {
      this.skills.set(s.id, s);
      this.skills.set(s.name.toLowerCase(), s);
    }
  }

  private _loadAIThreats() {
    const threats: AIToolThreat[] = [
      { id: "copilot", name: "GitHub Copilot / Cursor", vendor: "Microsoft / Anysphere", threatens_roles: ["software_engineer", "data_scientist", "ml_engineer"], threatens_tasks: ["code writing", "debugging", "code review", "boilerplate generation"], deployment_maturity: "mainstream", replacement_pct: 0.45, eta_mainstream: "now", severity_score: 7 },
      { id: "claude_analyst", name: "Claude / ChatGPT (Analysis)", vendor: "Anthropic / OpenAI", threatens_roles: ["financial_analyst", "business_analyst", "data_analyst", "consultant"], threatens_tasks: ["report writing", "data summarization", "research synthesis", "presentation prep"], deployment_maturity: "mainstream", replacement_pct: 0.60, eta_mainstream: "now", severity_score: 8 },
      { id: "harvey_legal", name: "Harvey AI", vendor: "Harvey", threatens_roles: ["lawyer"], threatens_tasks: ["contract review", "legal research", "due diligence", "draft documents"], deployment_maturity: "maturing", replacement_pct: 0.55, eta_mainstream: "1-2 years", severity_score: 8 },
      { id: "intercom_ai", name: "Intercom / Zendesk AI", vendor: "Intercom / Zendesk", threatens_roles: ["customer_support", "recruiter"], threatens_tasks: ["ticket resolution", "FAQ answering", "email response", "issue triage"], deployment_maturity: "mainstream", replacement_pct: 0.80, eta_mainstream: "now", severity_score: 9 },
      { id: "midjourney_adobe", name: "Midjourney / Adobe Firefly", vendor: "Midjourney / Adobe", threatens_roles: ["graphic_designer", "content_writer"], threatens_tasks: ["image creation", "layout generation", "asset production"], deployment_maturity: "mainstream", replacement_pct: 0.65, eta_mainstream: "now", severity_score: 8 },
      { id: "jasper_copy", name: "Jasper / Copy.ai", vendor: "Jasper", threatens_roles: ["content_writer", "marketing_manager"], threatens_tasks: ["blog writing", "ad copy", "email campaigns", "social content"], deployment_maturity: "mainstream", replacement_pct: 0.70, eta_mainstream: "now", severity_score: 8 },
      { id: "workday_ai", name: "Workday AI / Eightfold", vendor: "Workday / Eightfold", threatens_roles: ["recruiter", "hr_manager"], threatens_tasks: ["CV screening", "candidate matching", "onboarding", "performance reviews"], deployment_maturity: "maturing", replacement_pct: 0.65, eta_mainstream: "1-2 years", severity_score: 8 },
      { id: "kensho_finance", name: "Kensho / Bloomberg AI", vendor: "S&P / Bloomberg", threatens_roles: ["financial_analyst", "accountant"], threatens_tasks: ["financial modeling", "earnings analysis", "market research", "accounting reconciliation"], deployment_maturity: "maturing", replacement_pct: 0.70, eta_mainstream: "1-2 years", severity_score: 9 },
      { id: "devin_swe_agent", name: "Devin / SWE-Agent", vendor: "Cognition / Princeton", threatens_roles: ["software_engineer", "data_analyst"], threatens_tasks: ["end-to-end feature development", "bug fixing", "testing", "documentation"], deployment_maturity: "early", replacement_pct: 0.35, eta_mainstream: "2-4 years", severity_score: 9 },
      { id: "salesforce_einstein", name: "Salesforce Einstein / 11x AI", vendor: "Salesforce / 11x", threatens_roles: ["sales_rep", "marketing_manager"], threatens_tasks: ["lead scoring", "outreach emails", "pipeline management", "forecasting"], deployment_maturity: "mainstream", replacement_pct: 0.55, eta_mainstream: "now", severity_score: 7 },
    ];
    for (const t of threats) {
      this.ai_threats.set(t.id, t);
    }
  }

  private _loadIndustries() {
    const industries: IndustryNode[] = [
      { id: "finance", name: "Finance & Banking", disruption_velocity: 0.82, ai_investment_index: 2.8, regulatory_barrier: 0.55, data_availability: 0.88, workforce_pct_at_risk_2027: 0.42, workforce_pct_at_risk_2030: 0.68, safe_harbors: ["Relationship Banker", "Investment Advisor", "Risk Officer"] },
      { id: "accounting", name: "Accounting", disruption_velocity: 0.88, ai_investment_index: 2.2, regulatory_barrier: 0.50, data_availability: 0.92, workforce_pct_at_risk_2027: 0.55, workforce_pct_at_risk_2030: 0.78, safe_harbors: ["Tax Strategist", "Forensic Accountant"] },
      { id: "legal", name: "Legal", disruption_velocity: 0.68, ai_investment_index: 1.8, regulatory_barrier: 0.75, data_availability: 0.82, workforce_pct_at_risk_2027: 0.35, workforce_pct_at_risk_2030: 0.55, safe_harbors: ["Trial Lawyer", "Partner/Rainmaker", "Legal Strategist"] },
      { id: "software_engineering", name: "Software Engineering", disruption_velocity: 0.55, ai_investment_index: 3.5, regulatory_barrier: 0.20, data_availability: 0.78, workforce_pct_at_risk_2027: 0.32, workforce_pct_at_risk_2030: 0.52, safe_harbors: ["AI Engineer", "Systems Architect", "Engineering Manager"] },
      { id: "data_science", name: "Data Science", disruption_velocity: 0.48, ai_investment_index: 3.2, regulatory_barrier: 0.18, data_availability: 0.72, workforce_pct_at_risk_2027: 0.28, workforce_pct_at_risk_2030: 0.45, safe_harbors: ["ML Researcher", "AI Ethics Officer", "Data Strategy Lead"] },
      { id: "marketing", name: "Marketing", disruption_velocity: 0.65, ai_investment_index: 2.5, regulatory_barrier: 0.22, data_availability: 0.85, workforce_pct_at_risk_2027: 0.45, workforce_pct_at_risk_2030: 0.68, safe_harbors: ["Brand Strategist", "CMO", "Creative Director"] },
      { id: "customer_service", name: "Customer Service", disruption_velocity: 0.90, ai_investment_index: 2.0, regulatory_barrier: 0.15, data_availability: 0.95, workforce_pct_at_risk_2027: 0.65, workforce_pct_at_risk_2030: 0.85, safe_harbors: ["CX Strategist", "VIP/Complex Case Manager"] },
      { id: "healthcare", name: "Healthcare", disruption_velocity: 0.38, ai_investment_index: 1.8, regulatory_barrier: 0.85, data_availability: 0.60, workforce_pct_at_risk_2027: 0.18, workforce_pct_at_risk_2030: 0.30, safe_harbors: ["Surgeon", "Therapist", "Care Coordinator"] },
      { id: "hr_recruiting", name: "HR & Recruiting", disruption_velocity: 0.70, ai_investment_index: 1.5, regulatory_barrier: 0.30, data_availability: 0.85, workforce_pct_at_risk_2027: 0.48, workforce_pct_at_risk_2030: 0.70, safe_harbors: ["CHRO", "Culture Architect", "Executive Coach"] },
      { id: "consulting", name: "Consulting", disruption_velocity: 0.55, ai_investment_index: 2.0, regulatory_barrier: 0.38, data_availability: 0.78, workforce_pct_at_risk_2027: 0.32, workforce_pct_at_risk_2030: 0.50, safe_harbors: ["Partner/Principal", "Industry Expert", "Client Relationship Lead"] },
      { id: "real_estate", name: "Real Estate", disruption_velocity: 0.58, ai_investment_index: 1.5, regulatory_barrier: 0.40, data_availability: 0.75, workforce_pct_at_risk_2027: 0.38, workforce_pct_at_risk_2030: 0.58, safe_harbors: ["Luxury Broker", "Development Manager"] },
      { id: "education", name: "Education", disruption_velocity: 0.42, ai_investment_index: 1.2, regulatory_barrier: 0.60, data_availability: 0.55, workforce_pct_at_risk_2027: 0.22, workforce_pct_at_risk_2030: 0.40, safe_harbors: ["Academic Researcher", "Curriculum Designer", "Dean/Principal"] },
      { id: "journalism_media", name: "Journalism & Media", disruption_velocity: 0.75, ai_investment_index: 1.8, regulatory_barrier: 0.25, data_availability: 0.88, workforce_pct_at_risk_2027: 0.52, workforce_pct_at_risk_2030: 0.72, safe_harbors: ["Investigative Reporter", "On-Air Personality", "Editor-in-Chief"] },
      { id: "sales", name: "Sales", disruption_velocity: 0.60, ai_investment_index: 1.8, regulatory_barrier: 0.25, data_availability: 0.82, workforce_pct_at_risk_2027: 0.38, workforce_pct_at_risk_2030: 0.60, safe_harbors: ["Enterprise AE", "VP Sales", "Strategic Account Director"] },
      { id: "logistics", name: "Logistics & Supply Chain", disruption_velocity: 0.78, ai_investment_index: 2.2, regulatory_barrier: 0.35, data_availability: 0.88, workforce_pct_at_risk_2027: 0.48, workforce_pct_at_risk_2030: 0.70, safe_harbors: ["Supply Chain Strategist", "Customs Specialist"] },
      { id: "manufacturing", name: "Manufacturing", disruption_velocity: 0.72, ai_investment_index: 2.0, regulatory_barrier: 0.40, data_availability: 0.80, workforce_pct_at_risk_2027: 0.45, workforce_pct_at_risk_2030: 0.65, safe_harbors: ["Process Engineer", "Quality Director", "Plant Manager"] },
      { id: "research", name: "Research", disruption_velocity: 0.40, ai_investment_index: 1.5, regulatory_barrier: 0.45, data_availability: 0.65, workforce_pct_at_risk_2027: 0.22, workforce_pct_at_risk_2030: 0.38, safe_harbors: ["Principal Investigator", "Lab Director", "Grant Writer"] },
      { id: "graphic_design", name: "Graphic Design", disruption_velocity: 0.68, ai_investment_index: 2.0, regulatory_barrier: 0.20, data_availability: 0.88, workforce_pct_at_risk_2027: 0.48, workforce_pct_at_risk_2030: 0.68, safe_harbors: ["Creative Director", "Brand Strategist", "Art Director"] },
      { id: "architecture", name: "Architecture", disruption_velocity: 0.52, ai_investment_index: 1.5, regulatory_barrier: 0.55, data_availability: 0.72, workforce_pct_at_risk_2027: 0.30, workforce_pct_at_risk_2030: 0.48, safe_harbors: ["Principal Architect", "Urban Planner", "Preservation Specialist"] },
      { id: "retail", name: "Retail", disruption_velocity: 0.85, ai_investment_index: 1.8, regulatory_barrier: 0.28, data_availability: 0.90, workforce_pct_at_risk_2027: 0.58, workforce_pct_at_risk_2030: 0.80, safe_harbors: ["Store Experience Director", "Buyer/Merchandiser"] },
    ];
    for (const i of industries) {
      this.industries.set(i.name, i);
      this.industries.set(i.id, i);
    }
  }

  private _loadCities() {
    const cities: CityNode[] = [
      { id: "sf", name: "San Francisco", ai_adoption_multiplier: 1.45, tech_talent_density: 0.92, labor_market_resilience: 0.78, avg_transition_support: 0.85, emerging_roles_index: 1.55 },
      { id: "nyc", name: "New York", ai_adoption_multiplier: 1.35, tech_talent_density: 0.85, labor_market_resilience: 0.80, avg_transition_support: 0.80, emerging_roles_index: 1.40 },
      { id: "seattle", name: "Seattle", ai_adoption_multiplier: 1.40, tech_talent_density: 0.88, labor_market_resilience: 0.75, avg_transition_support: 0.82, emerging_roles_index: 1.48 },
      { id: "london", name: "London", ai_adoption_multiplier: 1.30, tech_talent_density: 0.80, labor_market_resilience: 0.78, avg_transition_support: 0.78, emerging_roles_index: 1.32 },
      { id: "singapore", name: "Singapore", ai_adoption_multiplier: 1.38, tech_talent_density: 0.85, labor_market_resilience: 0.72, avg_transition_support: 0.80, emerging_roles_index: 1.42 },
      { id: "boston", name: "Boston", ai_adoption_multiplier: 1.28, tech_talent_density: 0.80, labor_market_resilience: 0.76, avg_transition_support: 0.80, emerging_roles_index: 1.30 },
      { id: "austin", name: "Austin", ai_adoption_multiplier: 1.25, tech_talent_density: 0.75, labor_market_resilience: 0.72, avg_transition_support: 0.75, emerging_roles_index: 1.35 },
      { id: "toronto", name: "Toronto", ai_adoption_multiplier: 1.22, tech_talent_density: 0.75, labor_market_resilience: 0.74, avg_transition_support: 0.76, emerging_roles_index: 1.28 },
      { id: "berlin", name: "Berlin", ai_adoption_multiplier: 1.18, tech_talent_density: 0.72, labor_market_resilience: 0.70, avg_transition_support: 0.75, emerging_roles_index: 1.25 },
      { id: "sydney", name: "Sydney", ai_adoption_multiplier: 1.15, tech_talent_density: 0.70, labor_market_resilience: 0.72, avg_transition_support: 0.74, emerging_roles_index: 1.20 },
      { id: "amsterdam", name: "Amsterdam", ai_adoption_multiplier: 1.20, tech_talent_density: 0.73, labor_market_resilience: 0.73, avg_transition_support: 0.76, emerging_roles_index: 1.24 },
      { id: "paris", name: "Paris", ai_adoption_multiplier: 1.12, tech_talent_density: 0.68, labor_market_resilience: 0.68, avg_transition_support: 0.72, emerging_roles_index: 1.18 },
      { id: "chicago", name: "Chicago", ai_adoption_multiplier: 1.10, tech_talent_density: 0.65, labor_market_resilience: 0.68, avg_transition_support: 0.70, emerging_roles_index: 1.15 },
      { id: "la", name: "Los Angeles", ai_adoption_multiplier: 1.15, tech_talent_density: 0.68, labor_market_resilience: 0.65, avg_transition_support: 0.68, emerging_roles_index: 1.20 },
      { id: "dubai", name: "Dubai", ai_adoption_multiplier: 1.20, tech_talent_density: 0.72, labor_market_resilience: 0.60, avg_transition_support: 0.65, emerging_roles_index: 1.28 },
      // ── INDIA TIER-1 CITIES ──────────────────────────────────────────────────
      // Primary market — full data. Sources: NASSCOM 2024, LinkedIn India Workforce Report 2025.
      { id: "bangalore", name: "Bangalore", ai_adoption_multiplier: 1.28, tech_talent_density: 0.82, labor_market_resilience: 0.62, avg_transition_support: 0.68, emerging_roles_index: 1.38 },
      { id: "bengaluru", name: "Bengaluru", ai_adoption_multiplier: 1.28, tech_talent_density: 0.82, labor_market_resilience: 0.62, avg_transition_support: 0.68, emerging_roles_index: 1.38 },
      { id: "mumbai", name: "Mumbai", ai_adoption_multiplier: 1.15, tech_talent_density: 0.70, labor_market_resilience: 0.60, avg_transition_support: 0.62, emerging_roles_index: 1.20 },
      { id: "hyderabad", name: "Hyderabad", ai_adoption_multiplier: 1.22, tech_talent_density: 0.75, labor_market_resilience: 0.58, avg_transition_support: 0.65, emerging_roles_index: 1.30 },
      { id: "pune", name: "Pune", ai_adoption_multiplier: 1.18, tech_talent_density: 0.70, labor_market_resilience: 0.55, avg_transition_support: 0.60, emerging_roles_index: 1.22 },
      { id: "delhi", name: "Delhi", ai_adoption_multiplier: 1.12, tech_talent_density: 0.65, labor_market_resilience: 0.58, avg_transition_support: 0.60, emerging_roles_index: 1.18 },
      { id: "delhi ncr", name: "Delhi NCR", ai_adoption_multiplier: 1.12, tech_talent_density: 0.65, labor_market_resilience: 0.58, avg_transition_support: 0.60, emerging_roles_index: 1.18 },
      { id: "ncr", name: "NCR", ai_adoption_multiplier: 1.12, tech_talent_density: 0.65, labor_market_resilience: 0.58, avg_transition_support: 0.60, emerging_roles_index: 1.18 },
      { id: "gurgaon", name: "Gurgaon", ai_adoption_multiplier: 1.14, tech_talent_density: 0.66, labor_market_resilience: 0.57, avg_transition_support: 0.60, emerging_roles_index: 1.19 },
      { id: "noida", name: "Noida", ai_adoption_multiplier: 1.10, tech_talent_density: 0.62, labor_market_resilience: 0.55, avg_transition_support: 0.58, emerging_roles_index: 1.15 },
      { id: "chennai", name: "Chennai", ai_adoption_multiplier: 1.14, tech_talent_density: 0.68, labor_market_resilience: 0.56, avg_transition_support: 0.60, emerging_roles_index: 1.18 },
      { id: "kolkata", name: "Kolkata", ai_adoption_multiplier: 0.98, tech_talent_density: 0.52, labor_market_resilience: 0.50, avg_transition_support: 0.52, emerging_roles_index: 1.02 },
      // ── INDIA TIER-2 CITIES ──────────────────────────────────────────────────
      // Lower AI adoption multiplier — slower disruption curve but also fewer new roles.
      // These users benefit from domestic mobility framing (move to tier-1 as optionality).
      { id: "ahmedabad", name: "Ahmedabad", ai_adoption_multiplier: 0.95, tech_talent_density: 0.50, labor_market_resilience: 0.52, avg_transition_support: 0.50, emerging_roles_index: 0.98 },
      { id: "jaipur", name: "Jaipur", ai_adoption_multiplier: 0.88, tech_talent_density: 0.42, labor_market_resilience: 0.48, avg_transition_support: 0.45, emerging_roles_index: 0.90 },
      { id: "coimbatore", name: "Coimbatore", ai_adoption_multiplier: 0.90, tech_talent_density: 0.45, labor_market_resilience: 0.48, avg_transition_support: 0.46, emerging_roles_index: 0.92 },
      { id: "kochi", name: "Kochi", ai_adoption_multiplier: 0.92, tech_talent_density: 0.48, labor_market_resilience: 0.50, avg_transition_support: 0.48, emerging_roles_index: 0.95 },
      { id: "indore", name: "Indore", ai_adoption_multiplier: 0.88, tech_talent_density: 0.42, labor_market_resilience: 0.46, avg_transition_support: 0.44, emerging_roles_index: 0.90 },
      { id: "nagpur", name: "Nagpur", ai_adoption_multiplier: 0.85, tech_talent_density: 0.40, labor_market_resilience: 0.46, avg_transition_support: 0.44, emerging_roles_index: 0.88 },
      { id: "lucknow", name: "Lucknow", ai_adoption_multiplier: 0.82, tech_talent_density: 0.38, labor_market_resilience: 0.44, avg_transition_support: 0.42, emerging_roles_index: 0.85 },
      { id: "bhubaneswar", name: "Bhubaneswar", ai_adoption_multiplier: 0.88, tech_talent_density: 0.42, labor_market_resilience: 0.46, avg_transition_support: 0.44, emerging_roles_index: 0.90 },
      { id: "other", name: "Other", ai_adoption_multiplier: 0.82, tech_talent_density: 0.38, labor_market_resilience: 0.45, avg_transition_support: 0.42, emerging_roles_index: 0.82 },
    ];
    for (const c of cities) {
      this.cities.set(c.name, c);
      this.cities.set(c.id, c);
    }
  }

  // ── GRAPH QUERIES ──────────────────────────────────────────────
  getRole(title: string): RoleNode | null {
    if (this.roles.has(title)) return this.roles.get(title)!;
    const lower = title.toLowerCase();
    for (const [key, node] of this.roles) {
      if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return node;
    }
    return null;
  }

  getIndustry(name: string): IndustryNode | null {
    if (this.industries.has(name)) return this.industries.get(name)!;
    const lower = name.toLowerCase();
    for (const [key, node] of this.industries) {
      if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return node;
    }
    return null;
  }

  getCity(name: string): CityNode | null {
    if (this.cities.has(name)) return this.cities.get(name)!;
    const lower = name.toLowerCase();
    for (const [key, node] of this.cities) {
      if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return node;
    }
    return this.cities.get("other") || null;
  }

  getThreatsForRole(roleTitle: string): AIToolThreat[] {
    const lower = roleTitle.toLowerCase();
    const results: AIToolThreat[] = [];
    for (const t of this.ai_threats.values()) {
      if (t.threatens_roles.some(r => lower.includes(r) || r.includes(lower))) {
        results.push(t);
      }
    }
    return results;
  }

  getPivotRoles(role: RoleNode): RoleNode[] {
    return role.pivot_targets
      .map(id => this.roles.get(id))
      .filter((r): r is RoleNode => r !== undefined);
  }

  getSkillHalfLife(skillName: string): SkillNode | null {
    const lower = skillName.toLowerCase();
    if (this.skills.has(lower)) return this.skills.get(lower)!;
    for (const [key, node] of this.skills) {
      if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return node;
    }
    return null;
  }

  /**
   * Returns all skill names stored in the KG, lowercased.
   * Used for fuzzy matching of user-entered skills against the KG without
   * a full DB round-trip. Previously the pipeline fetched all skill_risk_matrix
   * rows from Supabase to get this list — the KG already has them in memory.
   *
   * Covers the KG's built-in SkillNode map. Skills that exist only in the
   * DB (not seeded into the KG) are not covered here — those are handled by
   * the DB fallback query that runs after this check.
   */
  getAllSkillNames(): string[] {
    return Array.from(this.skills.keys());
  }
}

let _kgInstance: RiskKnowledgeGraph | null = null;
export function getKG(): RiskKnowledgeGraph {
  if (!_kgInstance) _kgInstance = new RiskKnowledgeGraph();
  return _kgInstance;
}

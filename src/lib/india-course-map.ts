// ═══════════════════════════════════════════════════════════════
// India Course Affiliate Engine — Static skill-to-course mapping
// Zero API cost. Revenue via affiliate links.
// Maps top skills to India's dominant learning platforms.
// ═══════════════════════════════════════════════════════════════

export interface CourseRecommendation {
  skill: string;
  courses: CourseLink[];
  ctc_bump: string; // e.g. "₹2-5L"
  demand_signal: "hot" | "growing" | "stable";
}

export interface CourseLink {
  platform: string;
  title: string;
  url: string;
  duration: string;
  price: string;
  rating?: string;
}

// Skill → Course mapping for Indian market
const SKILL_COURSES: Record<string, { courses: CourseLink[]; ctc_bump: string; demand_signal: "hot" | "growing" | "stable" }> = {
  // AI/ML
  "machine learning": {
    ctc_bump: "₹4-8L",
    demand_signal: "hot",
    courses: [
      { platform: "Scaler", title: "Machine Learning & AI Program", url: "https://www.scaler.com/courses/machine-learning/", duration: "6 months", price: "₹2.5L EMI" },
      { platform: "Coursera", title: "ML Specialization by Andrew Ng", url: "https://www.coursera.org/specializations/machine-learning-introduction", duration: "3 months", price: "Free audit" },
      { platform: "UpGrad", title: "PG in ML & AI (IIIT-B)", url: "https://www.upgrad.com/machine-learning-ai-pgd-iiitb/", duration: "12 months", price: "₹3.5L EMI", rating: "4.5/5" },
    ],
  },
  "python": {
    ctc_bump: "₹2-4L",
    demand_signal: "hot",
    courses: [
      { platform: "Coursera", title: "Python for Everybody", url: "https://www.coursera.org/specializations/python", duration: "2 months", price: "Free audit" },
      { platform: "Simplilearn", title: "Python Certification", url: "https://www.simplilearn.com/learn-python-basics-free-course-skillup", duration: "6 weeks", price: "Free" },
      { platform: "Scaler", title: "Python DSA", url: "https://www.scaler.com/topics/python/", duration: "3 months", price: "Free topics" },
    ],
  },
  "data analysis": {
    ctc_bump: "₹2-5L",
    demand_signal: "growing",
    courses: [
      { platform: "Google", title: "Google Data Analytics Certificate", url: "https://www.coursera.org/professional-certificates/google-data-analytics", duration: "6 months", price: "Free audit" },
      { platform: "UpGrad", title: "Data Analytics with IIIT-B", url: "https://www.upgrad.com/data-analytics-certification-course-iiitb/", duration: "7 months", price: "₹85K" },
      { platform: "Simplilearn", title: "Data Analyst Masters", url: "https://www.simplilearn.com/data-analyst-masters-certification-training-course", duration: "5 months", price: "₹55K" },
    ],
  },
  "cloud computing": {
    ctc_bump: "₹3-6L",
    demand_signal: "hot",
    courses: [
      { platform: "AWS", title: "AWS Cloud Practitioner", url: "https://aws.amazon.com/certification/certified-cloud-practitioner/", duration: "3 months", price: "₹10K exam" },
      { platform: "Coursera", title: "Google Cloud Fundamentals", url: "https://www.coursera.org/learn/gcp-fundamentals", duration: "1 month", price: "Free audit" },
      { platform: "Simplilearn", title: "Cloud Computing PGP", url: "https://www.simplilearn.com/cloud-computing-training-course", duration: "8 months", price: "₹65K" },
    ],
  },
  "generative ai": {
    ctc_bump: "₹3-7L",
    demand_signal: "hot",
    courses: [
      { platform: "Google", title: "Gen AI Learning Path", url: "https://www.cloudskillsboost.google/paths/118", duration: "1 month", price: "Free" },
      { platform: "Coursera", title: "Generative AI for Everyone (Andrew Ng)", url: "https://www.coursera.org/learn/generative-ai-for-everyone", duration: "3 weeks", price: "Free audit" },
      { platform: "Simplilearn", title: "Generative AI Course", url: "https://www.simplilearn.com/generative-ai-course-free-course-skillup", duration: "4 weeks", price: "Free" },
    ],
  },
  "prompt engineering": {
    ctc_bump: "₹1-3L",
    demand_signal: "growing",
    courses: [
      { platform: "Coursera", title: "Prompt Engineering for ChatGPT", url: "https://www.coursera.org/learn/prompt-engineering", duration: "3 weeks", price: "Free audit" },
      { platform: "Google", title: "Introduction to Prompt Design", url: "https://www.cloudskillsboost.google/course_templates/514", duration: "1 week", price: "Free" },
    ],
  },
  "digital marketing": {
    ctc_bump: "₹1.5-4L",
    demand_signal: "stable",
    courses: [
      { platform: "Google", title: "Digital Marketing Certificate", url: "https://grow.google/intl/en_in/certificates/digital-marketing-ecommerce/", duration: "6 months", price: "Free" },
      { platform: "UpGrad", title: "Digital Marketing PG (MICA)", url: "https://www.upgrad.com/digital-marketing-and-communication-pgc-mica/", duration: "6 months", price: "₹1.5L" },
      { platform: "Simplilearn", title: "Digital Marketing Specialist", url: "https://www.simplilearn.com/digital-marketing-specialist-master-program-training-course", duration: "12 months", price: "₹60K" },
    ],
  },
  "project management": {
    ctc_bump: "₹2-5L",
    demand_signal: "stable",
    courses: [
      { platform: "Google", title: "Google PM Certificate", url: "https://www.coursera.org/professional-certificates/google-project-management", duration: "6 months", price: "Free audit" },
      { platform: "Simplilearn", title: "PMP Certification Training", url: "https://www.simplilearn.com/project-management-professional-pmp-certification-training", duration: "3 months", price: "₹35K" },
    ],
  },
  "cybersecurity": {
    ctc_bump: "₹3-7L",
    demand_signal: "hot",
    courses: [
      { platform: "Google", title: "Google Cybersecurity Certificate", url: "https://www.coursera.org/professional-certificates/google-cybersecurity", duration: "6 months", price: "Free audit" },
      { platform: "Simplilearn", title: "Cyber Security Expert", url: "https://www.simplilearn.com/cyber-security-expert-master-program-training-course", duration: "12 months", price: "₹65K" },
      { platform: "UpGrad", title: "PG in Cybersecurity (IIIT-B)", url: "https://www.upgrad.com/cyber-security-pgd-iiitb/", duration: "13 months", price: "₹3L" },
    ],
  },
  "sql": {
    ctc_bump: "₹1-2L",
    demand_signal: "stable",
    courses: [
      { platform: "Coursera", title: "SQL for Data Science", url: "https://www.coursera.org/learn/sql-for-data-science", duration: "4 weeks", price: "Free audit" },
      { platform: "Scaler", title: "SQL Topics", url: "https://www.scaler.com/topics/sql/", duration: "Self-paced", price: "Free" },
    ],
  },
  "power bi": {
    ctc_bump: "₹1.5-3L",
    demand_signal: "growing",
    courses: [
      { platform: "Microsoft", title: "Power BI Data Analyst", url: "https://www.coursera.org/professional-certificates/microsoft-power-bi-data-analyst", duration: "5 months", price: "Free audit" },
      { platform: "Simplilearn", title: "Power BI Training", url: "https://www.simplilearn.com/power-bi-certification-training-course", duration: "2 months", price: "₹15K" },
    ],
  },
  "excel": {
    ctc_bump: "₹0.5-1.5L",
    demand_signal: "stable",
    courses: [
      { platform: "Coursera", title: "Excel Skills for Business", url: "https://www.coursera.org/specializations/excel", duration: "6 months", price: "Free audit" },
      { platform: "Simplilearn", title: "Advanced Excel", url: "https://www.simplilearn.com/learn-excel-basics-free-course-skillup", duration: "4 weeks", price: "Free" },
    ],
  },
  "product management": {
    ctc_bump: "₹3-8L",
    demand_signal: "growing",
    courses: [
      { platform: "Scaler", title: "Product Management Program", url: "https://www.scaler.com/courses/product-management/", duration: "6 months", price: "₹2L EMI" },
      { platform: "UpGrad", title: "PG in Product Management", url: "https://www.upgrad.com/product-management-certification-program/", duration: "6 months", price: "₹1.2L" },
    ],
  },
  "ux design": {
    ctc_bump: "₹2-5L",
    demand_signal: "growing",
    courses: [
      { platform: "Google", title: "Google UX Design Certificate", url: "https://www.coursera.org/professional-certificates/google-ux-design", duration: "6 months", price: "Free audit" },
      { platform: "Scaler", title: "System Design", url: "https://www.scaler.com/courses/system-design/", duration: "4 months", price: "₹1.5L" },
    ],
  },
};

// Fuzzy-match a skill to our map
function findSkillMatch(skill: string): string | null {
  const s = skill.toLowerCase().trim();
  // Direct match
  if (SKILL_COURSES[s]) return s;
  // Partial match
  for (const key of Object.keys(SKILL_COURSES)) {
    if (s.includes(key) || key.includes(s)) return key;
  }
  // Keyword match
  if (s.includes("ml") || s.includes("deep learning") || s.includes("neural")) return "machine learning";
  if (s.includes("ai") || s.includes("artificial") || s.includes("llm") || s.includes("gpt")) return "generative ai";
  if (s.includes("data") && (s.includes("analy") || s.includes("visual"))) return "data analysis";
  if (s.includes("cloud") || s.includes("aws") || s.includes("azure") || s.includes("gcp")) return "cloud computing";
  if (s.includes("security") || s.includes("infosec")) return "cybersecurity";
  if (s.includes("market") && s.includes("digital")) return "digital marketing";
  if (s.includes("project") || s.includes("agile") || s.includes("scrum")) return "project management";
  if (s.includes("design") || s.includes("figma") || s.includes("ui")) return "ux design";
  if (s.includes("product") && s.includes("manag")) return "product management";
  if (s.includes("power bi") || s.includes("tableau")) return "power bi";
  if (s.includes("excel") || s.includes("spreadsheet")) return "excel";
  if (s.includes("sql") || s.includes("database")) return "sql";
  if (s.includes("python") || s.includes("programming")) return "python";
  return null;
}

/**
 * Get course recommendations for a list of skills.
 * Prioritizes skills with highest CTC bump and hottest demand.
 */
export function getCoursesForSkills(skills: string[], maxResults = 5): CourseRecommendation[] {
  const results: CourseRecommendation[] = [];
  const seen = new Set<string>();

  for (const skill of skills) {
    const matched = findSkillMatch(skill);
    if (!matched || seen.has(matched)) continue;
    seen.add(matched);

    const data = SKILL_COURSES[matched];
    results.push({
      skill: matched,
      courses: data.courses,
      ctc_bump: data.ctc_bump,
      demand_signal: data.demand_signal,
    });
  }

  // Sort: hot > growing > stable, then by CTC bump magnitude
  results.sort((a, b) => {
    const demandOrder = { hot: 0, growing: 1, stable: 2 };
    return (demandOrder[a.demand_signal] || 2) - (demandOrder[b.demand_signal] || 2);
  });

  return results.slice(0, maxResults);
}

/**
 * Get "general upskilling" courses for users whose skills don't match our map.
 * Always returns at least the AI/prompt engineering fundamentals.
 */
export function getDefaultCourses(): CourseRecommendation[] {
  return [
    {
      skill: "generative ai",
      courses: SKILL_COURSES["generative ai"].courses,
      ctc_bump: SKILL_COURSES["generative ai"].ctc_bump,
      demand_signal: "hot",
    },
    {
      skill: "prompt engineering",
      courses: SKILL_COURSES["prompt engineering"].courses,
      ctc_bump: SKILL_COURSES["prompt engineering"].ctc_bump,
      demand_signal: "growing",
    },
    {
      skill: "python",
      courses: SKILL_COURSES["python"].courses,
      ctc_bump: SKILL_COURSES["python"].ctc_bump,
      demand_signal: "hot",
    },
  ];
}

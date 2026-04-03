export interface UserInput {
  inputMethod: 'linkedin' | 'resume' | null;
  linkedinUrl: string;
  resumeFile: File | null;
  country: string;
  industry: string;
  yearsExperience: string;
  metroTier: string;
  keySkills: string;
}

export const COUNTRIES = [
  { label: 'India', flag: '🇮🇳', value: 'IN', comingSoon: false },
  { label: 'United States', flag: '🇺🇸', value: 'US', comingSoon: true },
  { label: 'UAE', flag: '🇦🇪', value: 'AE', comingSoon: true },
] as const;

export type CountryCode = typeof COUNTRIES[number]['value'];

export interface FateVerdict {
  fateScore: number;
  status: 'THREATENED' | 'AUGMENTED';
  timelineMonths: string;
  primaryThreats: string[];
  salvageableSkills: string[];
  recommendedPath: 'WORK_WITH_AI' | 'RESIST_AI';
  jobFamily: string;
  marketHealth: string;
  skillsAssessed: number;
  highRiskSkills: { skill: string; risk: number; replacement: string }[];
  lowRiskSkills: { skill: string; risk: number; moat: string }[];
}

export const INDUSTRIES = [
  'IT & Software',
  'Finance & Banking',
  'Marketing & Advertising',
  'Healthcare',
  'Manufacturing',
  'Creative & Design',
  'Education',
] as const;

export const EXPERIENCE_LEVELS = [
  { label: '0–2 years', value: '0-2' },
  { label: '3–5 years', value: '3-5' },
  { label: '6–10 years', value: '6-10' },
  { label: '10+ years', value: '10+' },
] as const;

export const METRO_TIERS_BY_COUNTRY: Record<string, readonly { label: string; description: string; value: string }[]> = {
  IN: [
    { label: 'Major Metro', description: 'Bangalore · Delhi · Mumbai · Hyderabad · Chennai · Pune', value: 'tier1' },
    { label: 'Smaller City', description: 'All other cities & towns', value: 'tier2' },
  ],
  US: [
    { label: 'Major Metro', description: 'NYC · SF · Seattle · LA · Chicago · Boston', value: 'tier1' },
    { label: 'Smaller City', description: 'Austin · Raleigh · Denver · Nashville & others', value: 'tier2' },
  ],
  AE: [
    { label: 'Major City', description: 'Dubai · Abu Dhabi', value: 'tier1' },
    { label: 'Smaller City', description: 'Sharjah · Ajman · RAK & others', value: 'tier2' },
  ],
} as const;

/** Backward-compatible default (India) */
export const METRO_TIERS = METRO_TIERS_BY_COUNTRY.IN;

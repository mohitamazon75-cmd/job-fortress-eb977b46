import { ScanReport } from '@/lib/scan-engine';
import type { SeniorityTier } from '@/lib/seniority-utils';
import type { Locale, Strings } from '@/lib/i18n';

export interface DashboardSharedProps {
  report: ScanReport;
  scanId: string;
  userId?: string;
  accessToken?: string;
  country?: string | null;

  // Derived display values
  displayScoreValue: number;
  clampedRisk: number;
  scoreColorClass: string;
  seniorityTier: SeniorityTier;
  isExec: boolean;
  userName: string;
  userCompany?: string;
  displayRole: string;
  profileContext: string;
  isLinkedIn: boolean;
  isResume: boolean;
  source: string;
  toneTag: string;
  toneColors: Record<string, string>;

  // Data arrays
  executionSkillsDead: string[];
  moatSkills: string[];
  tools: ReturnType<typeof import('@/lib/scan-engine').normalizeTools>;
  allSkills: string[];
  pivotRoleNames: string[];
  deadEndNarrative: string;

  // Computed models
  normalizedMarketPosition: any;
  normalizedCareerShock: any;
  immediateNextStep: any;

  // Report metadata
  ci: ScanReport['score_variability'];
  kgMatched: number;
  kgLastRefresh: string | null;

  // Enrichment hooks
  enrichment: any;
  judoIntel: any;

  // Navigation
  setActiveScreen: (screen: 'diagnosis' | 'defense' | 'intel' | 'dossier' | 'coach') => void;

  // Rate limit
  setShowRateLimitUpsell: (show: boolean) => void;
  setRateLimitMinutes: (mins: number) => void;

  // Locale
  locale: Locale;
  strings: Strings;
}

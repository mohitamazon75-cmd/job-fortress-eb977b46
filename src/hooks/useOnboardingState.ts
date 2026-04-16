/**
 * useOnboardingState — owns all input-collection state for the scan onboarding flow.
 *
 * Previously this state lived inline in Index.tsx alongside scan lifecycle state,
 * session state, and 1,000 lines of JSX. Separating it:
 *   1. Makes each piece of state's purpose clear.
 *   2. Allows onboarding state to be unit tested independently.
 *   3. Eliminates the risk of onboarding changes accidentally affecting scan lifecycle.
 *
 * State owned here:
 *   - country, linkedinUrl, industry, yearsExperience (what the user typed)
 *   - metroTier, pendingSkills, userReportedCTC (onboarding step answers)
 *   - step (which onboarding sub-step is active)
 *   - resumeFileRef (the File object, survives re-renders)
 *
 * State intentionally NOT here:
 *   - phase (scan lifecycle — belongs in useScanFlow)
 *   - scanId, accessToken, scanReport (scan results — belongs in useScanFlow)
 *   - session (auth — belongs in Index.tsx via useSession)
 */

import { useState, useRef } from 'react';

/** Detects country from browser timezone. Returns ISO 2-letter code or empty string. */
function detectCountry(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'IN';
    if (tz?.startsWith('America/')) return 'US';
    if (tz === 'Asia/Dubai') return 'AE';
  } catch {
    // Intl not available — fall through to empty string
  }
  return '';
}

export interface OnboardingState {
  // Values
  country: string;
  linkedinUrl: string;
  industry: string;
  yearsExperience: string;
  metroTier: string;
  pendingSkills: string;
  userReportedCTC: number | null;
  step: number;
  resumeFileRef: React.MutableRefObject<File | null>;

  // Setters
  setCountry: (v: string) => void;
  setLinkedinUrl: (v: string) => void;
  setIndustry: (v: string) => void;
  setYearsExperience: (v: string) => void;
  setMetroTier: (v: string) => void;
  setKeySkills: (v: string) => void;
  setUserReportedCTC: (v: number | null) => void;
  setStep: (v: number) => void;

  // Derived
  isManualPath: boolean;
}

export function useOnboardingState(): OnboardingState {
  const [country, setCountry] = useState<string>(detectCountry);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [industry, setIndustry] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [metroTier, setMetroTier] = useState('');
  const [pendingSkills, setKeySkills] = useState('');
  const [userReportedCTC, setUserReportedCTC] = useState<number | null>(null);
  const [step, setStep] = useState(1);

  const resumeFileRef = useRef<File | null>(null);

  // Derived: manual entry path (no LinkedIn URL and no resume file)
  const isManualPath = !linkedinUrl && !resumeFileRef.current;

  return {
    country,
    linkedinUrl,
    industry,
    yearsExperience,
    metroTier,
    pendingSkills,
    userReportedCTC,
    step,
    resumeFileRef,

    setCountry,
    setLinkedinUrl,
    setIndustry,
    setYearsExperience,
    setMetroTier,
    setKeySkills,
    setUserReportedCTC,
    setStep,

    isManualPath,
  };
}

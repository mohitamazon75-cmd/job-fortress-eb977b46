/**
 * persona-detect.ts
 *
 * Detects user persona from scan report data for differentiated UX journeys.
 * Audit finding: "Product treats a 28-year-old TCS engineer and a 44-year-old
 * operations manager in Jaipur identically — same card sequence, same framing."
 *
 * Four personas identified in audit:
 *   IT_SERVICES  — TCS/Infosys/Wipro/HCL engineer, IT consulting, IT services outsourcing
 *   BPO_KPO      — Voice process, data entry, KYC, claims, back office, medical transcription
 *   PSU_GOV      — Government officer, PSU engineer, bank clerk/PO
 *   GENERALIST   — Everything else (product companies, marketing, finance, consulting, etc.)
 *
 * Used by AIDossierReveal to:
 *   - Adjust emotional framing (BPO = crisis/immediate; PSU = low urgency/transition)
 *   - Surface persona-specific advice in the free dossier
 *   - Vary the call-to-action copy for the paywall
 */

import type { ScanReport } from './scan-engine';

export type PersonaType = 'IT_SERVICES' | 'BPO_KPO' | 'PSU_GOV' | 'GENERALIST';

const BPO_ROLE_SIGNALS = [
  'voice process', 'call centre', 'call center', 'bpo', 'kpo', 'back office', 'backoffice',
  'data entry', 'kpo research', 'kyc', 'aml', 'claims processing', 'medical transcription',
  'medical transcriptionist', 'insurance data', 'chat support', 'customer support agent',
  'helpdesk', 'process executive', 'transaction processing',
];

const IT_SERVICES_SIGNALS = [
  'tcs', 'infosys', 'wipro', 'hcl', 'cognizant', 'tech mahindra', 'capgemini',
  'accenture', 'ibm india', 'mphasis', 'hexaware', 'persistent', 'l&t infotech',
  'it services', 'it consulting', 'software engineer', 'software developer',
  'java developer', 'python developer', '.net developer', 'qa engineer',
  'test engineer', 'devops', 'cloud engineer', 'full stack', 'frontend developer',
  'backend developer', 'mobile developer',
];

const PSU_GOV_SIGNALS = [
  'government officer', 'ias', 'ips', 'ifs', 'psu engineer', 'bank clerk',
  'probationary officer', 'po bank', 'sbi', 'bsnl', 'ongc', 'bhel', 'ntpc',
  'gail', 'iocl', 'sail', 'nalco', 'hal', 'drdo', 'barc', 'railway',
  'central government', 'state government', 'government employee', 'civil servant',
];

export function detectPersona(report: ScanReport): PersonaType {
  const role = (report.role || '').toLowerCase();
  const industry = (report.industry || '').toLowerCase();
  const company = (report.linkedin_company || '').toLowerCase();

  // Check BPO/KPO first — highest urgency, most different journey
  if (BPO_ROLE_SIGNALS.some(s => role.includes(s) || industry.includes(s))) {
    return 'BPO_KPO';
  }

  // Check PSU/Government — lowest urgency, transition-focused
  if (PSU_GOV_SIGNALS.some(s => role.includes(s) || company.includes(s))) {
    return 'PSU_GOV';
  }

  // Check IT Services — medium urgency, AI-upskill focused
  if (
    IT_SERVICES_SIGNALS.some(s => company.includes(s)) ||
    (industry.includes('it') && IT_SERVICES_SIGNALS.some(s => role.includes(s)))
  ) {
    return 'IT_SERVICES';
  }

  return 'GENERALIST';
}

export interface PersonaConfig {
  urgencyLabel: string;
  urgencyColor: string;
  freeCardHeadline: string;
  freeCardSubtext: string;
  paywallCta: string;
  crisisThreshold: number;  // score below this = crisis framing (normally 40)
}

export function getPersonaConfig(persona: PersonaType): PersonaConfig {
  switch (persona) {
    case 'BPO_KPO':
      return {
        urgencyLabel: 'Immediate action required',
        urgencyColor: 'text-destructive',
        freeCardHeadline: 'Your role is already in the yellow zone.',
        freeCardSubtext: 'AI displacement in BPO/KPO is not 3 years away — it is happening this quarter. The professionals who pivot now are landing ₹8-14L roles.',
        paywallCta: 'See your pivot path & salary bridge →',
        crisisThreshold: 60,  // higher threshold for BPO — more of them need crisis support
      };

    case 'PSU_GOV':
      return {
        urgencyLabel: 'Long-term positioning',
        urgencyColor: 'text-amber-500',
        freeCardHeadline: 'Your role has regulatory protection — but the window is opening.',
        freeCardSubtext: 'PSU and government roles have the longest displacement window in India. The risk is not immediate. But professionals who build private-sector-transferable skills now will have options when they want them.',
        paywallCta: 'See your private sector bridge →',
        crisisThreshold: 25,  // lower threshold — PSU users are structurally protected
      };

    case 'IT_SERVICES':
      return {
        urgencyLabel: 'Adapt now — before the next appraisal cycle',
        urgencyColor: 'text-amber-400',
        freeCardHeadline: 'IT services engineers who add AI fluency are commanding 40-60% salary premiums.',
        freeCardSubtext: 'The TCS/Infosys tier is bifurcating: engineers who can work with AI tools are getting promoted; those who cannot are being benched. Your score shows which side you are on.',
        paywallCta: 'Get your AI upskill roadmap →',
        crisisThreshold: 40,
      };

    case 'GENERALIST':
    default:
      return {
        urgencyLabel: 'Act within your planning horizon',
        urgencyColor: 'text-primary',
        freeCardHeadline: 'Your score reveals the specific skills AI will replace first.',
        freeCardSubtext: 'The professionals who move early — before their peers realise the risk — get the best pivot opportunities and the best salaries.',
        paywallCta: 'See your full risk breakdown & 90-day plan →',
        crisisThreshold: 40,
      };
  }
}

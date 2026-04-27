/**
 * Sector classifier for the "Sector Pulse" feature (Layer E).
 *
 * Maps a Family → a search-ready sector descriptor used to query
 * Perplexity for hiring/layoff/funding news. Output is engineered
 * for *news search relevance*, not display.
 *
 * Honesty rule: families that don't have meaningful "sector news"
 * (founder/exec/creator/generic) return null. The card silently
 * omits the pulse strip rather than guessing.
 */

import type { Family } from "./card1-personalization";

export interface SectorDescriptor {
  /** Human label shown in UI (e.g. "Tech & Engineering"). */
  label: string;
  /** Search query fragment fed to Perplexity (Indian-market biased). */
  query_fragment: string;
}

const SECTOR_MAP: Partial<Record<Family, SectorDescriptor>> = {
  eng: {
    label: "Tech & Engineering",
    query_fragment: "Indian tech engineering hiring or layoffs",
  },
  data: {
    label: "Data & Analytics",
    query_fragment: "Indian tech data engineering analytics hiring or layoffs",
  },
  design: {
    label: "Product Design",
    query_fragment: "Indian tech product design hiring or layoffs",
  },
  pm: {
    label: "Product Management",
    query_fragment: "Indian tech product management hiring or layoffs",
  },
  marketing: {
    label: "Marketing & Growth",
    query_fragment: "Indian consumer tech marketing growth hiring or layoffs",
  },
  sales: {
    label: "Sales & Business Development",
    query_fragment: "Indian B2B SaaS or consumer sales hiring or layoffs",
  },
  ops: {
    label: "Operations",
    query_fragment: "Indian tech operations hiring or layoffs",
  },
  hr: {
    label: "Human Resources",
    query_fragment: "Indian tech HR talent hiring or layoffs",
  },
  finance: {
    label: "Finance",
    query_fragment: "Indian fintech and BFSI hiring or layoffs",
  },
  support: {
    label: "Customer Support",
    query_fragment: "Indian tech customer support hiring or layoffs",
  },
  content: {
    label: "Content & Editorial",
    query_fragment: "Indian media content editorial hiring or layoffs",
  },
  consulting: {
    label: "Consulting",
    query_fragment: "Indian consulting Big Four hiring or layoffs",
  },
  healthcare: {
    label: "Healthcare",
    query_fragment: "Indian healthcare and healthtech hiring or layoffs",
  },
  legal: {
    label: "Legal",
    query_fragment: "Indian legal services and legaltech hiring or layoffs",
  },
  education: {
    label: "Education & EdTech",
    query_fragment: "Indian edtech and education hiring or layoffs",
  },
  manufacturing: {
    label: "Manufacturing",
    query_fragment: "Indian manufacturing hiring or layoffs",
  },
  hospitality: {
    label: "Hospitality & Travel",
    query_fragment: "Indian hospitality travel and aviation hiring or layoffs",
  },
  research: {
    label: "Research",
    query_fragment: "Indian research and R&D hiring or layoffs",
  },
  // founder / exec / creator / generic intentionally absent.
};

/** Returns null when family doesn't map to a useful sector for news. */
export function getSectorDescriptor(family: Family): SectorDescriptor | null {
  return SECTOR_MAP[family] ?? null;
}

/**
 * Domains we trust to render in the UI. Defense-in-depth: server enforces
 * the same list, client filters again before render. If a URL slips past
 * Perplexity's domain filter due to a redirect, the client still drops it.
 */
export const TRUSTED_NEWS_DOMAINS: ReadonlyArray<string> = [
  "economictimes.indiatimes.com",
  "economictimes.com",
  "indiatimes.com",
  "livemint.com",
  "mint.com",
  "moneycontrol.com",
  "business-standard.com",
  "businesstoday.in",
  "business-today.in",
  "inc42.com",
  "yourstory.com",
  "entrackr.com",
  "the-ken.com",
  "thehindubusinessline.com",
  "thehindu.com",
  "financialexpress.com",
  "cnbctv18.com",
  "ndtvprofit.com",
  "theprint.in",
  "fortuneindia.com",
  "forbesindia.com",
  "bloomberg.com",
  "reuters.com",
  "techcrunch.com",
  "ft.com",
  "wsj.com",
  "cnbc.com",
];

export function isTrustedNewsUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return TRUSTED_NEWS_DOMAINS.some(d => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

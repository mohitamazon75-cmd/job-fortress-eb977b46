/**
 * @fileoverview Server-side verification of weekly diet resource domains.
 * Checks URLs against a curated allowlist of trusted learning platforms.
 * Resources without URLs or from unknown domains are flagged as unverified.
 */

const VERIFIED_RESOURCE_DOMAINS = [
  'coursera.org', 'udemy.com', 'linkedin.com',
  'edx.org', 'youtube.com', 'harvard.edu', 'wharton.upenn.edu',
  'mit.edu', 'amazon.com', 'amazon.in',
  'hbr.org', 'mckinsey.com', 'ted.com',
  'freecodecamp.org', 'khanacademy.org',
  'spotify.com', 'apple.com',
  'oreilly.com', 'pluralsight.com',
];

interface DietItem {
  title: string;
  url?: string;
  [key: string]: unknown;
}

interface DietOutput {
  theme?: string;
  read?: DietItem;
  watch?: DietItem;
  listen?: DietItem;
  [key: string]: unknown;
}

function isDomainVerified(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return VERIFIED_RESOURCE_DOMAINS.some(d =>
      hostname === d || hostname.endsWith('.' + d)
    );
  } catch {
    return false;
  }
}

/**
 * Verify diet resource URLs against trusted domain allowlist.
 * Sets `verified: true/false` on each section and adds a verification note.
 * @param diet - Raw diet output from the LLM
 * @returns Diet output with server-side verification flags
 */
export function verifyDietResources(diet: DietOutput): DietOutput & { verification_note: string } {
  const sections = ['read', 'watch', 'listen'] as const;
  const result = { ...diet };

  for (const section of sections) {
    const item = result[section] as DietItem | undefined;
    if (!item) continue;

    if (item.url && isDomainVerified(item.url)) {
      (item as any).verified = true;
    } else {
      (item as any).verified = false;
    }
  }

  return {
    ...result,
    verification_note: 'Resources marked unverified should be independently confirmed before use.',
  };
}

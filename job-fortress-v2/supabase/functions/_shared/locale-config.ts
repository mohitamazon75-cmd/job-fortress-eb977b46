// ═══════════════════════════════════════════════════════════════
// GLOBAL LOCALE CONFIGURATION
// Single source of truth for all market-specific variables.
// ═══════════════════════════════════════════════════════════════

export type CountryCode = 'IN' | 'US' | 'AE';

export interface LocaleConfig {
  code: CountryCode;
  label: string;
  currency: string;
  currencySymbol: string;
  salaryUnit: string;
  /** Divisor to convert annual salary to monthly. For India: LPA*100000/12 */
  annualToMonthlyDivisor: (annualSalary: number) => number;
  numberLocale: string;
  searchRegion: string;
  searchLang: string;
  tier1Cities: string[];
  tier2Cities: string[];
  tier1Label: string;
  tier1Description: string;
  tier2Label: string;
  tier2Description: string;
  jobBoards: string[];
  geoArbitrageTargets: string[];
  /** Multiplier applied to base salary when metro is tier-2 */
  tier2SalaryMultiplier: number;
  /** Tavily/Firecrawl search country code */
  searchCountry: string;
  /** Salary search terms for this market */
  salarySearchTerms: string;
  /** Cities string used in search queries for tier-1 */
  tier1SearchString: string;
  /** Cities string used in search queries for tier-2 */
  tier2SearchString: string;
  /** Tier-2 city mapping by industry */
  tier2CityMap: Record<string, { city: string; multiplier: number }>;
  /** Default salary estimate when agent doesn't provide one (monthly, local currency) */
  defaultMonthlySalary: number;
  /** Amazon domain for book searches */
  amazonDomain: string;
}

export const LOCALE_CONFIGS: Record<CountryCode, LocaleConfig> = {
  IN: {
    code: 'IN',
    label: 'India',
    currency: 'INR',
    currencySymbol: '₹',
    salaryUnit: 'LPA',
    annualToMonthlyDivisor: (lpa) => Math.round((lpa * 100000) / 12),
    numberLocale: 'en-IN',
    searchRegion: 'in',
    searchLang: 'en',
    tier1Cities: ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune'],
    tier2Cities: ['Jaipur', 'Ahmedabad', 'Kochi', 'Lucknow', 'Chandigarh', 'Coimbatore', 'Indore'],
    tier1Label: 'Tier-1',
    tier1Description: 'BLR / DEL / MUM / HYD / CHN / PUNE',
    tier2Label: 'Tier-2',
    tier2Description: 'All other cities',
    jobBoards: ['Naukri', 'LinkedIn', 'Instahyre'],
    geoArbitrageTargets: ['US Remote', 'EU Remote', 'UAE Remote'],
    tier2SalaryMultiplier: 0.75,
    searchCountry: 'in',
    salarySearchTerms: 'salary India CTC LPA',
    tier1SearchString: 'Bangalore Mumbai Delhi Hyderabad',
    tier2SearchString: 'India tier 2 cities Pune Jaipur Ahmedabad',
    tier2CityMap: {
      'IT & Software': { city: 'Pune', multiplier: 0.85 },
      'Finance & Banking': { city: 'Ahmedabad', multiplier: 0.75 },
      'Marketing & Advertising': { city: 'Jaipur', multiplier: 0.70 },
      'Healthcare': { city: 'Chandigarh', multiplier: 0.80 },
      'Manufacturing': { city: 'Coimbatore', multiplier: 0.75 },
      'Creative & Design': { city: 'Kochi', multiplier: 0.70 },
      'Education': { city: 'Lucknow', multiplier: 0.65 },
    },
    defaultMonthlySalary: 83333, // 10 LPA default
    amazonDomain: 'amazon.in',
  },
  US: {
    code: 'US',
    label: 'United States',
    currency: 'USD',
    currencySymbol: '$',
    salaryUnit: 'K/year',
    annualToMonthlyDivisor: (kYear) => Math.round((kYear * 1000) / 12),
    numberLocale: 'en-US',
    searchRegion: 'us',
    searchLang: 'en',
    tier1Cities: ['New York', 'San Francisco', 'Seattle', 'Los Angeles', 'Chicago', 'Boston'],
    tier2Cities: ['Austin', 'Raleigh', 'Denver', 'Nashville', 'Phoenix', 'Charlotte', 'Salt Lake City'],
    tier1Label: 'Major Metro',
    tier1Description: 'NYC / SF / SEA / LA / CHI / BOS',
    tier2Label: 'Secondary Metro',
    tier2Description: 'Austin / Raleigh / Denver / Nashville',
    jobBoards: ['Indeed', 'LinkedIn', 'Glassdoor'],
    geoArbitrageTargets: ['EU Remote', 'APAC Remote', 'LATAM Remote'],
    tier2SalaryMultiplier: 0.80,
    searchCountry: 'us',
    salarySearchTerms: 'salary USA compensation annual K year',
    tier1SearchString: 'New York San Francisco Seattle Los Angeles',
    tier2SearchString: 'Austin Raleigh Denver Nashville secondary metros',
    tier2CityMap: {
      'IT & Software': { city: 'Austin', multiplier: 0.85 },
      'Finance & Banking': { city: 'Charlotte', multiplier: 0.80 },
      'Marketing & Advertising': { city: 'Nashville', multiplier: 0.75 },
      'Healthcare': { city: 'Raleigh', multiplier: 0.80 },
      'Manufacturing': { city: 'Phoenix', multiplier: 0.75 },
      'Creative & Design': { city: 'Denver', multiplier: 0.80 },
      'Education': { city: 'Salt Lake City', multiplier: 0.70 },
    },
    defaultMonthlySalary: 7500, // $90K/year default
    amazonDomain: 'amazon.com',
  },
  AE: {
    code: 'AE',
    label: 'UAE',
    currency: 'AED',
    currencySymbol: 'د.إ',
    salaryUnit: 'K AED/year',
    annualToMonthlyDivisor: (kYear) => Math.round((kYear * 1000) / 12),
    numberLocale: 'en-AE',
    searchRegion: 'ae',
    searchLang: 'en',
    tier1Cities: ['Dubai', 'Abu Dhabi'],
    tier2Cities: ['Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah'],
    tier1Label: 'Major City',
    tier1Description: 'Dubai / Abu Dhabi',
    tier2Label: 'Other Emirates',
    tier2Description: 'Sharjah / Ajman / RAK / Fujairah',
    jobBoards: ['Bayt', 'LinkedIn', 'GulfTalent'],
    geoArbitrageTargets: ['US Remote', 'EU Remote', 'UK Remote'],
    tier2SalaryMultiplier: 0.70,
    searchCountry: 'ae',
    salarySearchTerms: 'salary UAE AED compensation annual package',
    tier1SearchString: 'Dubai Abu Dhabi',
    tier2SearchString: 'Sharjah Ajman UAE secondary cities',
    tier2CityMap: {
      'IT & Software': { city: 'Sharjah', multiplier: 0.80 },
      'Finance & Banking': { city: 'Abu Dhabi', multiplier: 0.90 },
      'Marketing & Advertising': { city: 'Sharjah', multiplier: 0.70 },
      'Healthcare': { city: 'Sharjah', multiplier: 0.75 },
      'Manufacturing': { city: 'Ajman', multiplier: 0.70 },
      'Creative & Design': { city: 'Sharjah', multiplier: 0.70 },
      'Education': { city: 'Ajman', multiplier: 0.65 },
    },
    defaultMonthlySalary: 15000, // ~180K AED/year default
    amazonDomain: 'amazon.ae',
  },
};

export function getLocale(country?: string | null): LocaleConfig {
  const code = (country || 'IN').toUpperCase() as CountryCode;
  return LOCALE_CONFIGS[code] || LOCALE_CONFIGS.IN;
}

/** Format currency amount for display */
export function formatCurrencyServer(amount: number, country?: string | null): string {
  const locale = getLocale(country);
  return new Intl.NumberFormat(locale.numberLocale, {
    style: 'currency',
    currency: locale.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Get the salary prompt hint for Agent 1 based on country */
export function getSalaryPromptHint(country?: string | null): string {
  const locale = getLocale(country);
  switch (locale.code) {
    case 'US':
      return 'estimated_monthly_salary_usd: integer | null (monthly salary in USD)';
    case 'AE':
      return 'estimated_monthly_salary_aed: integer | null (monthly salary in AED)';
    default:
      return 'estimated_monthly_salary_inr: integer | null (monthly salary in INR)';
  }
}

/** Get market context string for agent prompts */
export function getMarketContext(country?: string | null, metroTier?: string | null): string {
  const locale = getLocale(country);
  const tier = metroTier === 'tier2' ? locale.tier2SearchString : locale.tier1SearchString;
  return `${locale.label} (${tier})`;
}

/** Normalize agent salary estimate to a common monthly number based on country */
export function normalizeAgentSalary(estimate: number | null, country?: string | null): number | null {
  if (!estimate || estimate <= 0) return null;
  // Agent returns monthly salary directly — no conversion needed
  // The salary field meaning is consistent: monthly in local currency
  return estimate;
}

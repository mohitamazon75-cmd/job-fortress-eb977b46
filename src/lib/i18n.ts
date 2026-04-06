// ═══════════════════════════════════════════════════════════════
// i18n — Lightweight localization for JobBachao
// Supports EN (English) and HI (Hindi/Hinglish)
// ═══════════════════════════════════════════════════════════════

export type Locale = 'en' | 'hi';

export interface Strings {
  // Landing / Hero
  hero_title: string;
  hero_subtitle: string;
  hero_cta: string;

  // Tabs
  tab_diagnosis: string;
  tab_defense: string;
  tab_intel: string;
  tab_dossier: string;
  tab_coach: string;

  // Diagnosis
  diagnosis_title: string;
  risk_score_label: string;
  months_remaining: string;
  salary_bleed: string;
  high_risk_skills: string;
  safe_skills: string;
  ai_tools_replacing: string;

  // Defense
  defense_title: string;
  immediate_next_step: string;
  weekly_plan: string;
  skill_gap: string;
  geo_arbitrage: string;

  // Intel
  intel_title: string;
  market_signals: string;
  career_shock: string;
  competitive_landscape: string;

  // Common
  loading: string;
  error_generic: string;
  login: string;
  signup: string;
  logout: string;
  delete_my_data: string;
  disclaimer: string;

  // Hinglish tooltips (contextual helpers)
  tooltip_risk_score: string;
  tooltip_salary_bleed: string;
  tooltip_months_remaining: string;
  tooltip_moat_skills: string;
  tooltip_dead_skills: string;
  tooltip_geo_arbitrage: string;
  tooltip_tier2_city: string;
  tooltip_judo_strategy: string;
  tooltip_skill_gap: string;
  tooltip_weekly_plan: string;
  tooltip_what_if: string;
  tooltip_career_shock: string;
  tooltip_peer_comparison: string;
}

const en: Strings = {
  hero_title: 'Will AI Take Your Job?',
  hero_subtitle: 'Get your career risk score in 60 seconds',
  hero_cta: 'Scan My Career',

  tab_diagnosis: 'Diagnosis',
  tab_defense: 'Defense Plan',
  tab_intel: 'Intel',
  tab_dossier: 'Dossier',
  tab_coach: 'Coach',

  diagnosis_title: 'Career Risk Diagnosis',
  risk_score_label: 'Risk Score',
  months_remaining: 'Action window (months)',
  salary_bleed: 'Monthly salary at risk',
  high_risk_skills: 'High-Risk Skills',
  safe_skills: 'Your Moat Skills',
  ai_tools_replacing: 'AI Tools Already Replacing This',

  defense_title: 'Your Defense Plan',
  immediate_next_step: 'Do This First',
  weekly_plan: '12-Week Action Plan',
  skill_gap: 'Skill Gaps to Close',
  geo_arbitrage: 'Better-Paying Markets',

  intel_title: 'Market Intelligence',
  market_signals: 'Market Signals',
  career_shock: 'Career Shock Simulator',
  competitive_landscape: 'Competitive Landscape',

  loading: 'Loading...',
  error_generic: 'Something went wrong. Please try again.',
  login: 'Log In',
  signup: 'Sign Up',
  logout: 'Log Out',
  delete_my_data: 'Delete My Data',
  disclaimer: 'This analysis uses algorithmic models and AI-assisted interpretation. All scores indicate estimated trends, not certainties.',

  tooltip_risk_score: 'How likely AI is to impact your current role. Higher = more urgent action needed.',
  tooltip_salary_bleed: 'Estimated monthly income you could lose if you don\'t upskill.',
  tooltip_months_remaining: 'Your action window — approximate months to proactively reposition before significant AI disruption.',
  tooltip_moat_skills: 'Skills that are hard for AI to replace — your competitive advantage.',
  tooltip_dead_skills: 'Skills being automated fast. Focus on upgrading these.',
  tooltip_geo_arbitrage: 'Earn more by working remotely for companies in higher-paying markets.',
  tooltip_tier2_city: 'Lower cost of living + decent salary = safer fallback path.',
  tooltip_judo_strategy: 'Use AI as your weapon instead of fighting it. Work smarter.',
  tooltip_skill_gap: 'Skills you\'re missing that could unlock higher pay.',
  tooltip_weekly_plan: 'Step-by-step weekly actions to future-proof your career.',
  tooltip_what_if: 'Simulate how learning a new skill changes your risk score.',
  tooltip_career_shock: 'What happens to your role if a major AI breakthrough occurs.',
  tooltip_peer_comparison: 'How you compare to others in your industry and experience level.',
};

const hi: Strings = {
  hero_title: 'क्या AI आपकी नौकरी छीन लेगा?',
  hero_subtitle: '60 सेकंड में अपना career risk score पाएं',
  hero_cta: 'मेरा Career Scan करो',

  tab_diagnosis: 'जाँच',
  tab_defense: 'बचाव Plan',
  tab_intel: 'Intel',
  tab_dossier: 'Dossier',
  tab_coach: 'Coach',

  diagnosis_title: 'Career Risk जाँच',
  risk_score_label: 'Risk Score',
  months_remaining: 'Action window (महीने)',
  salary_bleed: 'हर महीने कितनी salary risk में',
  high_risk_skills: 'ख़तरे वाली Skills',
  safe_skills: 'आपकी Safe Skills',
  ai_tools_replacing: 'ये AI Tools पहले से replace कर रहे हैं',

  defense_title: 'आपका बचाव Plan',
  immediate_next_step: 'पहले ये करो',
  weekly_plan: '12-हफ़्ते का Action Plan',
  skill_gap: 'ये Skills सीखनी हैं',
  geo_arbitrage: 'ज़्यादा पैसे वाले Markets',

  intel_title: 'Market Intelligence',
  market_signals: 'Market Signals',
  career_shock: 'Career Shock Simulator',
  competitive_landscape: 'Competition कैसी है',

  loading: 'लोड हो रहा है...',
  error_generic: 'कुछ गड़बड़ हो गई। दोबारा कोशिश करें।',
  login: 'लॉग इन',
  signup: 'साइन अप',
  logout: 'लॉग आउट',
  delete_my_data: 'मेरा Data Delete करो',
  disclaimer: 'ये analysis AI models पर based है। सब scores estimated trends हैं, पक्की बात नहीं।',

  // Hinglish tooltips — conversational, relatable
  tooltip_risk_score: 'AI से आपकी job को कितना ख़तरा है। ज़्यादा score = जल्दी action लो।',
  tooltip_salary_bleed: 'Agar upskill nahi kiya toh har mahine kitni salary doob sakti hai।',
  tooltip_months_remaining: 'Aapke paas kitne mahine hain career reposition karne ke liye — AI disruption se pehle।',
  tooltip_moat_skills: 'Ye skills AI ke liye mushkil hain — yahi aapki taqat hai।',
  tooltip_dead_skills: 'Ye skills tezi se automate ho rahi hain। Inhe upgrade karo।',
  tooltip_geo_arbitrage: 'Remote kaam karke zyada paisa kamao — bahar ki companies ke liye kaam karo।',
  tooltip_tier2_city: 'Chhote shahar mein sasta rehna + achhi salary = safe backup plan।',
  tooltip_judo_strategy: 'AI se lado mat — AI ko apna hathiyaar banao। Smart kaam karo।',
  tooltip_skill_gap: 'Ye skills nahi hain aapke paas jo zyada paisa unlock kar sakti hain।',
  tooltip_weekly_plan: 'Har hafte kya karna hai — step by step career ko future-proof banao।',
  tooltip_what_if: 'Dekho nayi skill seekhne se risk score kaise badalta hai।',
  tooltip_career_shock: 'Agar koi bada AI breakthrough aaye toh aapki role ka kya hoga।',
  tooltip_peer_comparison: 'Aapki industry aur experience level mein doosron se comparison।',
};

const STRINGS: Record<Locale, Strings> = { en, hi };

/** Get all strings for a locale */
export function getStrings(locale: Locale = 'en'): Strings {
  return STRINGS[locale] || STRINGS.en;
}

/** Get a single string key */
export function t(key: keyof Strings, locale: Locale = 'en'): string {
  return (STRINGS[locale] || STRINGS.en)[key];
}

/** Detect locale from country code — IN defaults to 'hi', others 'en' */
export function localeFromCountry(country?: string | null): Locale {
  // For now, always default to 'en' — user can toggle
  // When Hindi toggle is ON, return 'hi' for IN users
  return 'en';
}

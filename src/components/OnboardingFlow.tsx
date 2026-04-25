import { useState } from 'react';
import { motion } from 'framer-motion';
import { INDUSTRIES, EXPERIENCE_LEVELS, METRO_TIERS_BY_COUNTRY, COUNTRIES } from '@/lib/types';
import { sanitizePromptInput } from '@/lib/prompt-safety';
import { Briefcase, Clock, MapPin, Check, Globe, ArrowLeft, Sparkles, Monitor, Landmark, Megaphone, Heart, Factory, Palette, BookOpen, Building2, Truck, ShoppingCart, Utensils, Plane, Scale } from 'lucide-react';

interface OnboardingFlowProps {
  step: number;
  country: string;
  industry: string;
  yearsExperience: string;
  metroTier: string;
  monthlyCTC: number | null;
  hasLinkedIn?: boolean;
  hasResume?: boolean;
  onSelectCountry: (v: string) => void;
  onSelectIndustry: (v: string) => void;
  onSelectExperience: (v: string) => void;
  onSelectMetro: (v: string) => void;
  onSubmitCTC: (monthlyInLocalCurrency: number | null) => void;
  onSelectSkills?: (skills: string) => void;
  onSkipSkills?: () => void;
  onBack?: (fromStep: number) => void;
  onSkillsError?: (error: string) => void;
}

import type { LucideIcon } from 'lucide-react';
const INDUSTRY_ICONS: Record<string, LucideIcon> = {
  'IT & Software': Monitor,
  'Finance & Banking': Landmark,
  'Marketing & Advertising': Megaphone,
  'Healthcare': Heart,
  'Manufacturing': Factory,
  'Creative & Design': Palette,
  'Education': BookOpen,
  'Real Estate': Building2,
  'Logistics & Supply Chain': Truck,
  'Retail & E-commerce': ShoppingCart,
  'Food & Hospitality': Utensils,
  'Travel & Tourism': Plane,
  'Legal & Compliance': Scale,
};

export default function OnboardingFlow({
  step,
  country,
  industry,
  yearsExperience,
  metroTier,
  monthlyCTC,
  hasLinkedIn = false,
  hasResume = false,
  onSelectCountry,
  onSelectIndustry,
  onSelectExperience,
  onSelectMetro,
  onSubmitCTC,
  onSelectSkills,
  onSkipSkills,
  onBack,
  onSkillsError,
}: OnboardingFlowProps) {
  const [skillsInput, setSkillsInput] = useState('');
  const [customIndustry, setCustomIndustry] = useState('');
  const [customIndustryError, setCustomIndustryError] = useState('');
  const [skillsError, setSkillsError] = useState('');
  const [ctcInput, setCtcInput] = useState<string>(monthlyCTC ? String(monthlyCTC) : '');
  const [ctcError, setCtcError] = useState('');
  const isManualPath = !hasLinkedIn && !hasResume;
  // Step 5 = CTC for everyone. Skills (manual path only) becomes step 6.
  const showSkillsStep = isManualPath && step === 6;
  const showCTCStep = step === 5;

  // Currency config per country — drives quick-pick bands and label.
  // Bands chosen to cover ~80% of users without forcing them to type.
  const currencyConfig = (() => {
    switch (country) {
      case 'US':
        return {
          symbol: '$', code: 'USD', label: 'monthly take-home',
          // monthly take-home in USD — entry, mid, senior, exec
          quickPicks: [3000, 5500, 9000, 15000],
          minValid: 500, maxValid: 100000,
        };
      case 'AE':
        return {
          symbol: 'AED', code: 'AED', label: 'monthly salary',
          quickPicks: [8000, 18000, 35000, 60000],
          minValid: 1000, maxValid: 500000,
        };
      default: // IN and others
        return {
          symbol: '₹', code: 'INR', label: 'monthly in-hand',
          // monthly in-hand INR — junior, mid, senior, lead/director
          quickPicks: [50000, 120000, 250000, 500000],
          minValid: 5000, maxValid: 5000000,
        };
    }
  })();

  const handleSubmitCTC = () => {
    const trimmed = ctcInput.trim();
    if (!trimmed) {
      // Treat empty as skip — pass null
      onSubmitCTC(null);
      return;
    }
    const parsed = Number(trimmed.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(parsed) || parsed < currencyConfig.minValid || parsed > currencyConfig.maxValid) {
      setCtcError(`Enter a value between ${currencyConfig.symbol}${currencyConfig.minValid.toLocaleString()} and ${currencyConfig.symbol}${currencyConfig.maxValid.toLocaleString()}`);
      return;
    }
    setCtcError('');
    onSubmitCTC(Math.round(parsed));
  };

  const stepConfig = [
    { label: 'Location', icon: Globe },
    { label: 'Industry', icon: Briefcase },
    { label: 'Experience', icon: Clock },
    { label: 'Metro', icon: MapPin },
    { label: 'Salary', icon: Sparkles },
    ...(isManualPath ? [{ label: 'Skills', icon: Sparkles }] : []),
  ];

  const metroTiers = METRO_TIERS_BY_COUNTRY[country] || METRO_TIERS_BY_COUNTRY.IN;
  const totalSteps = isManualPath ? 6 : 5;

  const handleSkillsSubmit = () => {
    // Sanitize each skill individually so injection phrases get filtered
    // before they ever reach the LLM pipeline.
    const cleanedSkills = skillsInput
      .split(/[,\n]+/)
      .map(s => sanitizePromptInput(s, { maxLength: 60 }))
      .filter(Boolean);
    if (cleanedSkills.length > 20) {
      setSkillsError('Please enter your top 20 skills maximum');
      onSkillsError?.('Please enter your top 20 skills maximum');
      return;
    }
    setSkillsError('');
    onSelectSkills?.(cleanedSkills.join(', '));
  };


  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 dot-pattern opacity-30" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.04] blur-[100px] pointer-events-none" style={{ background: 'hsl(var(--primary))' }} />

      {/* Header */}
      <div className="relative z-10 px-6 md:px-12 py-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xs" style={{ background: 'var(--gradient-primary)' }}>
            JB
          </div>
          <span className="text-lg font-black tracking-tight text-foreground">JOB BACHAO</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 px-6 md:px-12 mb-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            {stepConfig.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  i + 1 < step ? 'bg-primary text-primary-foreground shadow-sm' :
                  i + 1 === step ? 'bg-primary text-primary-foreground shadow-md' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {i + 1 < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-sm font-medium hidden sm:inline transition-colors ${
                  i + 1 <= step ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {s.label}
                </span>
                {i < totalSteps - 1 && (
                  <div className={`w-12 h-0.5 rounded-full mx-2 transition-colors ${
                    i + 1 < step ? 'bg-primary' : 'bg-border'
                  }`} />
                )}
              </div>
            ))}
          </div>
          {/* Full progress bar */}
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--gradient-primary)' }}
              initial={{ width: '0%' }}
              animate={{ width: `${((step - 1) / totalSteps) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* Back button */}
      {onBack && (
        <div className="relative z-10 px-6 md:px-12 mb-2">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => onBack(step)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex-1 flex items-start justify-center px-4 pt-4">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-lg"
        >
          {/* Step 1: Country */}
          {step === 1 && (
            <div>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">Where are you based?</h2>
                <p className="text-muted-foreground">We'll tailor salary data, job boards, and market signals to your region.</p>
              </div>
              <div className="flex flex-col gap-3">
                {COUNTRIES.map((c) => (
                  <motion.button
                    key={c.value}
                    whileHover={c.comingSoon ? {} : { scale: 1.01 }}
                    whileTap={c.comingSoon ? {} : { scale: 0.99 }}
                    onClick={() => !c.comingSoon && onSelectCountry(c.value)}
                    disabled={c.comingSoon}
                    className={`p-6 rounded-xl border text-left transition-all duration-200 ${
                      c.comingSoon
                        ? 'border-border bg-muted/40 opacity-60 cursor-not-allowed'
                        : country === c.value
                        ? 'border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20'
                        : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{c.flag}</span>
                      <span className={`text-lg font-bold ${
                        c.comingSoon ? 'text-muted-foreground' : country === c.value ? 'text-primary' : 'text-foreground'
                      }`}>
                        {c.label}
                      </span>
                      {c.comingSoon && (
                        <span className="ml-auto text-xs font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full">
                          Coming Soon
                        </span>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
              {/* Continue button when country is pre-selected */}
              {country && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  onClick={() => onSelectCountry(country)}
                  className="mt-6 w-full py-3 rounded-xl font-semibold text-primary-foreground transition-all"
                  style={{ background: 'var(--gradient-primary)' }}
                >
                  Continue
                </motion.button>
              )}
            </div>
          )}

          {/* Step 2: Industry */}
          {step === 2 && (
            <div>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">What's your industry?</h2>
                <p className="text-muted-foreground">This determines which AI disruption models we run against your role.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {INDUSTRIES.map((ind) => {
                  const IndIcon = INDUSTRY_ICONS[ind] || Globe;
                  return (
                    <motion.button
                      key={ind}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onSelectIndustry(ind)}
                      className={`p-4 rounded-xl border text-left font-medium transition-all duration-200 flex items-center gap-3 ${
                        industry === ind
                          ? 'border-primary bg-primary/5 text-foreground shadow-sm ring-2 ring-primary/20'
                          : 'border-border bg-card text-foreground hover:border-primary/30 hover:shadow-sm'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        industry === ind ? 'bg-primary/10' : 'bg-muted'
                      }`}>
                        <IndIcon className={`w-4 h-4 ${industry === ind ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <span className="text-sm">{ind}</span>
                    </motion.button>
                  );
                })}
              </div>
              {/* Custom industry input */}
              <div className="mt-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customIndustry}
                    onChange={e => {
                      const val = e.target.value;
                      setCustomIndustry(val);
                      const trimmed = val.trim();
                      if (!trimmed) { setCustomIndustryError(''); return; }
                      if (trimmed.length < 3) { setCustomIndustryError('Too short — enter a real industry name.'); return; }
                      if (!/^[a-zA-Z0-9\s&,\-\/().]+$/.test(trimmed)) { setCustomIndustryError('Only letters, numbers, and basic punctuation allowed.'); return; }
                      if (/(.)\1{4,}/.test(trimmed)) { setCustomIndustryError('Please enter a valid industry name.'); return; }
                      if (trimmed.split(/\s+/).length > 6) { setCustomIndustryError('Keep it short — max 6 words.'); return; }
                      const blocked = ['drug','drugs','dealer','trafficking','smuggling','porn','pornography','gambling','illegal','murder','killing','theft','robbery','scam','fraud','prostitution','hitman','assassin','cartel','mafia','terrorist','terrorism','hacking','piracy','counterfeit','laundering','extortion','blackmail','kidnapping','arson','bribery','poaching'];
                      const words = trimmed.toLowerCase().split(/\s+/);
                      if (words.some(w => blocked.includes(w))) { setCustomIndustryError('Please enter a legitimate industry.'); return; }
                      setCustomIndustryError('');
                    }}
                    onKeyDown={e => { if (e.key === 'Enter' && customIndustry.trim() && !customIndustryError) onSelectIndustry(customIndustry.trim()); }}
                    placeholder="Or type your industry..."
                    maxLength={60}
                    className={`flex-1 h-12 rounded-xl border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 transition-all ${
                      customIndustryError ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : 'border-border focus:border-primary focus:ring-primary/20'
                    }`}
                  />
                  {customIndustry.trim() && !customIndustryError && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onSelectIndustry(sanitizePromptInput(customIndustry, { maxLength: 60 }))}
                      className="h-12 px-5 rounded-xl font-semibold text-sm text-primary-foreground shrink-0"
                      style={{ background: 'var(--gradient-primary)' }}
                    >
                      Continue
                    </motion.button>
                  )}
                </div>
                {customIndustryError && (
                  <p className="text-xs text-destructive font-medium mt-1.5 px-1">{customIndustryError}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Experience */}
          {step === 3 && (
            <div>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">Years of experience</h2>
                <p className="text-muted-foreground">Seniority significantly affects your AI resilience score.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {EXPERIENCE_LEVELS.map((exp) => (
                  <motion.button
                    key={exp.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSelectExperience(exp.value)}
                    className={`p-6 rounded-xl border text-center transition-all duration-200 ${
                      yearsExperience === exp.value
                        ? 'border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20'
                        : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
                    }`}
                  >
                    <span className={`text-xl font-bold block ${
                      yearsExperience === exp.value ? 'text-primary' : 'text-foreground'
                    }`}>
                      {exp.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Metro */}
          {step === 4 && (
            <div>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">Your city size</h2>
                <p className="text-muted-foreground">This helps us time your preparation plan accurately — it doesn't lower your score, it sharpens your timeline.</p>
              </div>
              <div className="flex flex-col gap-3">
                {metroTiers.map((mt) => (
                  <motion.button
                    key={mt.value}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => onSelectMetro(mt.value)}
                    className={`p-6 rounded-xl border text-left transition-all duration-200 ${
                      metroTier === mt.value
                        ? 'border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20'
                        : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`text-lg font-bold ${
                          metroTier === mt.value ? 'text-primary' : 'text-foreground'
                        }`}>
                          {mt.label}
                        </span>
                        <p className="text-muted-foreground text-sm mt-1">{mt.description}</p>
                      </div>
                      <MapPin className={`w-5 h-5 ${
                        metroTier === mt.value ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Monthly Salary (CTC) — optional, but enables salary-bleed kill-shot */}
          {showCTCStep && (
            <div>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">Your {currencyConfig.label}</h2>
                <p className="text-muted-foreground">
                  Lets us calculate exactly how much salary AI puts at risk for <span className="font-medium text-foreground">your</span> package.
                  Skip if you'd rather not — we'll show ranges instead.
                </p>
              </div>

              <div className="space-y-4">
                {/* Quick-pick bands */}
                <div className="grid grid-cols-2 gap-3">
                  {currencyConfig.quickPicks.map((amount) => {
                    const isActive = monthlyCTC === amount;
                    return (
                      <motion.button
                        key={amount}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setCtcInput(String(amount));
                          setCtcError('');
                          onSubmitCTC(amount);
                        }}
                        className={`p-4 rounded-xl border text-center transition-all duration-200 ${
                          isActive
                            ? 'border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20'
                            : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
                        }`}
                      >
                        <span className={`text-lg font-bold block ${
                          isActive ? 'text-primary' : 'text-foreground'
                        }`}>
                          {currencyConfig.symbol}{amount.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">/month</span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Custom input */}
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                    Or enter exact amount ({currencyConfig.code} per month)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                      {currencyConfig.symbol}
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={ctcInput}
                      onChange={(e) => {
                        setCtcInput(e.target.value);
                        setCtcError('');
                      }}
                      placeholder="e.g. 150000"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                  {ctcError && <p className="text-xs text-destructive font-medium mt-1.5">{ctcError}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Stored privately, only used to compute your salary-at-risk number.
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleSubmitCTC}
                  className="w-full py-3 rounded-xl font-semibold text-primary-foreground transition-all"
                  style={{ background: 'var(--gradient-primary)' }}
                >
                  Continue
                </motion.button>
                <button
                  onClick={() => onSubmitCTC(null)}
                  className="w-full py-3 rounded-xl font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip — show salary as a range
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Key Skills (manual path only) */}
          {showSkillsStep && (
            <div>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">Your key skills</h2>
                <p className="text-muted-foreground">List 3-20 skills you use daily. Enter comma or newline-separated. This dramatically improves accuracy.</p>
              </div>
              <div className="space-y-4">
                <textarea
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  placeholder="e.g. Python, Data Analysis, Project Management, SQL, Client Communication"
                  className="w-full min-h-[120px] p-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  autoFocus
                />
                {skillsError && <p className="text-xs text-destructive font-medium">{skillsError}</p>}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleSkillsSubmit}
                  disabled={!skillsInput.trim()}
                  className="w-full py-3 rounded-xl font-semibold text-primary-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'var(--gradient-primary)' }}
                >
                  Analyze My Skills
                </motion.button>
                <button
                  onClick={() => onSkipSkills?.()}
                  className="w-full py-3 rounded-xl font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip — use industry defaults
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

import { useState, useCallback, useMemo } from 'react';
import { type Locale, type Strings, getStrings } from '@/lib/i18n';

/** Hook providing locale state + translated strings */
export function useLocale(initialLocale: Locale = 'en') {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  const strings = useMemo(() => getStrings(locale), [locale]);

  const toggleLocale = useCallback(() => {
    setLocale(prev => prev === 'en' ? 'hi' : 'en');
  }, []);

  return { locale, setLocale, toggleLocale, strings };
}

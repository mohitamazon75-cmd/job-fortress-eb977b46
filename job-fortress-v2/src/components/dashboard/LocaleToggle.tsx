import { motion } from 'framer-motion';
import type { Locale } from '@/lib/i18n';

interface LocaleToggleProps {
  locale: Locale;
  onToggle: () => void;
}

/** Compact EN/HI toggle button for the dashboard header */
export default function LocaleToggle({ locale, onToggle }: LocaleToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="relative flex items-center w-14 h-7 rounded-full border border-border bg-muted/50 hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Switch language to ${locale === 'en' ? 'Hindi' : 'English'}`}
      title={locale === 'en' ? 'हिंदी में देखें' : 'Switch to English'}
    >
      <motion.div
        className="absolute w-6 h-5 rounded-full bg-primary shadow-sm"
        animate={{ x: locale === 'en' ? 2 : 26 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
      <span className={`relative z-10 flex-1 text-center text-[10px] font-bold ${locale === 'en' ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
        EN
      </span>
      <span className={`relative z-10 flex-1 text-center text-[10px] font-bold ${locale === 'hi' ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
        हि
      </span>
    </button>
  );
}

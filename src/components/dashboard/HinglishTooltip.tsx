import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HinglishTooltipProps {
  /** English explanation */
  en: string;
  /** Hindi/Hinglish explanation */
  hi?: string;
  /** Which locale is active */
  locale?: 'en' | 'hi';
  /** Optional className for the trigger icon */
  className?: string;
}

/**
 * Small info icon that shows a contextual tooltip.
 * Displays Hinglish text when locale=hi, English otherwise.
 * Always shows both for Indian users to build understanding.
 */
export default function HinglishTooltip({ en, hi, locale = 'en', className }: HinglishTooltipProps) {
  const showHindi = locale === 'hi' && hi;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className || ''}`}
            aria-label="More info"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[260px] text-xs leading-relaxed"
        >
          {showHindi ? (
            <div className="space-y-1">
              <p className="font-medium">{hi}</p>
              <p className="text-muted-foreground text-[10px]">{en}</p>
            </div>
          ) : (
            <p>{en}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

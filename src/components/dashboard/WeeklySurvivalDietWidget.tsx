import { motion } from 'framer-motion';
import { BookOpen, Play, Headphones, ExternalLink } from 'lucide-react';

interface DietItem {
  title: string;
  action: string;
  time_commitment: string;
}

interface WeeklySurvivalDiet {
  theme: string;
  read: DietItem;
  watch: DietItem;
  listen: DietItem;
}

interface Props {
  diet: WeeklySurvivalDiet;
}

function buildSearchUrl(key: 'read' | 'watch' | 'listen', title: string): string {
  const q = encodeURIComponent(title);
  if (key === 'read') return `https://www.amazon.in/s?k=${q}`;
  if (key === 'watch') return `https://www.youtube.com/results?search_query=${q}`;
  return `https://www.google.com/search?q=${q}+podcast`;
}

const items = [
  { key: 'read' as const, label: 'Read', Icon: BookOpen, accent: 'text-primary', bg: 'bg-primary/10' },
  { key: 'watch' as const, label: 'Watch', Icon: Play, accent: 'text-prophet-red', bg: 'bg-prophet-red/10' },
  { key: 'listen' as const, label: 'Listen', Icon: Headphones, accent: 'text-prophet-gold', bg: 'bg-prophet-gold/10' },
] as const;

export default function WeeklySurvivalDietWidget({ diet }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-border bg-card p-5 md:p-6 mt-4"
    >
      <div className="mb-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
          🍽️ Your Weekly Survival Diet
        </h3>
        <p className="text-xs text-muted-foreground mt-1">{diet.theme}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map(({ key, label, Icon, accent, bg }) => {
          const item = diet[key];
          if (!item) return null;
          return (
            <a
              key={key}
              href={buildSearchUrl(key, item.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-border bg-background p-4 flex flex-col gap-2 hover:border-primary/40 hover:shadow-md transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${accent}`} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
                <span className="ml-auto text-[10px] font-bold text-prophet-green bg-prophet-green/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {item.time_commitment}
                </span>
              </div>
              <p className="text-sm font-bold text-foreground leading-snug group-hover:text-primary transition-colors">{item.title}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground leading-relaxed">{item.action}</p>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary flex-shrink-0 ml-2 transition-colors" />
              </div>
            </a>
          );
        })}
      </div>
    </motion.div>
  );
}

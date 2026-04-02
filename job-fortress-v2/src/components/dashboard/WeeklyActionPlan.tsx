import { type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle, BookOpen, GraduationCap, Play, Loader2 } from 'lucide-react';
import { type WeeklyAction } from '@/lib/scan-engine';
import { type LiveEnrichment } from '@/hooks/use-live-enrichment';

interface WeeklyActionPlanProps {
  actions: WeeklyAction[];
  role?: string;
  industry?: string;
  enrichment?: LiveEnrichment | null;
  enrichmentLoading?: boolean;
}

export default function WeeklyActionPlan({ actions, role, industry, enrichment, enrichmentLoading }: WeeklyActionPlanProps) {
  if (!actions?.length) return null;

  const dotColors = ['bg-primary', 'bg-prophet-cyan', 'bg-prophet-gold', 'bg-prophet-green'];

  const resolveExternalUrl = (url: string) => {
    if (!url) return '#';
    return /^https?:\/\//i.test(url) ? url : `https://${url.replace(/^\/+/, '')}`;
  };

  const buildSafeUrl = (url: string, fallbackQuery: string, type?: 'book' | 'course' | 'video') => {
    if (url && /^https?:\/\//i.test(url)) return url;
    // Generate search-based URLs by resource type
    if (type === 'book') return `https://www.amazon.in/s?k=${encodeURIComponent(fallbackQuery)}`;
    if (type === 'video') return `https://www.youtube.com/results?search_query=${encodeURIComponent(fallbackQuery)}`;
    return `https://www.google.com/search?q=${encodeURIComponent(fallbackQuery || url)}`;
  };

  // Distribute enrichment resources across weeks
  const booksPerWeek = enrichment?.books ? Math.ceil(enrichment.books.length / actions.length) : 0;
  const coursesPerWeek = enrichment?.courses ? Math.ceil(enrichment.courses.length / actions.length) : 0;
  const videosPerWeek = enrichment?.videos ? Math.ceil(enrichment.videos.length / actions.length) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mb-6"
    >
      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
        <CalendarDays className="w-4 h-4" />
        4-Week Action Plan
      </h2>
      <p className="text-xs text-muted-foreground mb-4 ml-6">
        Personalized for <span className="font-semibold text-foreground">{role || 'your role'}</span>
        {industry ? ` in ${industry}` : ''} — KG inference engine
        {enrichment ? ' + live search' : ''}
      </p>

      <div className="relative pl-6">
        <div className="absolute left-2.5 top-0 bottom-0 w-px border-l-2 border-dashed border-border" />

        {actions.map((action, i) => {
          const dotColor = dotColors[i] || 'bg-primary';

          const weekBooks = action.books?.length ? action.books :
            enrichment?.books?.slice(i * booksPerWeek, (i + 1) * booksPerWeek) || [];
          const weekCourses = action.courses?.length ? action.courses :
            enrichment?.courses?.slice(i * coursesPerWeek, (i + 1) * coursesPerWeek) || [];
          const weekVideos = action.videos?.length ? action.videos :
            enrichment?.videos?.slice(i * videosPerWeek, (i + 1) * videosPerWeek) || [];

          const hasResources = weekBooks.length > 0 || weekCourses.length > 0 || weekVideos.length > 0;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.15 }}
              className="relative mb-4 last:mb-0"
            >
              <div className={`absolute -left-3.5 top-4 w-3 h-3 rounded-full ${dotColor} border-4 border-background shadow-sm`} />

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-primary-foreground ${dotColor}`}>
                    Week {action.week}
                  </span>
                  <span className="text-xs font-bold text-foreground">{action.theme}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{action.effort_hours}h</span>
                </div>

                <p className="text-sm text-foreground mb-2">{action.action}</p>

                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-3 h-3 text-prophet-green flex-shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Deliverable:</span> {action.deliverable}
                  </span>
                </div>

                {action.fallback_action && (
                  <p className="text-[10px] text-muted-foreground mb-2 pl-5 italic">
                    Fallback: {action.fallback_action}
                  </p>
                )}

                {/* Learning Resources — standard links */}
                {hasResources && (
                  <div className="border-t border-border pt-3 mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">📚 Resources</p>
                      {enrichment && <span className="text-[10px] font-semibold text-prophet-green bg-prophet-green/10 px-1.5 py-0.5 rounded-full">LIVE</span>}
                    </div>

                    {weekBooks.map((b: any, bi: number) => {
                      const searchQuery = `${b.title} ${b.author_or_platform || b.author || ''}`;
                      const bookUrl = buildSafeUrl(b.url, searchQuery, 'book');
                      return (
                        <div key={`b-${bi}`} className="flex items-start gap-2 text-xs">
                          <BookOpen className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <a href={bookUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:text-primary/80 underline decoration-primary/40 hover:decoration-primary transition-colors cursor-pointer">
                              {b.title}
                            </a>
                            <span className="text-muted-foreground"> — {b.author_or_platform || b.author} {b.year ? `(${b.year})` : ''}</span>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{b.why_relevant}</p>
                          </div>
                        </div>
                      );
                    })}

                    {weekCourses.map((c: any, ci: number) => {
                      const searchQuery = `${c.title} ${c.author_or_platform || c.platform || ''} course`;
                      const courseUrl = buildSafeUrl(c.url, searchQuery, 'course');
                      return (
                        <div key={`c-${ci}`} className="flex items-start gap-2 text-xs">
                          <GraduationCap className="w-3 h-3 text-prophet-gold mt-0.5 flex-shrink-0" />
                          <div>
                            <a href={courseUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-prophet-gold hover:text-prophet-gold/80 underline decoration-prophet-gold/40 hover:decoration-prophet-gold transition-colors cursor-pointer">
                              {c.title}
                            </a>
                            <span className="text-muted-foreground"> — {c.author_or_platform || c.platform}</span>
                            {c.verified === true && <span className="ml-1 text-[10px] font-bold text-prophet-green">✓ Verified</span>}
                            {c.verified === false && <span className="ml-1 text-[10px] font-bold text-prophet-gold">⚠ Unverified</span>}
                            <p className="text-[10px] text-muted-foreground mt-0.5">{c.why_relevant}</p>
                          </div>
                        </div>
                      );
                    })}

                    {weekVideos.map((v: any, vi: number) => {
                      const searchQuery = `${v.title} ${v.author_or_platform || v.channel || ''}`;
                      const videoUrl = buildSafeUrl(v.url, searchQuery, 'video');
                      return (
                        <div key={`v-${vi}`} className="flex items-start gap-2 text-xs">
                          <Play className="w-3 h-3 text-prophet-red mt-0.5 flex-shrink-0" />
                          <div>
                            <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-prophet-red hover:text-prophet-red/80 underline decoration-prophet-red/40 hover:decoration-prophet-red transition-colors cursor-pointer">
                              {v.title}
                            </a>
                            <span className="text-muted-foreground"> — {v.author_or_platform || v.channel}</span>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{v.why_relevant}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Loading state for enrichment */}
                {!hasResources && enrichmentLoading && (
                  <div className="border-t border-border pt-3 mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Searching for relevant resources...</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {enrichment?.resource_citations && enrichment.resource_citations.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-2 ml-6">
          Sources: {enrichment.resource_citations.slice(0, 4).map((c, i) => (
            <a key={i} href={c} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground mr-2">[{i + 1}]</a>
          ))}
        </p>
      )}
    </motion.div>
  );
}

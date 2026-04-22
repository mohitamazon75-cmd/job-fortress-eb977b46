import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
}

/**
 * Lightweight per-route SEO updater.
 * Sets <title>, meta description, canonical, OG/Twitter tags, and optional noindex.
 * Cleans up only the canonical href on unmount (other tags persist with new values
 * on next route — the next page's SEO component will overwrite them).
 */
export default function SEO({ title, description, canonical, ogImage, noindex }: SEOProps) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.head.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
      if (!el) {
        if (selector.startsWith('link')) {
          el = document.createElement('link');
          (el as HTMLLinkElement).rel = selector.match(/rel="([^"]+)"/)?.[1] ?? '';
        } else {
          el = document.createElement('meta');
          const nameMatch = selector.match(/name="([^"]+)"/);
          const propMatch = selector.match(/property="([^"]+)"/);
          if (nameMatch) (el as HTMLMetaElement).name = nameMatch[1];
          if (propMatch) (el as HTMLMetaElement).setAttribute('property', propMatch[1]);
        }
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', description);

    if (canonical) {
      setMeta('link[rel="canonical"]', 'href', canonical);
      setMeta('meta[property="og:url"]', 'content', canonical);
    }
    if (ogImage) {
      setMeta('meta[property="og:image"]', 'content', ogImage);
      setMeta('meta[name="twitter:image"]', 'content', ogImage);
    }

    // Robots
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (noindex) {
      if (!robots) {
        robots = document.createElement('meta');
        robots.name = 'robots';
        document.head.appendChild(robots);
      }
      robots.content = 'noindex, nofollow';
    } else if (robots) {
      robots.content = 'index, follow';
    }

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, canonical, ogImage, noindex]);

  return null;
}

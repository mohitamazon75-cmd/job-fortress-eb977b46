import { useEffect } from "react";
import DiagnosticCard from "@/components/diagnostic/DiagnosticCard";

export default function DiagnosticPage() {
  useEffect(() => {
    document.title = "Will My Boss Replace Me? Free AI Career Risk Test | JobBachao";

    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(name.startsWith('og:') || name.startsWith('twitter:') ? 'property' : 'name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('description', 'Free AI career risk diagnostic. Find out if your boss can replace you with AI — get your risk score, survival plan & 6 ready-to-use prompts in 90 seconds.');
    setMeta('og:title', 'Will My Boss Replace Me? Free AI Career Risk Test');
    setMeta('og:description', 'Get your AI replacement risk score in 90 seconds. Free diagnostic with survival plan & ready-to-use prompts.');
    setMeta('og:url', 'https://jobbachao.com/diagnostic');
    setMeta('og:type', 'website');
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', 'Will My Boss Replace Me? Free AI Career Risk Test');
    setMeta('twitter:description', 'Get your AI replacement risk score in 90 seconds. Free diagnostic with survival plan.');

    // Schema.org FAQ structured data
    let script = document.getElementById('diagnostic-faq-schema') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'diagnostic-faq-schema';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Will AI replace my job?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "It depends on your role, skills, and industry. Our free diagnostic analyzes your specific job title against AI capabilities to give you a personalized risk score and survival plan."
          }
        },
        {
          "@type": "Question",
          "name": "How does the AI career risk test work?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Enter your job title, salary, and experience level. Our AI engine maps your role against automation capabilities, calculates your replacement cost, and generates a personalized survival plan with actionable prompts."
          }
        },
        {
          "@type": "Question",
          "name": "Is the career risk diagnostic free?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes, the diagnostic is 100% free. No sign-up required. You get your risk score, AI vs human skill breakdown, survival plan, and 6 ready-to-use prompts in about 90 seconds."
          }
        }
      ]
    });

    return () => {
      script?.remove();
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <DiagnosticCard />
    </div>
  );
}

import { Phone, Heart } from 'lucide-react';

/**
 * Crisis support strip. Surfaces verified Indian mental-health helplines after
 * the high-emotional-impact Replacement Invoice (MoneyShotCard).
 *
 * Sources verified 2026-04-25:
 *  - iCall (TISS):     9152987821       (Mon–Sat 8am–10pm)
 *  - Vandrevala Fdn:   1860-2662-345    (24×7)
 *  - AASRA:            +91-9820466726    (24×7)
 *  - Govt KIRAN:       1800-599-0019    (24×7, multilingual)
 *
 * This component is **non-blocking** — it never gates the user's flow. It is
 * rendered as a calm footer strip; users who don't need it can ignore it.
 */
export default function CrisisSupport() {
  const lines: { name: string; number: string; href: string; hours: string }[] = [
    { name: 'iCall (TISS)',   number: '9152987821',     href: 'tel:+919152987821',   hours: 'Mon–Sat 8am–10pm' },
    { name: 'Vandrevala',     number: '1860-2662-345',  href: 'tel:18602662345',     hours: '24×7' },
    { name: 'AASRA',          number: '+91 98204 66726', href: 'tel:+919820466726',  hours: '24×7' },
    { name: 'KIRAN (Govt)',   number: '1800-599-0019',  href: 'tel:18005990019',     hours: '24×7, multilingual' },
  ];

  return (
    <aside
      role="complementary"
      aria-label="Mental health support resources"
      className="mx-auto max-w-2xl my-8 rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-5 sm:p-6"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Heart className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">If this report hit hard, you're not alone.</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            A score is not your worth. If you're feeling overwhelmed, please talk to someone — these
            free, confidential Indian helplines are staffed by trained counsellors.
          </p>
        </div>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {lines.map(l => (
          <li key={l.name}>
            <a
              href={l.href}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/[0.04] transition-colors text-xs"
            >
              <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="font-semibold text-foreground">{l.name}</span>
              <span className="text-muted-foreground tabular-nums ml-auto">{l.number}</span>
              <span className="text-[10px] text-muted-foreground/70 hidden sm:inline">· {l.hours}</span>
            </a>
          </li>
        ))}
      </ul>

      <p className="text-[10px] text-muted-foreground/60 mt-3 text-center">
        In an emergency, dial 112. JobBachao is not a substitute for professional mental-health care.
      </p>
    </aside>
  );
}

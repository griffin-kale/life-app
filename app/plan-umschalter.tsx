import Link from 'next/link';

/** Plan (0.28, Peter 31.10.2026): Woche und Saison sind zwei Ansichten derselben Seite. */
export function PlanUmschalter({ an }: { an: 'woche' | 'saison' }) {
  return (
    <nav className="plan-um" aria-label="Zeitraum">
      <Link href="/woche" aria-current={an === 'woche' ? 'page' : undefined}>Woche</Link>
      <Link href="/ziele" aria-current={an === 'saison' ? 'page' : undefined}>Saison</Link>
    </nav>
  );
}

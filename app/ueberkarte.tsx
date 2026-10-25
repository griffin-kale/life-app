'use client';
import Link from 'next/link';

/** Karte für Übersichten: Titel, eine Zahl, eine Zeile, eine Handlung. Ein Tipp auf die Karte öffnet die Detailseite. */
export type Karte = { href: string; titel: string; farbe: string; zahl: string; sub: string; aktion?: { href: string; text: string } };
export function UeberKarte({ c }: { c: Karte }) {
  return (
    <div className="uk" style={{ '--c': c.farbe } as React.CSSProperties}>
      <Link href={c.href} className="uk-link"><span className="uk-kopf">{c.titel}<svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg></span><b>{c.zahl}</b><span className="uk-sub">{c.sub}</span></Link>
      {c.aktion ? <Link href={c.aktion.href} className="uk-akt">{c.aktion.text}</Link> : null}
    </div>
  );
}


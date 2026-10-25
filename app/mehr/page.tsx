'use client';
import Link from 'next/link';
import { Icon, TabBar, TopBar } from '../ui';

const EINTRAEGE: [string, string, string, string, string][] = [
  ['/kompass', 'Kompass', 'Fünf Konten, Level, Meilensteine', 'var(--k-geld)', 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM15 9l-2 4-4 2 2-4z'],
  ['/menschen', 'Menschen', 'Kreise, Kontakte, Geburtstage', 'var(--k-sozial)', 'M9 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19c.9-2.8 3-4.3 5.5-4.3s4.6 1.5 5.5 4.3M16.5 12a2.5 2.5 0 1 0 0-5M17 14.6c1.8.3 3 1.6 3.5 3.9'],
  ['/archiv', 'Logbuch', 'Alles, was du festgehalten hast', 'var(--k-zeit)', 'M6.5 3.5h8l3 3v14h-11zM9 10h6M9 14h6'],
  ['/einstellungen', 'Einstellungen', 'Darstellung, Heute, Mitteilungen, Namen', 'var(--faint)', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8'],
];

/** Zeile wie in den iPhone-Einstellungen: farbiges Symbol, Name, kurze Beschreibung. */
function Zeile({ href, name, sub, farbe, pfad }: { href: string; name: string; sub: string; farbe: string; pfad: string }) {
  return (
    <Link className="cell mehr-zeile" href={href}>
      <span className="mehr-symbol" style={{ background: farbe }} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={pfad} /></svg></span>
      <span className="lbl">{name}<small>{sub}</small></span>
      {Icon.chevronRight}
    </Link>
  );
}

/** Alles, was nicht jeden Tag gebraucht wird. */
export default function Mehr() {
  return (
    <main className="wrap">
      <TopBar title="Mehr" />
      <header className="head"><h1 className="title">Mehr<i>.</i></h1></header>
      <section className="gsec">
        <div className="group">
          {EINTRAEGE.slice(0, 3).map(([href, name, sub, farbe, pfad]) => <Zeile key={href} href={href} name={name} sub={sub} farbe={farbe} pfad={pfad} />)}
        </div>
      </section>
      <section className="gsec">
        <div className="group">
          {EINTRAEGE.slice(3).map(([href, name, sub, farbe, pfad]) => <Zeile key={href} href={href} name={name} sub={sub} farbe={farbe} pfad={pfad} />)}
        </div>
      </section>
      <TabBar />
    </main>
  );
}

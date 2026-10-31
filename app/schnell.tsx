'use client';
import Link from 'next/link';

/**
 * Schnellzugriffe auf Heute (0.28, Peter 31.10.2026): Deep Work als breiter Knopf, darunter die vier häufigsten Wege.
 * Alles, was das Haltemenü auf dem Plus kann, steht hier sichtbar, damit niemand die Geste kennen muss.
 */
type Weg = { name: string; href?: string; farbe: string; pfad: string };
const WEGE: Weg[] = [
  { name: 'Gedanke', farbe: 'var(--k-zeit)', pfad: 'M12 4a6 6 0 0 0-3.5 10.9V17h7v-2.1A6 6 0 0 0 12 4zM9.5 20h5' },
  { name: 'Ausgabe', href: '/geld?erfassen=1', farbe: 'var(--k-geld)', pfad: 'M5.5 6.5h13A2.5 2.5 0 0 1 21 9v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16V9a2.5 2.5 0 0 1 2.5-2.5zM12 10a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z' },
  { name: 'Essen', href: '/koerper/essen', farbe: 'var(--k-koerper)', pfad: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 1.5-3 4-3 7h3v11' },
  { name: 'Ruhe', href: '/koerper/ruhe', farbe: 'var(--k-mental)', pfad: 'M12 4a8 8 0 1 0 8 8 6 6 0 0 1-8-8z' },
];
const Symbol = ({ w }: { w: Weg }) => (
  <span className="sz-symbol" style={{ background: w.farbe }} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={w.pfad} /></svg></span>
);

export function Schnellzugriff({ onGedanke, sache }: { onGedanke: () => void; sache?: { id: string; titel: string } | null }) {
  return (
    <section className="sz-bereich" aria-label="Schnellzugriffe">
      <Link href={sache ? `/fokus?item=${sache.id}` : '/fokus'} className="sz-dw">
        <span className="sz-dw-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" /></svg></span>
        <span className="sz-dw-text"><b>Deep Work starten</b><small>{sache ? sache.titel : 'Timer, Musik und deine Liste im Vollbild'}</small></span>
      </Link>
      <div className="sz-vier">
        {WEGE.map((w) => w.href
          ? <Link key={w.name} href={w.href} className="sz"><Symbol w={w} />{w.name}</Link>
          : <button key={w.name} type="button" className="sz" onClick={onGedanke}><Symbol w={w} />{w.name}</button>)}
      </div>
    </section>
  );
}

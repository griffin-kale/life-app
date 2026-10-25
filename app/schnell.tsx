'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/** Schnellzugriffe auf Heute: zuerst ein Plus mit allen Wegen, dahinter die häufigsten direkt. */
type Weg = { name: string; href?: string; farbe: string; pfad: string };
const WEGE: Weg[] = [
  { name: 'Gedanke', farbe: 'var(--k-zeit)', pfad: 'M12 4a6 6 0 0 0-3.5 10.9V17h7v-2.1A6 6 0 0 0 12 4zM9.5 20h5' },
  { name: 'Essen', href: '/koerper/essen', farbe: 'var(--k-geld)', pfad: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 1.5-3 4-3 7h3v11' },
  { name: 'Ausgabe', href: '/geld?erfassen=1', farbe: 'var(--k-koerper)', pfad: 'M5.5 6.5h13A2.5 2.5 0 0 1 21 9v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16V9a2.5 2.5 0 0 1 2.5-2.5zM12 10a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z' },
  { name: 'Ruhe starten', href: '/koerper/ruhe', farbe: 'var(--k-mental)', pfad: 'M12 4a8 8 0 1 0 8 8 6 6 0 0 1-8-8z' },
  { name: 'Training', href: '/koerper/training', farbe: 'var(--k-sozial)', pfad: 'M3 12h4l2.5-6 4 12 2.5-6H21' },
  { name: 'Kontakt', href: '/menschen', farbe: 'var(--k-sozial)', pfad: 'M9 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19c.9-2.8 3-4.3 5.5-4.3s4.6 1.5 5.5 4.3' },
];
const DIREKT = ['Essen', 'Ausgabe', 'Ruhe starten', 'Training'];
const Symbol = ({ w }: { w: Weg }) => (
  <span className="sz-symbol" style={{ background: w.farbe }} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={w.pfad} /></svg></span>
);

export function Schnellzugriff({ onGedanke }: { onGedanke: () => void }) {
  const [offen, setOffen] = useState(false);
  const router = useRouter();
  const erster = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!offen) return;
    erster.current?.focus();
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setOffen(false); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [offen]);
  const waehlen = (w: Weg) => { setOffen(false); if (w.href) router.push(w.href); else onGedanke(); };

  return (
    <section aria-label="Schnellzugriffe">
      <div className="schnell-reihe">
        <button type="button" className="sz sz-plus" aria-label="Alle Wege zum Festhalten" aria-haspopup="dialog" aria-expanded={offen} onClick={() => setOffen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        {WEGE.filter((w) => DIREKT.includes(w.name)).map((w) => (
          <Link key={w.name} href={w.href!} className="sz"><Symbol w={w} />{w.name === 'Ruhe starten' ? 'Ruhe' : w.name}</Link>
        ))}
      </div>
      {offen ? <>
        <button type="button" className="blatt-scrim" aria-label="Schließen" onClick={() => setOffen(false)} />
        <div className="blatt" role="dialog" aria-modal="true" aria-label="Festhalten">
          <span className="blatt-griff" aria-hidden="true" />
          <h2 className="blatt-titel">Festhalten</h2>
          <div className="blatt-wege">
            {WEGE.map((w, i) => (
              <button key={w.name} ref={i === 0 ? erster : undefined} type="button" className="blatt-weg" onClick={() => waehlen(w)}><Symbol w={w} />{w.name}</button>
            ))}
          </div>
        </div>
      </> : null}
    </section>
  );
}

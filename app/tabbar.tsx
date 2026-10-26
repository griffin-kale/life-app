'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Untere Leiste als schwebende Pille (0.20, Peter 26.10.2026, Variante N2 mit Halten aus N1).
 *  Woche · Körper · Heute (groß in der Mitte) · Geld · Mehr. Auf Heute wird die Mitte zum Plus mit den schnellen Wegen.
 *  Gedrückt halten auf Körper und Geld öffnet deren Schnellmenü. Alles darin ist auch sichtbar auf der jeweiligen Seite erreichbar. */

type Weg = { name: string; href?: string; ereignis?: string; farbe: string; pfad: string };
const SCHNELL: Weg[] = [
  { name: 'Gedanke', ereignis: 'life-festhalten', farbe: 'var(--k-zeit)', pfad: 'M12 4a6 6 0 0 0-3.5 10.9V17h7v-2.1A6 6 0 0 0 12 4zM9.5 20h5' },
  { name: 'Ausgabe', href: '/geld?erfassen=1', farbe: 'var(--k-koerper)', pfad: 'M5.5 6.5h13A2.5 2.5 0 0 1 21 9v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16V9a2.5 2.5 0 0 1 2.5-2.5zM12 10a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z' },
  { name: 'Essen', href: '/koerper/essen', farbe: 'var(--k-geld)', pfad: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 1.5-3 4-3 7h3v11' },
  { name: 'Training', href: '/koerper/training', farbe: 'var(--k-sozial)', pfad: 'M3 12h4l2.5-6 4 12 2.5-6H21' },
  { name: 'Ruhe', href: '/koerper/ruhe', farbe: 'var(--k-mental)', pfad: 'M12 4a8 8 0 1 0 8 8 6 6 0 0 1-8-8z' },
  { name: 'Coach', ereignis: 'life-coach', farbe: 'var(--sand)', pfad: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z' },
];
const HALTEN: Record<string, { titel: string; wege: { name: string; href: string }[] }> = {
  '/koerper': { titel: 'Körper', wege: [{ name: 'Krafteinheit starten', href: '/koerper/training' }, { name: 'Ruhe starten', href: '/koerper/ruhe' }, { name: 'Mahlzeit festhalten', href: '/koerper/essen' }, { name: 'Letzte Nacht', href: '/koerper/nacht' }] },
  '/geld': { titel: 'Geld', wege: [{ name: 'Ausgabe festhalten', href: '/geld?erfassen=1' }, { name: 'Pro Monat', href: '/geld/monatlich' }, { name: 'Sparziele', href: '/geld/sparen' }, { name: 'Alle Buchungen', href: '/geld/zuletzt' }] },
};

const SEITEN: [string, string, ReactNode, string[]][] = [
  ['/woche', 'Woche', <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>, []],
  ['/koerper', 'Körper', <><path d="M3 12h4l2.5-6 4 12 2.5-6H21" /></>, []],
  ['/geld', 'Geld', <><rect x="3" y="6.5" width="18" height="12" rx="2.5" /><circle cx="12" cy="12.5" r="2.6" /></>, []],
  ['/mehr', 'Mehr', <><circle cx="5.5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="18.5" cy="12" r="1.3" fill="currentColor" /></>, ['/archiv', '/einstellungen', '/eintrag', '/menschen', '/kompass', '/stand']],
];

const Symbol = ({ w }: { w: Weg }) => (
  <span className="sz-symbol" style={{ background: w.farbe }} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={w.pfad} /></svg></span>
);

export function TabBar() {
  const path = usePathname();
  const router = useRouter();
  const [schnell, setSchnell] = useState(false);
  const [halten, setHalten] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gehalten = useRef(false);
  const erster = useRef<HTMLElement | null>(null);
  const aufHeute = path === '/';
  const offen = schnell || !!halten;

  useEffect(() => {
    if (!offen) return;
    erster.current?.focus();
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSchnell(false); setHalten(null); } };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [offen]);
  useEffect(() => { setSchnell(false); setHalten(null); }, [path]);
  // Leerer touchstart-Lauscher, damit :active auf dem iPhone greift
  useEffect(() => { const f = () => {}; document.addEventListener('touchstart', f, { passive: true }); return () => document.removeEventListener('touchstart', f); }, []);

  function waehlen(w: Weg) {
    setSchnell(false);
    if (w.ereignis) window.dispatchEvent(new Event(w.ereignis));
    else if (w.href) router.push(w.href);
  }
  // Halten: nach 450 ms öffnet sich das Menü, der folgende Klick navigiert nicht
  const halteStart = (href: string) => () => {
    if (!HALTEN[href]) return;
    gehalten.current = false;
    timer.current = setTimeout(() => { gehalten.current = true; setHalten(href); }, 450);
  };
  const halteEnde = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };

  const tab = ([href, label, icon, auch]: (typeof SEITEN)[number]) => {
    const on = path.startsWith(href) || auch.some((a) => path.startsWith(a));
    return (
      <Link key={href} href={href} className={'tb-tab' + (halten === href ? ' gehalten' : '')} aria-label={label} aria-current={on ? 'page' : undefined}
        onPointerDown={halteStart(href)} onPointerUp={halteEnde} onPointerLeave={halteEnde} onPointerCancel={halteEnde}
        onContextMenu={(e) => { if (HALTEN[href]) e.preventDefault(); }}
        onClick={(e) => { if (gehalten.current) { e.preventDefault(); gehalten.current = false; } }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2.1 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
      </Link>
    );
  };

  return (
    <>
      {offen ? <button type="button" className="tb-scrim" aria-label="Schließen" onClick={() => { setSchnell(false); setHalten(null); }} /> : null}
      {schnell ? (
        <div className="tb-schnell" role="dialog" aria-modal="true" aria-label="Schnell festhalten">
          {SCHNELL.map((w, i) => (
            <button key={w.name} ref={i === 0 ? (el) => { erster.current = el; } : undefined} type="button" className="tb-weg" onClick={() => waehlen(w)}><Symbol w={w} />{w.name}</button>
          ))}
        </div>
      ) : null}
      {halten ? (
        <div className={'tb-halten ' + (halten === '/geld' ? 'rechts' : 'links')} role="menu" aria-label={`${HALTEN[halten].titel} schnell`}>
          <span className="tb-halten-titel">{HALTEN[halten].titel}</span>
          {HALTEN[halten].wege.map((w, i) => <Link key={w.href} ref={i === 0 ? (el) => { erster.current = el; } : undefined} role="menuitem" href={w.href} className="tb-halten-weg" onClick={() => setHalten(null)}>{w.name}</Link>)}
        </div>
      ) : null}
      <nav className="tabbar" aria-label="Bereiche">
        {SEITEN.slice(0, 2).map(tab)}
        {aufHeute
          ? <button type="button" className={'tb-mitte' + (schnell ? ' offen' : '')} aria-label={schnell ? 'Schnell schließen' : 'Schnell festhalten'} aria-expanded={schnell} aria-haspopup="dialog" onClick={() => setSchnell((x) => !x)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          : <Link href="/" className="tb-mitte" aria-label="Heute">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" /></svg>
            </Link>}
        {SEITEN.slice(2).map(tab)}
      </nav>
    </>
  );
}

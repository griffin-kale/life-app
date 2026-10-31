'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Untere Leiste als schwebende Pille (Life 2.0, Peter 27.10.2026): Heute · Woche · Festhalten · Ziele · Ich.
 *  Die Mitte hält immer fest, weil das die häufigste Handlung ist. Gedrückt halten öffnet die sechs schnellen Wege.
 *  Jeder Weg im Haltemenü steht auch sichtbar auf seiner Seite. */

type Weg = { name: string; href?: string; ereignis?: string; farbe: string; pfad: string };
const SCHNELL: Weg[] = [
  { name: 'Deep Work', href: '/fokus', farbe: 'var(--k-geld)', pfad: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l2.5 2.5' },
  { name: 'Gedanke', ereignis: 'life-festhalten', farbe: 'var(--k-zeit)', pfad: 'M12 4a6 6 0 0 0-3.5 10.9V17h7v-2.1A6 6 0 0 0 12 4zM9.5 20h5' },
  { name: 'Ausgabe', href: '/geld?erfassen=1', farbe: 'var(--k-koerper)', pfad: 'M5.5 6.5h13A2.5 2.5 0 0 1 21 9v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16V9a2.5 2.5 0 0 1 2.5-2.5zM12 10a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z' },
  { name: 'Essen', href: '/koerper/essen', farbe: 'var(--k-geld)', pfad: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 1.5-3 4-3 7h3v11' },
  { name: 'Ruhe', href: '/koerper/ruhe', farbe: 'var(--k-mental)', pfad: 'M12 4a8 8 0 1 0 8 8 6 6 0 0 1-8-8z' },
  { name: 'Coach', ereignis: 'life-coach', farbe: 'var(--sand)', pfad: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z' },
];
const SEITEN: [string, string, ReactNode, string[]][] = [
  ['/', 'Heute', <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /></>, []],
  ['/woche', 'Woche', <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>, ['/wochenstart']],
  ['/ziele', 'Ziele', <><circle cx="12" cy="12" r="8.5" /><path d="M15.4 8.6l-2 4.8-4.8 2 2-4.8z" fill="currentColor" strokeLinejoin="round" /></>, ['/kompass', '/stand']],
  ['/ich', 'Ich', <><circle cx="12" cy="8.5" r="3.6" /><path d="M4.8 20c.9-3.6 3.8-5.6 7.2-5.6s6.3 2 7.2 5.6" /></>, ['/koerper', '/geld', '/menschen', '/archiv', '/einstellungen', '/eintrag', '/mehr']],
];

const Symbol = ({ w }: { w: Weg }) => (
  <span className="sz-symbol" style={{ background: w.farbe }} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={w.pfad} /></svg></span>
);

export function TabBar() {
  const path = usePathname();
  const router = useRouter();
  const [schnell, setSchnell] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gehalten = useRef(false);
  const erster = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!schnell) return;
    erster.current?.focus();
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setSchnell(false); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [schnell]);
  useEffect(() => { setSchnell(false); }, [path]);
  // Leerer touchstart-Lauscher, damit :active auf dem iPhone greift
  useEffect(() => { const f = () => {}; document.addEventListener('touchstart', f, { passive: true }); return () => document.removeEventListener('touchstart', f); }, []);

  function waehlen(w: Weg) {
    setSchnell(false);
    if (w.ereignis === 'life-festhalten' && path !== '/') router.push('/?festhalten=1');
    else if (w.ereignis === 'life-coach' && path !== '/') router.push('/');
    else if (w.ereignis) window.dispatchEvent(new Event(w.ereignis));
    else if (w.href) router.push(w.href);
  }
  // Ein Tipp hält fest. Halten öffnet nach 450 ms die schnellen Wege, der folgende Klick tut dann nichts.
  const halteStart = () => { gehalten.current = false; timer.current = setTimeout(() => { gehalten.current = true; setSchnell(true); }, 450); };
  const halteEnde = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  function mitte() {
    if (gehalten.current) { gehalten.current = false; return; }
    if (schnell) { setSchnell(false); return; }
    waehlen(SCHNELL.find((w) => w.name === 'Gedanke')!);
  }

  const tab = ([href, label, icon, auch]: (typeof SEITEN)[number]) => {
    const on = href === '/' ? path === '/' : path.startsWith(href) || auch.some((a) => path.startsWith(a));
    return (
      <Link key={href} href={href} className="tb-tab" aria-label={label} aria-current={on ? 'page' : undefined}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2.1 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
        <span className="tb-name">{label}</span>
      </Link>
    );
  };

  return (
    <>
      {schnell ? <button type="button" className="tb-scrim" aria-label="Schließen" onClick={() => setSchnell(false)} /> : null}
      {schnell ? (
        <div className="tb-schnell" role="dialog" aria-modal="true" aria-label="Schnell festhalten">
          {SCHNELL.map((w, i) => (
            <button key={w.name} ref={i === 0 ? (el) => { erster.current = el; } : undefined} type="button" className="tb-weg" onClick={() => waehlen(w)}><Symbol w={w} />{w.name}</button>
          ))}
        </div>
      ) : null}
      <nav className="tabbar" aria-label="Bereiche">
        {SEITEN.slice(0, 2).map(tab)}
        <button type="button" className={'tb-mitte' + (schnell ? ' offen' : '')} aria-label={schnell ? 'Schnell schließen' : 'Gedanke festhalten'} aria-expanded={schnell} aria-haspopup="dialog"
          onPointerDown={halteStart} onPointerUp={halteEnde} onPointerLeave={halteEnde} onPointerCancel={halteEnde}
          onContextMenu={(e) => { e.preventDefault(); setSchnell(true); }} onClick={mitte}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        {SEITEN.slice(2).map(tab)}
      </nav>
    </>
  );
}

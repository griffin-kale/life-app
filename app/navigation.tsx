'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Navigation für große Bildschirme. iPhone: nichts davon, dort bleibt die Leiste unten (TabBar).
 * iPad hochkant (768 bis 1099 px): schwebende Leiste oben, ☰ klappt die Seitenleiste auf.
 * iPad quer und Mac (ab 1100 px): feste Seitenleiste links und Werkzeugleiste mit Suche und Festhalten.
 */
type Ziel = { href: string; name: string; farbe: string; pfad: string };
const BEREICHE: Ziel[] = [
  { href: '/', name: 'Heute', farbe: 'var(--k-zeit)', pfad: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 10.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z' },
  { href: '/woche', name: 'Woche', farbe: 'var(--k-zeit)', pfad: 'M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5zM4 10h16M8 3v4M16 3v4' },
  { href: '/koerper', name: 'Körper', farbe: 'var(--k-koerper)', pfad: 'M3 12h4l2.5-6 4 12 2.5-6H21' },
  { href: '/koerper/ruhe', name: 'Ruhe', farbe: 'var(--k-mental)', pfad: 'M12 4a8 8 0 1 0 8 8 6 6 0 0 1-8-8z' },
  { href: '/geld', name: 'Geld', farbe: 'var(--k-geld)', pfad: 'M5.5 6.5h13A2.5 2.5 0 0 1 21 9v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16V9a2.5 2.5 0 0 1 2.5-2.5zM12 10a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z' },
];
const UEBERBLICK: Ziel[] = [
  { href: '/kompass', name: 'Kompass', farbe: 'var(--k-geld)', pfad: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM15 9l-2 4-4 2 2-4z' },
  { href: '/menschen', name: 'Menschen', farbe: 'var(--k-sozial)', pfad: 'M9 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19c.9-2.8 3-4.3 5.5-4.3s4.6 1.5 5.5 4.3M16.5 12a2.5 2.5 0 1 0 0-5M17 14.6c1.8.3 3 1.6 3.5 3.9' },
  { href: '/archiv', name: 'Logbuch', farbe: 'var(--k-zeit)', pfad: 'M6.5 3.5h8l3 3v14h-11zM9 10h6M9 14h6' },
];
const EINST: Ziel = { href: '/einstellungen', name: 'Einstellungen', farbe: 'var(--faint)', pfad: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8' };
const PILLE: [string, string, string[]][] = [['/', 'Heute', []], ['/woche', 'Woche', []], ['/koerper', 'Körper', []], ['/geld', 'Geld', []], ['/mehr', 'Mehr', ['/kompass', '/menschen', '/archiv', '/einstellungen', '/eintrag']]];
const ALLE = [...BEREICHE, ...UEBERBLICK, EINST];

/** Der Bereich mit dem längsten passenden Pfad ist aktiv: /koerper/ruhe gehört zu Ruhe, nicht zu Körper. */
export function aktiverBereich(pfad: string): string {
  if (pfad.startsWith('/eintrag')) return '/archiv';
  let best = '/';
  for (const z of ALLE) if (z.href !== '/' && (pfad === z.href || pfad.startsWith(z.href + '/')) && z.href.length > best.length) best = z.href;
  return pfad === '/' || best !== '/' ? best : '';
}

function Zeile({ z, an, onWahl }: { z: Ziel; an: boolean; onWahl: () => void }) {
  return (
    <Link href={z.href} className="sl-zeile" aria-current={an ? 'page' : undefined} onClick={onWahl}>
      <span className="sl-symbol" style={{ background: z.farbe }} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={z.pfad} /></svg></span>
      {z.name}
    </Link>
  );
}

export function Navigation() {
  const pfad = usePathname();
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const aus = pfad.startsWith('/login') || pfad.startsWith('/setup');
  const an = aktiverBereich(pfad);

  // Tastatur auf iPad und Mac: N hält fest, ⌘K oder / sucht im Logbuch. In Eingabefeldern bleibt alles normal.
  useEffect(() => {
    if (aus) return;
    const f = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tippt = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); router.push('/archiv?suche=1'); return; }
      if (tippt || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); router.push('/?festhalten=1'); }
      else if (e.key === '/') { e.preventDefault(); router.push('/archiv?suche=1'); }
      else if (e.key === 'Escape') setOffen(false);
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [aus, router]);
  useEffect(() => { setOffen(false); }, [pfad]);
  if (aus) return null;

  return (
    <>
      <nav className="tabpille" aria-label="Bereiche oben">
        <button type="button" className="tp-menue" aria-label="Seitenleiste" aria-expanded={offen} onClick={() => setOffen((x) => !x)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="3" /><path d="M9.5 5v14" /></svg>
        </button>
        {PILLE.map(([href, name, auch]) => {
          const aktiv = href === '/' ? pfad === '/' : pfad.startsWith(href) || auch.some((a) => pfad.startsWith(a));
          return <Link key={href} href={href} aria-current={aktiv ? 'page' : undefined}>{name}</Link>;
        })}
      </nav>
      {offen ? <button type="button" className="sl-scrim" aria-label="Seitenleiste schließen" onClick={() => setOffen(false)} /> : null}
      <aside className={'seitenleiste' + (offen ? ' offen' : '')} aria-label="Bereiche">
        <Link href="/" className="sl-marke" onClick={() => setOffen(false)}>
          <svg viewBox="0 0 76 76" aria-hidden="true"><rect width="76" height="76" rx="19" fill="#001D51" /><circle cx="38" cy="38" r="19" fill="none" stroke="#F3F0E6" strokeWidth="4" /><circle cx="38" cy="38" r="5.5" fill="#D0C8A6" /></svg>
          Life
        </Link>
        <nav className="sl-gruppe" aria-label="Jeden Tag">{BEREICHE.map((z) => <Zeile key={z.href} z={z} an={an === z.href} onWahl={() => setOffen(false)} />)}</nav>
        <span className="sl-titel">Überblick</span>
        <nav className="sl-gruppe" aria-label="Überblick">{UEBERBLICK.map((z) => <Zeile key={z.href} z={z} an={an === z.href} onWahl={() => setOffen(false)} />)}</nav>
        <nav className="sl-gruppe sl-fuss" aria-label="Einstellungen"><Zeile z={EINST} an={an === EINST.href} onWahl={() => setOffen(false)} /></nav>
      </aside>
      <div className="werkzeugleiste" role="toolbar" aria-label="Werkzeuge">
        <Link href="/archiv?suche=1" className="wz-suche"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>Suchen<kbd>⌘K</kbd></Link>
        <Link href="/?festhalten=1" className="wz-fest"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Festhalten<kbd>N</kbd></Link>
      </div>
    </>
  );
}

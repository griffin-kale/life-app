'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

/**
 * Navigation für große Bildschirme. iPhone: nichts davon, dort bleibt die Leiste unten (TabBar).
 * iPad hochkant (768 bis 1099 px): schwebende Leiste oben, ☰ klappt die Seitenleiste auf.
 * iPad quer und Mac (ab 1100 px): feste Seitenleiste links und Werkzeugleiste mit Suche und Festhalten.
 */
type Ziel = { href: string; name: string; farbe: string; pfad: string };
const BEREICHE: Ziel[] = [
  { href: '/', name: 'Heute', farbe: 'var(--k-zeit)', pfad: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 10.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z' },
  { href: '/woche', name: 'Plan', farbe: 'var(--k-zeit)', pfad: 'M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5zM4 10h16M8 3v4M16 3v4' },
  { href: '/leben', name: 'Leben', farbe: 'var(--k-koerper)', pfad: 'M12 20.5V12M12 12c0-4.2 3-7.5 7.5-7.5 0 4.2-3 7.5-7.5 7.5zM12 14.5c0-3.3-2.6-6-6.5-6 0 3.3 2.6 6 6.5 6z' },
  { href: '/archiv', name: 'Logbuch', farbe: 'var(--k-zeit)', pfad: 'M6.5 3.5h8l3 3v14h-11zM9 10h6M9 14h6' },
];
/** Unter Plan: Woche und Saison, wie der Umschalter auf der Seite. */
const PLAN: Ziel[] = [
  { href: '/woche', name: 'Woche', farbe: 'var(--k-zeit)', pfad: 'M4 7h16M4 12h16M4 17h10' },
  { href: '/ziele', name: 'Saison', farbe: 'var(--k-geld)', pfad: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM15 9l-2 4-4 2 2-4z' },
];
/** Unter Leben: die vier Konten und der Stand, wie auf der Seite Leben am iPhone (Seitenleiste als Baum, Peter 31.10.2026). */
const UEBERBLICK: Ziel[] = [
  { href: '/koerper', name: 'Körper', farbe: 'var(--k-koerper)', pfad: 'M3 12h4l2.5-6 4 12 2.5-6H21' },
  { href: '/koerper/ruhe', name: 'Ruhe', farbe: 'var(--k-mental)', pfad: 'M12 4a8 8 0 1 0 8 8 6 6 0 0 1-8-8z' },
  { href: '/geld', name: 'Geld', farbe: 'var(--k-geld)', pfad: 'M5.5 6.5h13A2.5 2.5 0 0 1 21 9v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16V9a2.5 2.5 0 0 1 2.5-2.5zM12 10a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z' },
  { href: '/menschen', name: 'Menschen', farbe: 'var(--k-sozial)', pfad: 'M9 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19c.9-2.8 3-4.3 5.5-4.3s4.6 1.5 5.5 4.3M16.5 12a2.5 2.5 0 1 0 0-5M17 14.6c1.8.3 3 1.6 3.5 3.9' },
  { href: '/stand', name: 'Stand', farbe: 'var(--k-geld)', pfad: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM15 9l-2 4-4 2 2-4z' },
];
const EINST: Ziel = { href: '/einstellungen', name: 'Einstellungen', farbe: 'var(--faint)', pfad: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8' };
const PILLE: [string, string, string[]][] = [['/', 'Heute', ['/morgen', '/abschluss']], ['/woche', 'Plan', ['/wochenstart', '/ziele']], ['/leben', 'Leben', ['/koerper', '/geld', '/menschen', '/stand', '/kompass', '/ich', '/mehr', '/einstellungen']], ['/archiv', 'Logbuch', ['/eintrag']]];
const ALLE = [...BEREICHE, ...PLAN, ...UEBERBLICK, EINST];
const KINDER: Record<string, Ziel[]> = { '/woche': PLAN, '/leben': UEBERBLICK };

/** Der Bereich mit dem längsten passenden Pfad ist aktiv: /koerper/ruhe gehört zu Ruhe, nicht zu Körper. */
export function aktiverBereich(pfad: string): string {
  if (pfad.startsWith('/eintrag')) return '/archiv';
  if (pfad.startsWith('/kompass')) return '/stand';
  if (pfad.startsWith('/wochenstart')) return '/woche';
  if (pfad.startsWith('/ziele')) return '/ziele';
  if (pfad === '/mehr' || pfad === '/ich') return '/leben';
  let best = '/';
  for (const z of ALLE) if (z.href !== '/' && (pfad === z.href || pfad.startsWith(z.href + '/')) && z.href.length > best.length) best = z.href;
  return pfad === '/' || best !== '/' ? best : '';
}

function Zeile({ z, an, offen, klein, onWahl }: { z: Ziel; an: boolean; offen?: boolean; klein?: boolean; onWahl: () => void }) {
  return (
    <Link href={z.href} className={'sl-zeile' + (klein ? ' klein' : '') + (offen ? ' offen' : '')} aria-current={an ? 'page' : undefined} onClick={onWahl}>
      <span className="sl-symbol" style={{ background: z.farbe }} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={z.pfad} /></svg></span>
      {z.name}
    </Link>
  );
}

export function Navigation() {
  const pfad = usePathname();
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  // Deep Work zeigt nur sich selbst, ohne Seitenleiste und Werkzeuge
  const aus = pfad.startsWith('/login') || pfad.startsWith('/setup') || pfad.startsWith('/fokus');
  const an = aktiverBereich(pfad);

  // Auf Heute öffnet Festhalten den Coach direkt, von anderen Seiten geht es dorthin
  const festhalten = useCallback(() => { if (pfad === '/') window.dispatchEvent(new Event('life-festhalten')); else router.push('/?festhalten=1'); }, [pfad, router]);
  // Tastatur auf iPad und Mac: N hält fest, ⌘K oder / sucht im Logbuch. In Eingabefeldern bleibt alles normal.
  useEffect(() => {
    if (aus) return;
    const f = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tippt = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); router.push('/archiv?suche=1'); return; }
      if (tippt || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); festhalten(); }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); router.push('/fokus'); }
      else if (e.key === '/') { e.preventDefault(); router.push('/archiv?suche=1'); }
      else if (e.key === 'Escape') setOffen(false);
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [aus, router, festhalten]);
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
        <nav className="sl-gruppe" aria-label="Bereiche">
          {BEREICHE.map((z) => {
            const kinder = KINDER[z.href] ?? [];
            // Der Bereich selbst leuchtet nur, wenn keines seiner Kinder gemeint ist (Plan und Woche teilen sich /woche)
            const kindAn = kinder.some((k) => k.href === an);
            return (
              <div key={z.href} className="sl-ast">
                <Zeile z={z} an={an === z.href && !kindAn} offen={kindAn} onWahl={() => setOffen(false)} />
                {kinder.length ? <div className="sl-kinder">{kinder.map((k) => <Zeile key={k.href} z={k} an={an === k.href} klein onWahl={() => setOffen(false)} />)}</div> : null}
              </div>
            );
          })}
        </nav>
        <nav className="sl-gruppe sl-fuss" aria-label="Einstellungen"><Zeile z={EINST} an={an === EINST.href} onWahl={() => setOffen(false)} /></nav>
      </aside>
      <div className="werkzeugleiste" role="toolbar" aria-label="Werkzeuge">
        <Link href="/archiv?suche=1" className="wz-suche"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>Suchen<kbd>⌘K</kbd></Link>
        <Link href="/fokus" className="wz-dw"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>Deep Work<kbd>F</kbd></Link>
        <Link href="/?festhalten=1" className="wz-fest" onClick={(e) => { if (pfad === '/') { e.preventDefault(); festhalten(); } }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Festhalten<kbd>N</kbd></Link>
      </div>
    </>
  );
}

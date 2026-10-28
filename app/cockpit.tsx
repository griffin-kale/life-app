'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Icon, api } from './ui';
import { dauerText, uhr, type KontoZeile, type StreifenBlock } from '@/lib/cockpit-regeln';
import type { Cockpit } from '@/lib/cockpit';

/** Cockpit auf Heute (Life 2.0, Richtung B mit Tagesstreifen, Peter 27.10.2026): ein Abruf für Kacheln, Streifen und Konten. */
export function useCockpit() {
  const [c, setC] = useState<Cockpit | null>(null);
  const laden = useCallback(async () => setC(await api<Cockpit>('/api/heute/cockpit')), []);
  useEffect(() => { laden().catch(() => {}); }, [laden]);
  return { c, laden };
}

const KONTO_FARBE: Record<KontoZeile['konto'], string> = { zeit: 'var(--k-zeit)', koerper: 'var(--k-koerper)', mental: 'var(--k-mental)', sozial: 'var(--k-sozial)', geld: 'var(--k-geld)' };
const erholFarbe = (e: number | null) => (e == null ? 'var(--faint)' : e < 34 ? 'var(--bad)' : e < 67 ? 'var(--warn)' : 'var(--ok)');

function Ring({ wert, farbe, label }: { wert: number | null; farbe: string; label: string }) {
  const r = 15, u = 2 * Math.PI * r, p = wert == null ? 0 : Math.max(0, Math.min(100, wert)) / 100;
  return (
    <svg className="ck-ring" viewBox="0 0 36 36" role="img" aria-label={label}>
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={farbe} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${u * p} ${u}`} transform="rotate(-90 18 18)" />
    </svg>
  );
}

/** Drei Kacheln: Erholung, freie Zeit, Woche. Ohne Daten steht dort der nächste Schritt. */
export function CockpitKacheln({ c }: { c: Cockpit | null }) {
  if (!c) return <section className="ck-kacheln" aria-label="Cockpit" aria-busy="true"><span className="ck-kachel skel" /><span className="ck-kachel skel" /><span className="ck-kachel skel" /></section>;
  const f = c.woche.fokus;
  return (
    <section className="ck-kacheln" aria-label="Cockpit">
      <Link href={c.whoop ? '/koerper/nacht' : '/koerper'} className="ck-kachel">
        {c.whoop ? <Ring wert={c.erholung} farbe={erholFarbe(c.erholung)} label={`Erholung ${c.erholung ?? 'unbekannt'} von 100`} /> : null}
        <b className="num">{c.erholung != null ? <>{c.erholung}<small>%</small></> : '–'}</b>
        <span className="ck-name">Erholung</span>
        {!c.whoop ? <span className="ck-fuss">WHOOP verbinden</span> : c.schlafMin != null ? <span className="ck-fuss">Schlaf {Math.floor(c.schlafMin / 60)}:{String(c.schlafMin % 60).padStart(2, '0')}</span> : null}
      </Link>
      <Link href="/woche" className="ck-kachel">
        <b className="num">{c.frei != null ? dauerText(c.frei).replace(' Std.', ' h').replace(' Min.', ' min') : '–'}</b>
        <span className="ck-name">frei heute</span>
        <span className="ck-fuss">{c.kalender ? 'bis 19 Uhr' : 'Kalender verbinden'}</span>
      </Link>
      <Link href="/woche" className="ck-kachel">
        <b className="num">{f ? <>{f.erledigt}<small>/{f.von}</small></> : c.woche.erledigt}</b>
        <span className="ck-name">{f ? 'Drei Dinge' : 'erledigt'}</span>
        <span className="ck-fuss">{f ? 'der Woche' : 'diese Woche'}</span>
      </Link>
    </section>
  );
}

const ART_NAME: Record<string, string> = { privat: 'Privat', familie: 'Familie', arbeit: 'Arbeit', aufgabe: 'Aufgabe', vorschlag: 'Vorschlag' };

/** Die nächsten drei Blöcke des Tages. Ein Tipp öffnet die Woche mit dem ganzen Tag. */
export function Tagesstreifen({ c, jetzt }: { c: Cockpit | null; jetzt: number | null }) {
  if (!c) return null;
  const s: StreifenBlock[] = c.streifen;
  return (
    <section className="gsec ck-streifen" aria-label="Als Nächstes">
      <h2 className="glabel">Als Nächstes</h2>
      <Link href="/woche" className="group ck-liste">
        {s.length ? s.map((b, i) => {
          const laeuft = jetzt !== null && b.von <= jetzt && (b.bis ?? b.von + 30) > jetzt;
          return (
            <span key={i} className={'ck-block' + (laeuft ? ' laeuft' : '')} style={{ '--c': b.art === 'familie' ? 'var(--k-sozial)' : b.art === 'aufgabe' ? 'var(--k-zeit)' : b.art === 'privat' ? 'var(--k-mental)' : 'var(--sky)' } as React.CSSProperties}>
              <time className="num">{uhr(b.von)}</time>
              <span className="ck-text"><b>{b.titel || ART_NAME[b.art] || 'Termin'}</b><small>{b.bis ? `bis ${uhr(b.bis)}` : 'ohne Ende'} · {ART_NAME[b.art] ?? b.art}{laeuft ? ' · läuft' : ''}</small></span>
            </span>
          );
        }) : <span className="ck-block leer"><span className="ck-text"><b>{c.kalender ? 'Heute steht nichts mehr an' : 'Noch kein Kalender verbunden'}</b><small>{c.kalender ? 'Der Rest des Tages gehört dir.' : 'Unter Einstellungen → Kalender liest Life deinen iCloud-Kalender.'}</small></span></span>}
        <span className="ck-mehr">Ganzer Tag {Icon.chevronRight}</span>
      </Link>
    </section>
  );
}

/** Je Konto eine Zeile mit dem, was heute zählt. */
export function KontenHeute({ c }: { c: Cockpit | null }) {
  if (!c) return null;
  return (
    <section className="gsec" aria-label="Konten heute">
      <h2 className="glabel">Konten heute</h2>
      <div className="group">
        {c.konten.map((k) => (
          <Link key={k.konto} href={k.href} className="cell ck-konto" style={{ '--c': KONTO_FARBE[k.konto] } as React.CSSProperties}>
            <span className="ck-punkt" aria-hidden="true" />
            <span className="lbl"><b>{k.titel}</b><small>{k.text}</small></span>
            {Icon.chevronRight}
          </Link>
        ))}
      </div>
    </section>
  );
}

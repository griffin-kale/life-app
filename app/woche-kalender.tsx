'use client';
import { useEffect, useState } from 'react';
import { api } from './ui';
import type { Woche } from '@/lib/woche';
import type { TagBlock } from '@/lib/kalender-regeln';

/** Woche (Life 2.0): sieben Tage als Mini-Strahl auf dem iPhone, als Wochenraster auf iPad und Mac. Dazu die Rhythmen. */
export function useWoche() {
  const [w, setW] = useState<Woche | null>(null);
  useEffect(() => { api<Woche>('/api/woche').then(setW).catch(() => {}); }, []);
  return w;
}

const VON = 7 * 60, BIS = 22 * 60;
const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const dauer = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}` : `${m} min`);
const FARBE: Record<string, string> = { arbeit: 'var(--k-zeit)', familie: 'var(--k-sozial)', privat: 'var(--k-mental)' };
const ART: Record<string, string> = { arbeit: 'Arbeit', familie: 'Familie', privat: 'Privat' };
const TAGNAME: Record<string, string> = { Mo: 'Montag', Di: 'Dienstag', Mi: 'Mittwoch', Do: 'Donnerstag', Fr: 'Freitag', Sa: 'Samstag', So: 'Sonntag' };
const lage = (b: TagBlock) => ({ top: `${((Math.max(b.von, VON) - VON) / (BIS - VON)) * 100}%`, height: `${Math.max(2.5, ((Math.min(b.bis, BIS) - Math.max(b.von, VON)) / (BIS - VON)) * 100)}%` });

export function WochenKalender({ w, breit }: { w: Woche; breit: boolean }) {
  const heuteI = Math.max(0, w.tage.findIndex((t) => t.tag === w.heute));
  const [wahl, setWahl] = useState(heuteI);
  if (!w.kalender) {
    return (
      <section className="gsec" aria-label="Kalender">
        <h2 className="glabel">Kalender</h2>
        <div className="group pad"><p className="muted small">Verbinde deinen iCloud-Kalender unter Einstellungen → Kalender. Dann siehst du hier jeden Tag der Woche mit Terminen und freier Zeit.</p></div>
      </section>
    );
  }
  if (breit) {
    const stunden = Array.from({ length: (BIS - VON) / 60 + 1 }, (_, i) => VON / 60 + i);
    return (
      <section className="gsec" aria-label="Kalender">
        <h2 className="glabel">Kalender · 7 bis 22 Uhr</h2>
        <div className="wk-raster" role="grid" aria-label="Woche als Raster">
          <span className="wk-ecke" />
          {w.tage.map((t) => <span key={t.tag} role="columnheader" className={'wk-kopf' + (t.tag === w.heute ? ' heute' : '')}>{t.wt} <b>{t.nr}</b><small>{dauer(t.frei)} frei</small></span>)}
          <span className="wk-stunden" aria-hidden="true">{stunden.map((h) => <i key={h} style={{ top: `${((h * 60 - VON) / (BIS - VON)) * 100}%` }}>{h}</i>)}</span>
          {w.tage.map((t) => (
            <span key={t.tag} role="gridcell" className={'wk-spalte' + (t.tag === w.heute ? ' heute' : '')}>
              {t.ganztag.length ? <span className="wk-ganztag">{t.ganztag.join(', ')}</span> : null}
              {t.bloecke.map((b, i) => <span key={i} className="wk-block" style={{ ...lage(b), '--c': FARBE[b.art] ?? 'var(--sky)' } as React.CSSProperties} title={`${hm(b.von)} bis ${hm(b.bis)} ${b.titel}`}>{b.titel || ART[b.art]}<small>{hm(b.von)}</small></span>)}
            </span>
          ))}
        </div>
      </section>
    );
  }
  const t = w.tage[wahl];
  return (
    <section className="gsec" aria-label="Kalender">
      <h2 className="glabel">Sieben Tage</h2>
      <div className="wk-tage" role="tablist" aria-label="Tage der Woche">
        {w.tage.map((d, i) => (
          <button key={d.tag} type="button" role="tab" aria-selected={i === wahl} className={'wk-tag' + (d.tag === w.heute ? ' heute' : '')} onClick={() => setWahl(i)} aria-label={`${TAGNAME[d.wt]}, ${dauer(d.frei)} frei`}>
            <span className="wk-wt">{d.wt}</span>
            <span className="wk-nr">{d.nr}</span>
            <span className="wk-mini" aria-hidden="true">{d.bloecke.map((b, j) => <i key={j} style={{ ...lage(b), background: FARBE[b.art] ?? 'var(--sky)' }} />)}</span>
            <span className="wk-frei">{d.frei >= 60 ? `${Math.round(d.frei / 60)} h` : `${d.frei} min`}</span>
          </button>
        ))}
      </div>
      <div className="group" role="tabpanel" aria-label={TAGNAME[t.wt]}>
        <div className="cell static wk-tageskopf"><span className="lbl"><b>{TAGNAME[t.wt]}, {t.nr}.</b></span><span className="val"><span>{dauer(t.frei)} frei</span></span></div>
        {t.ganztag.length ? <div className="cell static"><span className="lbl muted">Ganztägig: {t.ganztag.join(', ')}</span></div> : null}
        {t.bloecke.length ? t.bloecke.map((b, i) => (
          <div key={i} className="cell static wk-zeile" style={{ '--c': FARBE[b.art] ?? 'var(--sky)' } as React.CSSProperties}>
            <time className="num">{hm(b.von)}</time><span className="lbl"><b>{b.titel || ART[b.art]}</b><small>bis {hm(b.bis)} · {ART[b.art] ?? b.art}</small></span>
          </div>
        )) : <div className="cell static"><span className="lbl muted">Keine Termine. Der Tag gehört dir.</span></div>}
      </div>
    </section>
  );
}

const KONTO: Record<string, string> = { zeit: 'var(--k-zeit)', koerper: 'var(--k-koerper)', mental: 'var(--k-mental)', sozial: 'var(--k-sozial)', geld: 'var(--k-geld)' };

/** Rhythmen: ein Punkt pro Tag, gezählt wird die Woche. Künftige Tage sind gestrichelt, ein leerer Tag ist keine Lücke. */
export function Rhythmen({ w }: { w: Woche }) {
  const heuteI = w.tage.findIndex((t) => t.tag === w.heute);
  return (
    <section className="gsec" aria-label="Rhythmen">
      <h2 className="glabel">Rhythmen · gezählt pro Woche</h2>
      <div className="group">
        <div className="cell static rh-kopf" aria-hidden="true"><span /><span className="rh-punkte">{w.tage.map((t) => <b key={t.tag}>{t.wt.slice(0, 1)}</b>)}</span></div>
        {w.rhythmen.map((r) => (
          <div key={r.konto} className="cell static rh-zeile" style={{ '--c': KONTO[r.konto] } as React.CSSProperties}>
            <span className="lbl"><b><i className="ck-punkt" />{r.name}</b><small>{r.text}</small></span>
            <span className="rh-punkte" role="img" aria-label={`${r.name}: an ${r.an.filter(Boolean).length} von 7 Tagen`}>
              {r.an.map((a, i) => <i key={i} className={(a ? 'an' : '') + (i === heuteI ? ' heute' : '') + (heuteI >= 0 && i > heuteI ? ' spaeter' : '')} />)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

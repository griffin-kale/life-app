'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon, TabBar, TopBar, api } from '../ui';
import { FARBE, Ring } from '../ringe';
import { BEREICH_NAME, KONTEN, type Stand } from '@/lib/standort';

type R = { stand: Stand; wochenziel: string; engpass: string; heute: string; naechste: number | null; etappen: { nr: number; titel: string; kurz: string; dauer: string; erledigt: string | null }[] };
const datum = (t: string) => new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' }).format(new Date(t + 'T12:00:00Z'));

/** Dein Stand: was die Standortbestimmung ergeben hat. Der Coach kennt diese Seite bei jedem Satz. */
export default function StandSeite() {
  const [r, setR] = useState<R | null>(null);
  useEffect(() => { api<R>('/api/stand').then(setR).catch(() => {}); }, []);
  const s = r?.stand; const b = s?.baseline;
  const vorher = s?.verlauf?.at(-1);
  const leer = (t: string) => <span className="st-leer">{t}</span>;
  return (
    <main className="wrap">
      <TopBar title="Dein Stand" back={{ label: 'Ziele', href: '/ziele' }} />
      <header className="head"><span className="eyebrow">{b ? `Baseline vom ${datum(b.tag)}` : 'Standortbestimmung'}</span><h1 className="title">Dein Stand<i>.</i></h1></header>
      {!r ? <p className="loading">Lädt …</p> : <>
        {r.naechste ? (
          <Link href={`/stand/${r.naechste}`} className="ws-banner st-start">
            <span><b>{r.naechste === 1 ? 'Standortbestimmung starten' : `Weiter mit Etappe ${r.naechste}`}</b><small>{r.etappen[r.naechste - 1].titel}: {r.etappen[r.naechste - 1].kurz} {r.etappen[r.naechste - 1].dauer}</small></span>
            {Icon.chevronRight}
          </Link>
        ) : null}

        <section className="gsec" aria-label="Baseline">
          <h2 className="glabel">Wo du stehst</h2>
          <div className="group pad">
            {b ? <div className="ringreihe">{KONTEN.map((k) => {
              const w = b.werte[k]; const d = w !== undefined && vorher?.werte[k] !== undefined ? w - vorher.werte[k]! : null;
              return <span key={k} className="ringzelle"><Ring wert={w !== undefined ? w / 10 : null} farbe={FARBE[k]} groesse={48} dicke={6} label={`${BEREICH_NAME[k]} ${w ?? '–'} von 10`} /><b>{w ?? '–'}{d ? <small className={d > 0 ? 'okc' : 'warn'}> {d > 0 ? '+' : ''}{d}</small> : null}</b><span className="muted">{BEREICH_NAME[k]}</span></span>;
            })}</div> : <p className="muted small">Noch keine Baseline. Etappe 1 dauert etwa zwölf Minuten.</p>}
            {s?.fokus ? <p className="st-fokus"><b>Fokus {BEREICH_NAME[s.fokus.bereich]}</b>{s.fokus.text}</p> : null}
          </div>
        </section>

        <section className="gsec" aria-label="Engpass">
          <h2 className="glabel">Was dich bremst</h2>
          <div className="group pad">
            <p className="ws-engpass">{r.engpass || 'Noch kein Engpass festgelegt. Etappe 3 leitet ihn mit dir her.'}</p>
            {s?.herleitung ? <details className="disclose"><summary>{Icon.chevronRight}So hat der Coach ihn hergeleitet</summary><p className="small muted">{s.herleitung}</p></details> : null}
          </div>
        </section>

        <section className="gsec" aria-label="Richtung">
          <h2 className="glabel">Wohin</h2>
          <div className="group">
            <div className="cell static st-zeile"><em>Werte</em><span>{s?.werte || leer('kommt aus Etappe 2')}</span></div>
            <div className="cell static st-zeile"><em>In einem Jahr</em><span>{s?.jahr || leer('kommt aus Etappe 2')}</span></div>
            <div className="cell static st-zeile"><em>12 Wochen</em><span>{s?.quartal?.length ? <ul className="st-liste">{s.quartal.map((q) => <li key={q.bereich}><b>{BEREICH_NAME[q.bereich]}</b> {q.text}</li>)}</ul> : leer('kommt aus Etappe 2 und 3')}</span></div>
            <div className="cell static st-zeile"><em>Liegt bewusst</em><span>{s?.weglassen || leer('kommt aus Etappe 2')}</span></div>
          </div>
        </section>

        <section className="gsec" aria-label="Woche und Tag">
          <h2 className="glabel">Diese Woche und heute</h2>
          <div className="group">
            <div className="cell static st-zeile"><em>Woche</em><span>{r.wochenziel || leer('Setzt du in Etappe 3 oder in der Wochenrunde')}</span></div>
            <div className="cell static st-zeile"><em>Heute</em><span>{r.heute || leer('Claude setzt morgens „Jetzt dran“')}</span></div>
          </div>
          <p className="gnote">Alle zwölf Wochen fragt der Coach Etappe 1 nochmal ab, dann siehst du hier, was sich bewegt hat.</p>
        </section>

        <section className="gsec" aria-label="Etappen">
          <h2 className="glabel">Etappen</h2>
          <div className="group">
            {r.etappen.map((e) => (
              <Link key={e.nr} href={`/stand/${e.nr}`} className="cell">
                <span className="lbl">{e.nr}. {e.titel}<small>{e.erledigt ? `erledigt am ${datum(e.erledigt)}` : e.dauer}</small></span>
                <span className="val"><span>{e.erledigt ? 'Wiederholen' : 'Starten'}</span>{Icon.chevronRight}</span>
              </Link>
            ))}
          </div>
        </section>
      </>}
      <TabBar />
    </main>
  );
}

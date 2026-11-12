'use client';
import { useCallback, useEffect, useState } from 'react';
import { TabBar, TopBar, api, useToast } from '../ui';
import { JOKER, TAGE, plusTage } from '@/lib/hunderter-regeln';
import type { HunderterHeute, HunderterUebersicht } from '@/lib/hunderter';

type Antwort = { heute: HunderterHeute | null; saison: HunderterUebersicht | null; datum: string };
const datum = (t: string) => new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(t + 'T00:00:00Z'));
const zahl = (n: number) => n.toLocaleString('de-DE');

/** Die Hunderter (0.32): Raster der 100 Tage, Quoten, Zähler, Joker. Ohne laufende Saison der Start. */
export default function Hunderter() {
  const [d, setD] = useState<Antwort | null>(null);
  const [start, setStart] = useState<'heute' | 'morgen'>('morgen');
  const [jokerTag, setJokerTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useToast();
  const laden = useCallback(() => api<Antwort>('/api/hunderter?ganz=1').then(setD).catch((e) => setToast((e as Error).message, 'err')), [setToast]);
  useEffect(() => { laden(); }, [laden]);

  async function tun(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    try { await api('/api/hunderter', { method: 'POST', body: JSON.stringify(body) }); await laden(); setToast(ok, 'ok'); }
    catch (e) { setToast((e as Error).message, 'err'); }
    finally { setBusy(false); }
  }

  const s = d?.saison ?? null;
  const h = d?.heute ?? null;
  const heute = d?.datum ?? null;
  const laeuft = !!s && !!heute && heute <= s.ende;

  return (
    <main className="wrap">
      <TopBar title="Die Hunderter" back={{ label: 'Heute', href: '/' }} />
      <header className="head">
        <span className="eyebrow">{s ? `${datum(s.start)} bis ${datum(s.ende)}` : '100 Tage'}</span>
        <h1 className="title">Die Hunderter<i>.</i></h1>
      </header>
      {!d ? <p className="loading">Lädt …</p> : !laeuft ? (
        <div className="group pad">
          {s ? <p className="small">Die letzten Hunderter: {s.gezaehlt} von {TAGE} Tagen gezählt, {s.voll} davon voll.</p> : null}
          <p className="small">Jeden Tag: 100 Content, je zwei Phasen à 50 + 10 für Shop, Mail und Briefe, Förderung, Plattform, Admin und System. Dazu verordnet Life dir fünf kleine Leben-Aufgaben. Die Hälfte jedes Standards plus alle fünf Aufgaben, dann zählt der Tag. Zehn Joker hängen je einen Tag hinten an.</p>
          <span className="fb-frage">Wann geht es los?</span>
          <div className="fb-opts" role="radiogroup" aria-label="Start">
            {(['heute', 'morgen'] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={start === k} className="fb-chip" onClick={() => setStart(k)}>{k === 'heute' ? 'Heute' : 'Morgen'}</button>)}
          </div>
          <button type="button" className="btn primary" disabled={busy || !heute} onClick={() => heute && tun({ aktion: 'anlegen', start: start === 'heute' ? heute : plusTage(heute, 1) }, 'Die Hunderter laufen')}>Hunderter starten</button>
        </div>
      ) : (
        <>
          <section className="gsec">
            <h2 className="glabel">{s.nr ? `Tag ${s.nr} von ${TAGE}` : 'Joker-Tag'} · {s.gezaehlt} von {s.zellen.filter((z) => z.tag <= s.heute).length} Tagen gezählt · {s.voll} voll</h2>
            <div className="group pad">
              <div className="hu-raster" role="img" aria-label={`Raster der 100 Tage, ${s.gezaehlt} gezählt`}>
                {s.zellen.map((z) => <span key={z.tag} className={'hu-zelle ' + z.zustand} title={`Tag ${z.nr}, ${datum(z.tag)}`}>{z.zustand === 'heute' || z.nr % 10 === 0 ? z.nr : ''}</span>)}
              </div>
              <div className="hu-legende small">
                <span><i className="hu-zelle voll" />voll</span><span><i className="hu-zelle zaehlt" />zählt</span>
                <span><i className="hu-zelle nicht" />zählt nicht</span><span><i className="hu-zelle heute" />heute</span>
              </div>
            </div>
          </section>

          <section className="gsec">
            <h2 className="glabel">Mindestens die Hälfte geschafft</h2>
            <div className="group pad">
              {s.quoten.map((q) => {
                const von = Math.max(1, s.zellen.filter((z) => z.tag <= s.heute).length);
                const p = Math.round((q.tage / von) * 100);
                return (
                  <div key={q.name} className="hu-quote">
                    <span>{q.name}</span><span className="hu-spur"><i className={p >= 80 ? 'gut' : ''} style={{ width: `${Math.min(100, p)}%` }} /></span><small className="num">{q.tage}/{von}</small>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="gsec">
            <h2 className="glabel">Zähler der Saison</h2>
            <div className="hu-zaehler">
              <div className="group pad"><b className="num">{zahl(s.phasen)}</b><small>von 1.000 Phasen</small></div>
              <div className="group pad"><b className="num">{zahl(s.contentPieces)}</b><small>von 10.000 Pieces</small></div>
              <div className="group pad"><b className="num">{zahl(s.leben)}</b><small>von 500 Leben</small></div>
            </div>
          </section>

          {s.bremsen.length ? (
            <section className="gsec">
              <h2 className="glabel">Was am häufigsten gebremst hat</h2>
              <div className="group pad"><p className="small">{s.bremsen.slice(0, 4).map((b) => `${b.name} (${b.n})`).join(' · ')}</p></div>
            </section>
          ) : null}

          <section className="gsec">
            <h2 className="glabel">Joker · {s.jokerFrei} von {JOKER} frei</h2>
            <div className="group pad">
              {s.jokerTage.length ? (
                <ul className="hu-joker">
                  {s.jokerTage.map((t) => (
                    <li key={t}><span className="grow">{datum(t)}</span>
                      {heute && t >= heute ? <button type="button" className="linkbtn" disabled={busy} onClick={() => tun({ aktion: 'joker', tag: t, setzen: false }, 'Joker zurückgenommen')}>Zurücknehmen</button> : <small className="muted">genommen</small>}
                    </li>
                  ))}
                </ul>
              ) : <p className="muted small">Noch kein Joker gesetzt.</p>}
              <label className="fb-frage" htmlFor="joker-tag">Joker planen, zum Beispiel Weihnachten</label>
              <div className="hu-zeile">
                <input id="joker-tag" type="date" className="fb-text" value={jokerTag} min={heute ?? undefined} max={s.ende} onChange={(e) => setJokerTag(e.target.value)} />
                <button type="button" className="btn" disabled={busy || !jokerTag || s.jokerFrei < 1} onClick={() => tun({ aktion: 'joker', tag: jokerTag, setzen: true }, 'Joker gesetzt')}>Joker setzen</button>
              </div>
              <p className="muted small">Für heute geht ein Joker nur bis 10 Uhr. Jeder Joker schiebt das Ende um einen Tag.</p>
            </div>
          </section>
        </>
      )}
      {toast}
      <TabBar />
    </main>
  );
}

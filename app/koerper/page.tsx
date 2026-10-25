'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Icon, TabBar, TopBar, api, fTime, useToast } from '../ui';
import { Essen } from './essen';

type Tag = { tag: string; schlaf_min: number | null; erholung: number | null; hrv: number | null; ruhepuls: number | null; belastung: number | null };
type K = {
  ruheMin: number; ruheTage: number;
  heute: string; blockWoche: number; letzteNacht: Tag | null; tage: Tag[]; kraft: number; zone2: number; intervall: number; ausgefallen: number;
  trainingstagHeute: boolean; warnungen: string[]; stand: { einheitenSoll: number; uhrzeit: string };
  whoop: { bereit: boolean; verbunden: boolean; zuletzt: string | null };
};

const hm = (min: number | null) => (min === null ? '–' : `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`);
const erholFarbe = (e: number | null | undefined) => (e == null ? 'var(--faint)' : e < 34 ? 'var(--bad)' : e < 67 ? 'var(--warn)' : 'var(--ok)');
const RIR = ['3 Wiederholungen vor Schluss', '2 Wiederholungen vor Schluss', '1 Wiederholung vor Schluss', '0 bis 1 Wiederholung vor Schluss', 'Entlastung, locker bleiben'];

function Balken({ label, wert, ziel, einheit }: { label: string; wert: number; ziel: number; einheit?: string }) {
  const p = Math.min(100, Math.round((wert / Math.max(1, ziel)) * 100));
  return (
    <div className="kb-row">
      <div className="kb-top"><span>{label}</span><span className="num">{wert} / {ziel}{einheit ? ` ${einheit}` : ''}</span></div>
      <div className="kb-bar" role="progressbar" aria-valuenow={wert} aria-valuemax={ziel} aria-label={label}><i style={{ width: `${p}%` }} className={p >= 100 ? 'voll' : ''} /></div>
    </div>
  );
}

export default function Koerper() {
  const [k, setK] = useState<K | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useToast();
  const laden = useCallback(async () => setK(await api<K>('/api/koerper')), []);
  useEffect(() => {
    laden().catch((e) => setToast((e as Error).message, 'err'));
    const q = new URLSearchParams(window.location.search).get('whoop');
    if (q === 'ok') setToast('WHOOP ist verbunden. Die letzten 30 Tage kommen gleich.');
    if (q === 'fehler') setToast('WHOOP hat die Verbindung abgelehnt. Bitte nochmal.', 'err');
    if (q) window.history.replaceState(null, '', '/koerper');
  }, [laden, setToast]);

  async function abgleichen() {
    setBusy(true);
    try { await api('/api/koerper', { method: 'POST', body: JSON.stringify({ aktion: 'abgleichen' }) }); await laden(); setToast('Abgeglichen'); }
    catch (e) { setToast((e as Error).message, 'err'); } finally { setBusy(false); }
  }
  async function plan(body: Record<string, unknown>) {
    try { await api('/api/training', { method: 'PATCH', body: JSON.stringify(body) }); await laden(); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }
  async function eintragen(art: string, dauer_min: number, text: string) {
    try { await api('/api/training', { method: 'POST', body: JSON.stringify({ art, dauer_min }) }); await laden(); setToast(text); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }

  const n = k?.letzteNacht;
  const datum = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return (
    <main className="wrap">
      <TopBar title="Körper" />
      <header className="head"><span className="eyebrow">{datum}</span><h1 className="title">Körper<i>.</i></h1></header>

      <section className="gsec" aria-label="Heute">
        <h2 className="glabel">Letzte Nacht</h2>
        <div className={k?.whoop.verbunden ? 'kachelfeld' : 'group pad'}>
          {k === null ? <p className="muted small">Lädt …</p>
            : !k.whoop.bereit ? <p className="muted small">WHOOP ist auf dem Server noch nicht eingerichtet. Sobald WHOOP_CLIENT_ID und WHOOP_CLIENT_SECRET in der .env stehen, verbindest du hier.</p>
            : !k.whoop.verbunden ? <><p className="muted small">Verbinde WHOOP einmal. Danach holt Life Schlaf, Erholung, Puls und Trainings selbst ab.</p><a className="btn primary" href="/api/whoop/start">WHOOP verbinden</a></>
            : <>
              <div className="werte">
                <div className="kachel breit" style={{ '--c': erholFarbe(n?.erholung) } as React.CSSProperties}>
                  <span className="kachel-name"><i />Erholung</span>
                  <b>{n?.erholung ?? '–'}{n?.erholung != null ? <small>%</small> : null}</b>
                  {n?.erholung != null ? <>
                    <div className="erholung" role="img" aria-label={`Erholung ${n.erholung} von 100`}><span style={{ left: `${Math.max(0, Math.min(100, n.erholung))}%` }} /></div>
                    <div className="erholung-achse"><span>0</span><span>{n.erholung < 34 ? 'Heute schonen' : n.erholung < 67 ? 'Mach heute locker' : 'Bereit für Belastung'}</span><span>100</span></div>
                  </> : null}
                </div>
                <div className="kachel" style={{ '--c': 'var(--k-mental)' } as React.CSSProperties}><span className="kachel-name"><i />Schlaf</span><b>{hm(n?.schlaf_min ?? null)}</b></div>
                <div className="kachel" style={{ '--c': 'var(--k-zeit)' } as React.CSSProperties}><span className="kachel-name"><i />HRV</span><b>{n?.hrv != null ? Math.round(n.hrv) : '–'}<small>ms</small></b></div>
                <div className="kachel breit klein" style={{ '--c': 'var(--k-sozial)' } as React.CSSProperties}><span className="kachel-name"><i />Ruhepuls</span><b>{n?.ruhepuls ?? '–'}<small>Schläge pro Minute</small></b></div>
              </div>
              <p className="gnote flush">{k.whoop.zuletzt ? `Abgeglichen um ${fTime(k.whoop.zuletzt)}` : 'Noch nicht abgeglichen'} · <button type="button" className="linkbtn" onClick={abgleichen} disabled={busy}>{busy ? 'Gleicht ab …' : 'Jetzt abgleichen'}</button></p>
            </>}
          {k?.warnungen.map((w) => <p key={w} className="coach-warn">{w}</p>)}
        </div>
      </section>

      <section className="gsec" aria-label="Training">
        <h2 className="glabel">Training · Woche {k?.blockWoche ?? '–'} von 5</h2>
        <div className="group pad">
          {k ? <>
            <p className="muted small">{RIR[(k.blockWoche || 1) - 1]}. {k.blockWoche === 5 ? 'Halbe Sätze, danach startet ein neuer Block.' : 'Jede Woche ein bisschen mehr.'}</p>
            <Balken label="Kraft, Ganzkörper" wert={k.kraft} ziel={k.stand.einheitenSoll} />
            <Balken label="Ausdauer locker (Zone 2)" wert={k.zone2} ziel={180} einheit="Min." />
            <Balken label="Intervalle 4 × 4" wert={k.intervall} ziel={1} />
            <Link className={'btn ' + (k.trainingstagHeute ? 'primary' : '')} href="/koerper/training">{Icon.up}Krafteinheit starten</Link>
            <div className="fb-q">
              <span className="fb-frage">Wie viele Krafteinheiten passen diese Woche?</span>
              <div className="fb-opts" role="radiogroup" aria-label="Einheiten pro Woche">{[2, 3, 4].map((x) => <button key={x} type="button" role="radio" aria-checked={k.stand.einheitenSoll === x} className="fb-chip" onClick={() => plan({ einheitenSoll: x })}>{x}</button>)}</div>
            </div>
            <div className="fb-q">
              <span className="fb-frage">Erinnerung an Trainingstagen</span>
              <input className="zeitfeld" type="time" aria-label="Uhrzeit fürs Training" value={k.stand.uhrzeit} onChange={(e) => e.target.value && plan({ uhrzeit: e.target.value })} />
            </div>
            <div className="fb-q">
              <span className="fb-frage">Ohne WHOOP eintragen</span>
              <div className="fb-opts">
                <button type="button" className="fb-chip" onClick={() => eintragen('zone2', 30, '30 Minuten Zone 2 eingetragen')}>Zone 2, 30 Min.</button>
                <button type="button" className="fb-chip" onClick={() => eintragen('zone2', 45, '45 Minuten Zone 2 eingetragen')}>Zone 2, 45 Min.</button>
                <button type="button" className="fb-chip" onClick={() => eintragen('intervall', 35, 'Intervall eingetragen')}>4 × 4 erledigt</button>
                <button type="button" className="fb-chip" onClick={() => eintragen('mobil', 10, 'Beweglichkeit eingetragen')}>Beweglichkeit 10 Min.</button>
              </div>
            </div>
            <details className="disclose"><summary>So geht 4 × 4</summary>
              <ol className="steps"><li>10 Minuten locker warm laufen.</li><li>4 Minuten hart, so dass Sprechen kaum geht (85 bis 95 Prozent der maximalen Herzfrequenz).</li><li>3 Minuten locker gehen oder traben.</li><li>Viermal hart, dazwischen dreimal locker. 5 Minuten auslaufen.</li></ol>
            </details>
          </> : <p className="muted small">Lädt …</p>}
        </div>
      </section>

      <section className="gsec" aria-label="Ruhe">
        <h2 className="glabel">Ruhe</h2>
        <Link className="group cell" href="/koerper/ruhe"><span>Stille, Atem, NSDR, Wim Hof, Runterfahren</span><span className="val">{k ? `${k.ruheMin} Min. diese Woche` : ''}{Icon.chevronRight}</span></Link>
      </section>

      {/* Nach jedem WHOOP-Abgleich neu laden, damit das Gewicht fürs Protein-Ziel stimmt */}
      <Essen key={k?.whoop.zuletzt ?? '-'} onFehler={(m) => setToast(m, 'err')} onOk={(m) => setToast(m)} />

      {toast}
      <TabBar />
    </main>
  );
}

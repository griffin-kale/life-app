'use client';
import Link from 'next/link';
import { Icon, TabBar, TopBar, fTime } from '../../ui';
import { Balken, RIR, erholFarbe, hm, useKoerper } from '../daten';

/** Training und Ausdauer: Block, Einheiten pro Woche, Erinnerung, Eintragen ohne WHOOP. */
export default function Bewegung() {
  const { k, toast, plan, eintragen } = useKoerper('/koerper/bewegung');
  return (
    <main className="wrap">
      <TopBar title="Training" back={{ label: 'Körper', href: '/koerper' }} />
      <header className="head"><span className="eyebrow">Woche {k?.blockWoche ?? '–'} von 5 im Block</span><h1 className="title">Training<i>.</i></h1></header>
      <section className="gsec" aria-label="Training">
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
            <div className="fb-q" id="ohne-whoop">
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

      {toast}
      <TabBar />
    </main>
  );
}

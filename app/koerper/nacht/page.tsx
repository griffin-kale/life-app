'use client';
import Link from 'next/link';
import { Icon, TabBar, TopBar, fTime } from '../../ui';
import { Balken, RIR, erholFarbe, hm, useKoerper } from '../daten';

/** Letzte Nacht: alle WHOOP-Werte, Abgleich und Verbindung. */
export default function Nacht() {
  const { k, busy, toast, abgleichen } = useKoerper('/koerper/nacht');
  const n = k?.letzteNacht;
  const datum = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return (
    <main className="wrap">
      <TopBar title="Letzte Nacht" back={{ label: 'Körper', href: '/koerper' }} />
      <header className="head"><span className="eyebrow">{datum}</span><h1 className="title">Letzte Nacht<i>.</i></h1></header>
      <section className="gsec" aria-label="Heute">
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

      {toast}
      <TabBar />
    </main>
  );
}

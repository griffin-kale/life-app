'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TabBar, TopBar, api, fTime } from '../ui';
import { erholFarbe, hm, useKoerper } from './daten';
import { UeberKarte, type Karte } from '../ueberkarte';

/** Körper auf einen Blick: Erholung oben, darunter vier Karten mit je einer Zahl und einer Handlung. Details liegen eine Ebene tiefer. */
export default function Koerper() {
  const { k, busy, toast, abgleichen } = useKoerper('/koerper');
  const [essen, setEssen] = useState<{ protein: number; ziel: number } | null>(null);
  useEffect(() => {
    api<{ liste: { protein: number | null; protein_bis: number | null }[]; proteinZiel: number }>('/api/essen')
      .then((e) => setEssen({ protein: Math.round(e.liste.reduce((a, m) => a + ((m.protein ?? 0) + (m.protein_bis ?? m.protein ?? 0)) / 2, 0)), ziel: e.proteinZiel })).catch(() => {});
  }, []);
  const n = k?.letzteNacht;
  const datum = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const karten: Karte[] = k ? [
    { href: '/koerper/bewegung', titel: 'Training', farbe: 'var(--k-koerper)', zahl: `${k.kraft} / ${k.stand.einheitenSoll}`, sub: `Kraft diese Woche · ${k.trainingstagHeute ? 'heute Trainingstag' : 'heute frei'}`, aktion: { href: '/koerper/training', text: 'Krafteinheit starten' } },
    { href: '/koerper/essen', titel: 'Essen', farbe: 'var(--k-geld)', zahl: essen ? `${essen.protein} g` : '–', sub: essen ? `Protein von ${essen.ziel} g` : 'Protein heute', aktion: { href: '/koerper/essen', text: '+ Mahlzeit' } },
    { href: '/koerper/ruhe', titel: 'Ruhe', farbe: 'var(--k-mental)', zahl: `${k.ruheMin} Min.`, sub: `an ${k.ruheTage} ${k.ruheTage === 1 ? 'Tag' : 'Tagen'} diese Woche`, aktion: { href: '/koerper/ruhe', text: '▶ Starten' } },
    { href: '/koerper/bewegung', titel: 'Ausdauer', farbe: 'var(--k-zeit)', zahl: `${k.zone2} Min.`, sub: `Zone 2 von 180 · Intervalle ${k.intervall} von 1`, aktion: { href: '/koerper/bewegung#ohne-whoop', text: 'Eintragen' } },
  ] : [];
  return (
    <main className="wrap breit">
      <TopBar title="Körper" />
      <header className="head"><span className="eyebrow">{datum}</span><h1 className="title">Körper<i>.</i></h1></header>

      <section className="gsec" aria-label="Letzte Nacht">
        {k === null ? <div className="group pad"><p className="muted small">Lädt …</p></div>
          : !k.whoop.bereit ? <div className="group pad"><p className="muted small">WHOOP ist auf dem Server noch nicht eingerichtet. Sobald WHOOP_CLIENT_ID und WHOOP_CLIENT_SECRET in der .env stehen, verbindest du hier.</p></div>
          : !k.whoop.verbunden ? <div className="group pad"><p className="muted small">Verbinde WHOOP einmal. Danach holt Life Schlaf, Erholung, Puls und Trainings selbst ab.</p><a className="btn primary" href="/api/whoop/start">WHOOP verbinden</a></div>
          : <>
            <Link href="/koerper/nacht" className="kachel nacht-karte" style={{ '--c': erholFarbe(n?.erholung) } as React.CSSProperties}>
              <span className="kachel-name"><i />Erholung</span>
              <b>{n?.erholung ?? '–'}{n?.erholung != null ? <small>%</small> : null}</b>
              {n?.erholung != null ? <span className="erholung" role="img" aria-label={`Erholung ${n.erholung} von 100`}><span style={{ left: `${Math.max(0, Math.min(100, n.erholung))}%` }} /></span> : null}
              <span className="erholung-achse"><span>Schlaf {hm(n?.schlaf_min ?? null)} · HRV {n?.hrv != null ? Math.round(n.hrv) : '–'} · Ruhepuls {n?.ruhepuls ?? '–'}</span><span>{n?.erholung == null ? '' : n.erholung < 34 ? 'Heute schonen' : n.erholung < 67 ? 'Mach heute locker' : 'Bereit für Belastung'}</span></span>
            </Link>
            <p className="gnote">{k.whoop.zuletzt ? `Abgeglichen um ${fTime(k.whoop.zuletzt)}` : 'Noch nicht abgeglichen'} · <button type="button" className="linkbtn" onClick={abgleichen} disabled={busy}>{busy ? 'Gleicht ab …' : 'Jetzt abgleichen'}</button></p>
          </>}
        {k?.warnungen.map((w) => <p key={w} className="coach-warn">{w}</p>)}
      </section>

      {karten.length ? <section className="ueber" aria-label="Bereiche">{karten.map((c) => <UeberKarte key={c.titel} c={c} />)}</section> : null}

      {toast}
      <TabBar />
    </main>
  );
}

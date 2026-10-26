'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TabBar, TopBar, api } from '../ui';
import { erholFarbe, useKoerper } from './daten';
import { UeberKarte, type Karte } from '../ueberkarte';

/** Körper auf einen Blick: Erholung oben, darunter drei Karten mit je einer Zahl und einer Handlung. Details und Abgleich liegen eine Ebene tiefer. */
export default function Koerper() {
  const { k, toast } = useKoerper('/koerper');
  const [essen, setEssen] = useState<{ protein: number; ziel: number } | null>(null);
  useEffect(() => {
    api<{ liste: { protein: number | null; protein_bis: number | null }[]; proteinZiel: number }>('/api/essen')
      .then((e) => setEssen({ protein: Math.round(e.liste.reduce((a, m) => a + ((m.protein ?? 0) + (m.protein_bis ?? m.protein ?? 0)) / 2, 0)), ziel: e.proteinZiel })).catch(() => {});
  }, []);
  const n = k?.letzteNacht;
  const datum = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const karten: Karte[] = k ? [
    // So wenig wie nötig (0.19): eine Zahl pro Karte, Training und Ausdauer führen zur selben Seite und sind eine Karte
    { href: '/koerper/bewegung', titel: 'Bewegung', farbe: 'var(--k-koerper)', zahl: `${k.kraft} / ${k.stand.einheitenSoll}`, sub: `${k.zone2} Min. Ausdauer`, aktion: k.trainingstagHeute ? { href: '/koerper/training', text: 'Krafteinheit starten' } : undefined },
    { href: '/koerper/essen', titel: 'Protein', farbe: 'var(--k-geld)', zahl: essen ? `${essen.protein} / ${essen.ziel} g` : '–', aktion: { href: '/koerper/essen', text: '+ Mahlzeit' } },
    { href: '/koerper/ruhe', titel: 'Ruhe', farbe: 'var(--k-mental)', zahl: `${k.ruheMin} Min.`, aktion: { href: '/koerper/ruhe', text: '▶ Starten' } },
  ] : [];
  return (
    <main className="wrap breit">
      <TopBar title="Körper" />
      <header className="head"><span className="eyebrow">{datum}</span><h1 className="title">Körper<i>.</i></h1></header>

      <section className="gsec" aria-label="Letzte Nacht">
        {k === null ? <div className="group pad"><p className="muted small">Lädt …</p></div>
          : !k.whoop.bereit ? <div className="group pad"><p className="muted small">WHOOP ist noch nicht eingerichtet.</p></div>
          : !k.whoop.verbunden ? <div className="group pad"><a className="btn primary" href="/api/whoop/start">WHOOP verbinden</a></div>
          : <>
            <Link href="/koerper/nacht" className="kachel nacht-karte" style={{ '--c': erholFarbe(n?.erholung) } as React.CSSProperties}>
              <span className="kachel-name"><i />Erholung</span>
              <b>{n?.erholung ?? '–'}{n?.erholung != null ? <small>%</small> : null}</b>
              {n?.erholung != null ? <span className="erholung" role="img" aria-label={`Erholung ${n.erholung} von 100`}><span style={{ left: `${Math.max(0, Math.min(100, n.erholung))}%` }} /></span> : null}
              <span className="erholung-achse"><span>{n?.erholung == null ? '' : n.erholung < 34 ? 'Heute schonen' : n.erholung < 67 ? 'Mach heute locker' : 'Bereit für Belastung'}</span></span>
            </Link>
          </>}
        {k?.warnungen.map((w) => <p key={w} className="coach-warn">{w}</p>)}
      </section>

      {karten.length ? <section className="ueber" aria-label="Bereiche">{karten.map((c) => <UeberKarte key={c.titel} c={c} />)}</section> : null}

      {toast}
      <TabBar />
    </main>
  );
}

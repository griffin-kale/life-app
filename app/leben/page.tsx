'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon, TabBar, TopBar, api } from '../ui';
import { useCockpit } from '../cockpit';
import { MiniRinge } from '../ringe';

type Konto = { href: string; name: string; farbe: string; konto: 'koerper' | 'mental' | 'geld' | 'sozial'; aktion: [string, string] };
const KONTEN: Konto[] = [
  { href: '/koerper', name: 'Körper', farbe: 'var(--k-koerper)', konto: 'koerper', aktion: ['Essen festhalten', '/koerper/essen'] },
  { href: '/koerper/ruhe', name: 'Ruhe', farbe: 'var(--k-mental)', konto: 'mental', aktion: ['Ruhe starten', '/koerper/ruhe'] },
  { href: '/geld', name: 'Geld', farbe: 'var(--k-geld)', konto: 'geld', aktion: ['Ausgabe festhalten', '/geld?erfassen=1'] },
  { href: '/menschen', name: 'Menschen', farbe: 'var(--k-sozial)', konto: 'sozial', aktion: ['Wer ist dran?', '/menschen'] },
];

/** Leben (0.28, Peter 31.10.2026): die vier Konten mit je einem Satz für heute und einem direkten Weg, darunter der Stand. Ersetzt „Ich“. */
export default function Leben() {
  const { c } = useCockpit();
  const [ringe, setRinge] = useState<Record<string, number | null> | null>(null);
  useEffect(() => { api<{ jetzt: { ringe: Record<string, number | null> } }>('/api/kompass').then((k) => setRinge(k.jetzt.ringe)).catch(() => {}); }, []);
  const text = (k: Konto['konto']) => c?.konten.find((x) => x.konto === k)?.text ?? '';
  return (
    <main className="wrap">
      <TopBar title="Leben" profil />
      <header className="head"><span className="eyebrow">Deine vier Konten</span><h1 className="title">Leben<i>.</i></h1></header>
      <section className="lb-konten" aria-label="Konten">
        {KONTEN.map((k) => (
          <div key={k.href} className="lb-konto" style={{ '--c': k.farbe } as React.CSSProperties}>
            <Link href={k.href} className="lb-kopf">
              <span className="ck-name">{k.name}</span>
              {k.konto === 'koerper' && c?.erholung != null ? <b className="num">{c.erholung}<small>% Erholung</small></b> : null}
              <span className="lb-text">{text(k.konto) || 'Noch nichts für heute'}</span>
            </Link>
            <Link href={k.aktion[1]} className="chipbtn lb-aktion">{k.aktion[0]}</Link>
          </div>
        ))}
      </section>
      <section className="gsec">
        <div className="group">
          <Link className="cell" href="/stand">
            <span className="lbl">Stand<small>Wochenringe, Engpass, Richtung</small></span>
            <span className="val">{ringe ? <MiniRinge ringe={ringe} anzeige /> : null}{Icon.chevronRight}</span>
          </Link>
          <Link className="cell" href="/fokus"><span className="lbl">Deep Work und Musiktest</span>{Icon.chevronRight}</Link>
          <Link className="cell" href="/einstellungen"><span className="lbl">Einstellungen</span>{Icon.chevronRight}</Link>
        </div>
      </section>
      <TabBar />
    </main>
  );
}

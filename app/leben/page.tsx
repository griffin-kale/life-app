'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon, TabBar, TopBar, api } from '../ui';
import { useCockpit } from '../cockpit';
import { MiniRinge } from '../ringe';

type Konto = { href: string; name: string; farbe: string; konto: 'geschaeft' | 'koerper' | 'mental' | 'geld' | 'sozial' | 'zeit'; aktion: [string, string] };
/** Die eine Bereichsliste (0.33): Arbeit, Körper, Ruhe, Menschen, Geld, Zeit. Reihenfolge wie in lib/bereiche.ts. */
const KONTEN: Konto[] = [
  { href: '/ziele', name: 'Arbeit', farbe: 'var(--k-arbeit)', konto: 'geschaeft', aktion: ['Fokus starten', '/fokus'] },
  { href: '/koerper', name: 'Körper', farbe: 'var(--k-koerper)', konto: 'koerper', aktion: ['Essen festhalten', '/koerper/essen'] },
  { href: '/koerper/ruhe', name: 'Ruhe', farbe: 'var(--k-mental)', konto: 'mental', aktion: ['Ruhe starten', '/koerper/ruhe'] },
  { href: '/menschen', name: 'Menschen', farbe: 'var(--k-sozial)', konto: 'sozial', aktion: ['Wer ist dran?', '/menschen'] },
  { href: '/geld', name: 'Geld', farbe: 'var(--k-geld)', konto: 'geld', aktion: ['Ausgabe festhalten', '/geld?erfassen=1'] },
  { href: '/woche', name: 'Zeit', farbe: 'var(--k-zeit)', konto: 'zeit', aktion: ['Irgendwann ansehen', '/woche/parkplatz'] },
];

/** Leben (0.28, Peter 31.10.2026; seit 0.33 sechs Lebensbereiche): je ein Satz für heute und ein direkter Weg, darunter der Kompass. Ersetzt „Ich“. */
export default function Leben() {
  const { c } = useCockpit();
  const router = useRouter();
  // Verborgener Zugang zur Ablage (0.30): den Titel lange drücken. Kein Menüpunkt, kein Hinweis.
  const halten = useRef<ReturnType<typeof setTimeout> | null>(null);
  const los = () => { halten.current = setTimeout(() => router.push('/ablage'), 900); };
  const stopp = () => { if (halten.current) clearTimeout(halten.current); halten.current = null; };
  const [ringe, setRinge] = useState<Record<string, number | null> | null>(null);
  useEffect(() => { api<{ jetzt: { ringe: Record<string, number | null> } }>('/api/kompass').then((k) => setRinge(k.jetzt.ringe)).catch(() => {}); }, []);
  const f = c?.woche.fokus;
  const text = (k: Konto['konto']) => (k === 'geschaeft' ? (f ? `${f.erledigt} von ${f.von} Dingen der Woche erledigt` : c?.woche.wochenziel ? `Woche: ${c.woche.wochenziel}` : '') : c?.konten.find((x) => x.konto === k)?.text ?? '');
  return (
    <main className="wrap">
      <TopBar title="Leben" profil />
      <header className="head"><span className="eyebrow">Sechs Bereiche, einer für alles</span><h1 className="title lb-titel" onPointerDown={los} onPointerUp={stopp} onPointerLeave={stopp} onPointerCancel={stopp} onContextMenu={(e) => e.preventDefault()}>Leben<i>.</i></h1></header>
      <section className="lb-konten" aria-label="Lebensbereiche">
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
            <span className="lbl">Kompass<small>Wochenringe, Engpass, Richtung</small></span>
            <span className="val">{ringe ? <MiniRinge ringe={ringe} anzeige /> : null}{Icon.chevronRight}</span>
          </Link>
          <Link className="cell" href="/einstellungen"><span className="lbl">Einstellungen</span>{Icon.chevronRight}</Link>
        </div>
      </section>
      <TabBar />
    </main>
  );
}

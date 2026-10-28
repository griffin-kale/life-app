'use client';
import Link from 'next/link';
import { Icon, TabBar, TopBar } from '../ui';
import { useCockpit } from '../cockpit';

type Konto = { href: string; name: string; farbe: string; konto?: 'koerper' | 'mental' | 'geld' | 'sozial' };
const KONTEN: Konto[] = [
  { href: '/koerper', name: 'Körper', farbe: 'var(--k-koerper)', konto: 'koerper' },
  { href: '/koerper/ruhe', name: 'Ruhe', farbe: 'var(--k-mental)', konto: 'mental' },
  { href: '/geld', name: 'Geld', farbe: 'var(--k-geld)', konto: 'geld' },
  { href: '/menschen', name: 'Menschen', farbe: 'var(--k-sozial)', konto: 'sozial' },
];

/** Ich (Life 2.0): die Konten mit je einem Satz für heute, darunter Logbuch und Einstellungen. Ersetzt „Mehr“. */
export default function Ich() {
  const { c } = useCockpit();
  const text = (k?: Konto['konto']) => c?.konten.find((x) => x.konto === k)?.text ?? '';
  return (
    <main className="wrap">
      <TopBar title="Ich" />
      <header className="head"><span className="eyebrow">Deine Konten</span><h1 className="title">Ich<i>.</i></h1></header>
      <section className="ich-konten" aria-label="Konten">
        <Link href={KONTEN[0].href} className="ich-konto" style={{ '--c': KONTEN[0].farbe } as React.CSSProperties}>
          <span className="ck-name">Körper</span>
          <b className="num">{c?.erholung != null ? <>{c.erholung}<small>% Erholung</small></> : '–'}</b>
          <span className="ich-text">{text('koerper')}</span>
        </Link>
        {KONTEN.slice(1).map((k) => (
          <Link key={k.href} href={k.href} className="ich-konto" style={{ '--c': k.farbe } as React.CSSProperties}>
            <span className="ck-name">{k.name}</span>
            <span className="ich-text">{text(k.konto) || ' '}</span>
          </Link>
        ))}
        <Link href="/archiv" className="ich-konto" style={{ '--c': 'var(--k-zeit)' } as React.CSSProperties}>
          <span className="ck-name">Logbuch</span>
          <span className="ich-text">Gedanken, Zitate, Videos und Bücher, alles durchsuchbar</span>
        </Link>
      </section>
      <section className="gsec">
        <div className="group">
          <Link className="cell" href="/einstellungen"><span className="lbl">Einstellungen</span>{Icon.chevronRight}</Link>
        </div>
      </section>
      <TabBar />
    </main>
  );
}

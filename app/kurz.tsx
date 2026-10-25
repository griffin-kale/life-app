'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Baustein } from '@/lib/heute-bausteine';
import { Icon, api } from './ui';

/** Kurze Bausteine für Heute: Körper, Geld, Menschen. Life lädt nur, was angezeigt wird. */
type Nacht = { schlaf_min: number | null; erholung: number | null } | null;
type KoerperK = { letzteNacht: Nacht; trainingstagHeute: boolean; whoop: { verbunden: boolean } };
type GeldK = { woche: { id: string; name: string; ausgaben?: number; rahmen?: number }[] };
type MenschenK = { faellig: { id: string; name: string; seit: number }[]; geburtstage: { id: string; name: string; bisGeburtstag: number | null }[] };

export function useKurz(bausteine: Baustein[]) {
  const [koerper, setKoerper] = useState<KoerperK | null>(null);
  const [geld, setGeld] = useState<GeldK | null>(null);
  const [menschen, setMenschen] = useState<MenschenK | null>(null);
  const k = bausteine.includes('koerper'), g = bausteine.includes('geld'), m = bausteine.includes('menschen');
  useEffect(() => { if (k) api<KoerperK>('/api/koerper').then(setKoerper).catch(() => {}); }, [k]);
  useEffect(() => { if (g) api<GeldK>('/api/geld').then(setGeld).catch(() => {}); }, [g]);
  useEffect(() => { if (m) api<MenschenK>('/api/menschen').then(setMenschen).catch(() => {}); }, [m]);
  return { koerper: k ? koerper : null, geld: g ? geld : null, menschen: m ? menschen : null };
}

const hm = (min: number | null) => (min === null ? '–' : `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`);
const erholFarbe = (e: number | null) => (e == null ? 'var(--faint)' : e < 34 ? 'var(--bad)' : e < 67 ? 'var(--warn)' : 'var(--ok)');
const euro = (c: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(c / 100);

export function KoerperKurz({ k }: { k: KoerperK }) {
  if (!k.whoop.verbunden || !k.letzteNacht) return null;
  const n = k.letzteNacht;
  return (
    <section aria-label="Körper kurz">
      <Link href="/koerper" className="werte kurz-werte">
        <span className="kachel" style={{ '--c': erholFarbe(n.erholung) } as React.CSSProperties}>
          <span className="kachel-name"><i />Erholung</span>
          <b>{n.erholung ?? '–'}{n.erholung != null ? <small>%</small> : null}</b>
          {n.erholung != null ? <span className="erholung klein" role="img" aria-label={`Erholung ${n.erholung} von 100`}><span style={{ left: `${Math.max(0, Math.min(100, n.erholung))}%` }} /></span> : null}
        </span>
        <span className="kachel" style={{ '--c': 'var(--k-mental)' } as React.CSSProperties}>
          <span className="kachel-name"><i />Schlaf</span>
          <b>{hm(n.schlaf_min)}</b>
          <span className="kachel-fuss">{k.trainingstagHeute ? 'Heute ist Trainingstag' : 'Heute kein Training geplant'}</span>
        </span>
      </Link>
    </section>
  );
}

export function GeldKurz({ g }: { g: GeldK }) {
  if (!g.woche.length) return null;
  const aus = g.woche.reduce((a, t) => a + (t.ausgaben ?? 0), 0), rahmen = g.woche.reduce((a, t) => a + (t.rahmen ?? 0), 0);
  const p = rahmen ? Math.round((aus / rahmen) * 100) : 0;
  return (
    <section aria-label="Geld kurz">
      <Link href="/geld" className="group pad kurz-zeile" style={{ '--c': 'var(--k-geld)' } as React.CSSProperties}>
        <span className="kb-top"><span>Geld diese Woche</span><span className={'num' + (aus > rahmen ? ' warn' : '')}>{euro(aus)} von {euro(rahmen)}</span></span>
        <span className="kb-bar" role="progressbar" aria-label="Geld diese Woche" aria-valuenow={aus} aria-valuemax={rahmen}><i style={{ width: `${Math.min(100, p)}%` }} className={aus > rahmen ? 'drueber' : ''} /></span>
      </Link>
    </section>
  );
}

export function MenschenKurz({ m }: { m: MenschenK }) {
  const g = m.geburtstage.find((p) => p.bisGeburtstag !== null && p.bisGeburtstag <= 7);
  const f = m.faellig[0];
  if (!g && !f) return null;
  return (
    <section aria-label="Menschen kurz">
      <Link href="/menschen" className="group kurz-menschen">
        {g ? <span className="cell static"><span className="avatar" style={{ background: 'var(--k-geld)' }} aria-hidden="true">{g.name.slice(0, 1)}</span><span className="lbl">{g.name}<small>{g.bisGeburtstag === 0 ? 'hat heute Geburtstag' : `Geburtstag in ${g.bisGeburtstag} ${g.bisGeburtstag === 1 ? 'Tag' : 'Tagen'}`}</small></span>{Icon.chevronRight}</span> : null}
        {f ? <span className="cell static"><span className="avatar" style={{ background: 'var(--k-sozial)' }} aria-hidden="true">{f.name.slice(0, 1)}</span><span className="lbl">{f.name}<small>seit {f.seit} Tagen nichts gehört</small></span>{Icon.chevronRight}</span> : null}
      </Link>
    </section>
  );
}

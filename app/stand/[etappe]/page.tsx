'use client';
import { notFound, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TabBar, TopBar, api } from '../../ui';
import { ETAPPEN } from '@/lib/standort';
import { Etappenleiste, StandBogen } from '../bogen';

/** Eine Etappe der Standortbestimmung. */
export default function EtappeSeite() {
  const p = useParams<{ etappe: string }>();
  const nr = Number(p.etappe);
  const [erledigt, setErledigt] = useState<number[]>([]);
  useEffect(() => { api<{ etappen: { nr: number; erledigt: string | null }[] }>('/api/stand').then((r) => setErledigt(r.etappen.filter((e) => e.erledigt).map((e) => e.nr))).catch(() => {}); }, []);
  if (nr !== 1 && nr !== 2 && nr !== 3) notFound();
  const e = ETAPPEN.find((x) => x.nr === nr)!;
  return (
    <main className="wrap">
      <TopBar title={e.titel} back={{ label: 'Dein Stand', href: '/stand' }} />
      <header className="head">
        <span className="eyebrow">Standortbestimmung · Etappe {nr} von 3 · {e.dauer}</span>
        <h1 className="title">{e.titel}<i>.</i></h1>
        <p className="muted small">{e.kurz}</p>
        <Etappenleiste nr={nr} erledigt={erledigt} />
      </header>
      <StandBogen key={nr} nr={nr as 1 | 2 | 3} />
      <TabBar />
    </main>
  );
}

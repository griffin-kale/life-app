'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon, api } from './ui';
import type { SaisonStand } from '@/lib/saison';

/** Die Saison neben der Woche (Mac und iPad quer, Peter 31.10.2026): zwölf Wochen, Ziele mit Fortschritt, ein Tipp zur ganzen Saison. */
export function SaisonKurz() {
  const [s, setS] = useState<SaisonStand | null | undefined>(undefined);
  useEffect(() => { api<{ saison: SaisonStand | null }>('/api/saison').then((x) => setS(x.saison)).catch(() => setS(null)); }, []);
  if (s === undefined) return null;
  if (!s) return (
    <Link href="/ziele/neu" className="group pad sk-leer">
      <span className="ck-name">Saison</span><b>Noch keine Saison</b><small>Zwölf Wochen, ein Ziel pro Bereich. Etwa zehn Minuten.</small>
    </Link>
  );
  return (
    <section className="gsec sk" aria-label="Saison">
      <Link href="/ziele" className="sk-kopf"><span className="glabel">Saison {s.name} · {s.woche < 1 ? 'beginnt bald' : `Woche ${s.woche} von 12`}</span>{Icon.chevronRight}</Link>
      <div className="sz-wochen" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} className={i + 1 < s.woche ? 'vorbei' : i + 1 === s.woche ? 'jetzt' : ''} />)}</div>
      <div className="group">
        {s.ziele.map((z) => (
          <Link key={z.id} href="/ziele" className="cell sk-ziel">
            <span className="lbl">{z.titel}<small>{z.bereichTitel}{z.offen ? ` · ${z.offen} offen` : ''}</small></span>
            <span className="val">{z.anteil !== null ? <span className="num">{Math.round(z.anteil * 100)} %</span> : null}{Icon.chevronRight}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { api } from './ui';

type Punkt = { id: number; text: string; erstellt: string };
const datum = (t: string) => new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(t + 'T12:00:00Z'));

/** Was der Coach sich merkt (0.29, Peter 31.10.2026). Alles sichtbar, jeder Punkt lässt sich streichen. */
export function Merkzettel({ onToast }: { onToast: (t: string, k?: 'ok' | 'err') => void }) {
  const [p, setP] = useState<Punkt[] | null>(null);
  useEffect(() => { api<{ punkte: Punkt[] }>('/api/coach/merken').then((r) => setP(r.punkte)).catch(() => setP([])); }, []);
  async function weg(x: Punkt) {
    try { await api(`/api/coach/merken?id=${x.id}`, { method: 'DELETE' }); setP((l) => (l ?? []).filter((y) => y.id !== x.id)); onToast('Gestrichen'); }
    catch (e) { onToast((e as Error).message, 'err'); }
  }
  return (
    <section className="gsec" aria-label="Was der Coach sich merkt">
      <h2 className="glabel">Was der Coach sich merkt</h2>
      <div className="group">
        {p === null ? <p className="cell static muted small">Lädt …</p>
          : !p.length ? <p className="cell static muted small">Noch nichts. Sag dem Coach etwas Festes, etwa deine Wohlfühlsumme, dann steht es hier.</p>
          : p.map((x) => (
            <div key={x.id} className="cell static mz-zeile">
              <span className="lbl">{x.text}<small>seit {datum(x.erstellt)}</small></span>
              <button type="button" className="chipbtn" onClick={() => weg(x)} aria-label={`Streichen: ${x.text}`}>Streichen</button>
            </div>
          ))}
      </div>
      <p className="gnote">Der Coach liest den Merkzettel bei jeder Antwort, Namen nur als Platzhalter. Er merkt sich etwas, sobald du etwas Festes sagst, und Life zeigt dir „✓ Gemerkt“.</p>
    </section>
  );
}

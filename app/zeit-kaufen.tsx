'use client';
import { useEffect, useState } from 'react';
import { betragAus, euro } from '@/lib/geld-regeln';
import { api } from './ui';

type Z = { id: string; was: string; stunden_monat: number; kosten_cent: number | null; status: 'idee' | 'gemacht' };

/** Liste „Zeit kaufen“: Geld für Zeitersparnis macht laut Studie zufriedener als Geld für Dinge (Whillans 2017). */
export function ZeitKaufen({ onToast }: { onToast: (t: string, k?: 'ok' | 'err') => void }) {
  const [liste, setListe] = useState<Z[]>([]);
  const [was, setWas] = useState(''); const [h, setH] = useState(0); const [k, setK] = useState('');
  const laden = () => api<Z[]>('/api/zeit-kaufen').then(setListe).catch(() => {});
  useEffect(() => { laden(); }, []);
  const proStunde = (z: Z) => (z.kosten_cent ? `${euro(Math.round(z.kosten_cent / z.stunden_monat))} pro gewonnene Stunde` : '');
  return (
    <section className="gsec" aria-label="Zeit kaufen">
      <h2 className="glabel">Zeit kaufen</h2>
      <div className="group pad">
        {liste.map((z) => (
          <div key={z.id} className="geld-zeile">
            <span>{z.status === 'gemacht' ? '✓ ' : ''}{z.was}<br /><span className="small muted">{String(z.stunden_monat).replace('.', ',')} Std. im Monat{z.kosten_cent ? ` · ${euro(z.kosten_cent)} · ${proStunde(z)}` : ''}</span></span>
            {z.status === 'idee' ? <button type="button" className="chipbtn" onClick={async () => { await api('/api/zeit-kaufen', { method: 'PATCH', body: JSON.stringify({ id: z.id, status: 'gemacht' }) }); laden(); }}>Abgegeben</button> : null}
            <button type="button" className="chipbtn" onClick={async () => { await api(`/api/zeit-kaufen?id=${z.id}`, { method: 'DELETE' }); laden(); }}>Löschen</button>
          </div>
        ))}
        <input className="zeitfeld breit" aria-label="Was du abgeben könntest" placeholder="Was du abgeben könntest, zum Beispiel Fenster putzen" value={was} onChange={(e) => setWas(e.target.value)} />
        <div className="fb-opts" role="radiogroup" aria-label="Stunden im Monat">{[1, 2, 4, 8].map((x) => <button key={x} type="button" role="radio" aria-checked={h === x} className="fb-chip" onClick={() => setH(x)}>{x} Std. im Monat</button>)}</div>
        <input className="zeitfeld breit" aria-label="Kosten im Monat" inputMode="decimal" placeholder="Kosten im Monat (freiwillig)" value={k} onChange={(e) => setK(e.target.value)} />
        <button type="button" className="btn" disabled={!was.trim() || !h} onClick={async () => {
          try { await api('/api/zeit-kaufen', { method: 'POST', body: JSON.stringify({ was, stunden_monat: h, kosten_cent: betragAus(k)?.cent ?? null }) }); setWas(''); setH(0); setK(''); laden(); onToast('Auf der Liste'); }
          catch (e) { onToast((e as Error).message, 'err'); }
        }}>Auf die Liste</button>
      </div>
      <p className="gnote">Geld für Zeitersparnis macht laut einer Studie zufriedener als Geld für Dinge. Der Coach bringt die Liste in die Wochenrunde.</p>
    </section>
  );
}

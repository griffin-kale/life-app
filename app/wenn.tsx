'use client';
import { useState } from 'react';
import { TAGESZEITEN } from '@/lib/fragen';
import { wennDann } from '@/lib/menschen-regeln';

const ORTE = ['am Schreibtisch', 'zu Hause', 'unterwegs'];

/** Wenn-dann-Plan zu einer Aufgabe: Tageszeit und Ort antippen, fertig. */
export function WennChip({ aufgabe, wert, onSetzen }: { aufgabe: string; wert: string | null | undefined; onSetzen: (s: string) => void }) {
  const [offen, setOffen] = useState(false); const [zeit, setZeit] = useState(''); const [ort, setOrt] = useState('');
  if (!offen) return <button type="button" className="chipbtn" onClick={() => setOffen(true)}>{wert ? 'Plan ändern' : 'Wenn …'}</button>;
  return (
    <div className="wenn-picker">
      <div className="fb-opts" role="radiogroup" aria-label="Wann">{TAGESZEITEN.map((z) => <button key={z} type="button" role="radio" aria-checked={zeit === z} className="fb-chip" onClick={() => setZeit(z)}>{z}</button>)}</div>
      <div className="fb-opts" role="radiogroup" aria-label="Wo">{ORTE.map((o) => <button key={o} type="button" role="radio" aria-checked={ort === o} className="fb-chip" onClick={() => setOrt(ort === o ? '' : o)}>{o}</button>)}</div>
      <div className="row-btns">
        <button type="button" className="btn primary" disabled={!zeit} onClick={() => { onSetzen(wennDann(zeit, ort, aufgabe)); setOffen(false); }}>Plan setzen</button>
        {wert ? <button type="button" className="linkbtn" onClick={() => { onSetzen(''); setOffen(false); }}>Plan entfernen</button> : null}
        <button type="button" className="linkbtn" onClick={() => setOffen(false)}>Abbrechen</button>
      </div>
    </div>
  );
}

/** Nach dem Abhaken: Hat das Kraft gegeben oder gekostet? */
export function EnergieChips({ wert, onSetzen }: { wert: number | null | undefined; onSetzen: (n: number) => void }) {
  const W: [number, string][] = [[1, 'gab Kraft'], [0, 'neutral'], [-1, 'kostete Kraft']];
  return <span className="fb-opts" role="radiogroup" aria-label="Energie">{W.map(([n, l]) => <button key={n} type="button" role="radio" aria-checked={wert === n} className="chipbtn" onClick={() => onSetzen(n)}>{l}</button>)}</span>;
}

'use client';
import { useRef, useState } from 'react';
import { Blaetter, type BlaetterSteuerung } from './blaetter';
import { BOEGEN, TAGESZEITEN, type Antwort, type Bogen, type Frage } from '@/lib/fragen';
import { api } from './ui';

/** Ein Fragebogen zum Antippen, eine Frage pro Seite. Zu jeder Frage geht zusätzlich ein eigener Satz. */
export function Fragebogen({ art, aufgaben = [], onFertig, onFehler }: { art: Bogen['art']; aufgaben?: string[]; onFertig: () => void; onFehler: (m: string) => void }) {
  const bogen = BOEGEN[art];
  const [a, setA] = useState<Record<string, Antwort>>({});
  const [offen, setOffen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const set = (id: string, v: Partial<Antwort>) => setA((x) => ({ ...x, [id]: { ...x[id], ...v } }));
  const blatt = useRef<BlaetterSteuerung>(null);
  // Bei einer Antwort aus einer Skala geht es von selbst weiter, kurz verzögert, damit die Wahl sichtbar bleibt
  const weiterNach = (k: number) => { if (k < bogen.fragen.length - 1) setTimeout(() => blatt.current?.zu(k + 1), 260); };
  const fehlt = bogen.fragen.some((f) => f.typ === 'skala' && f.pflicht && a[f.id]?.wert === undefined);

  async function senden() {
    setBusy(true);
    try { await api('/api/checkin', { method: 'POST', body: JSON.stringify({ art, antworten: a }) }); onFertig(); }
    catch (e) { onFehler((e as Error).message); }
    finally { setBusy(false); }
  }

  const feld = (f: Frage) => {
    const cur = a[f.id] ?? {};
    if (f.typ === 'skala') return (
      <div className={'fb-opts' + (f.werte.length > 5 ? ' stack' : '')} role="radiogroup" aria-label={f.frage}>
        {f.werte.map((w) => (
          <button key={w.wert} type="button" role="radio" aria-checked={cur.wert === w.wert} className="fb-chip" onClick={() => { set(f.id, { wert: w.wert }); weiterNach(bogen.fragen.indexOf(f)); }}>{w.label}</button>
        ))}
      </div>
    );
    if (f.typ === 'mehrfach') {
      const sel = cur.auswahl ?? [];
      const toggle = (o: string) => set(f.id, { auswahl: sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o] });
      return <div className="fb-opts" role="group" aria-label={f.frage}>{f.optionen.map((o) => <button key={o} type="button" aria-pressed={sel.includes(o)} className="fb-chip" onClick={() => toggle(o)}>{o}</button>)}</div>;
    }
    if (f.typ === 'plan') return (
      <div className="fb-plan">
        {aufgaben.length ? <div className="fb-opts" role="radiogroup" aria-label="Aufgabe">{aufgaben.map((t) => <button key={t} type="button" role="radio" aria-checked={cur.aufgabe === t} className="fb-chip left" onClick={() => set(f.id, { aufgabe: cur.aufgabe === t ? '' : t })}>{t}</button>)}</div> : null}
        <span className="fb-sub">Wann?</span>
        <div className="fb-opts" role="radiogroup" aria-label="Tageszeit">{TAGESZEITEN.map((z) => <button key={z} type="button" role="radio" aria-checked={cur.zeit === z} className="fb-chip" onClick={() => set(f.id, { zeit: cur.zeit === z ? '' : z })}>{z}</button>)}</div>
        {cur.aufgabe && cur.zeit ? <p className="fb-satz">Wenn es morgen {cur.zeit} ist, dann: {cur.aufgabe}.</p> : null}
      </div>
    );
    return <textarea className="fb-text" id={`${art}-${f.id}`} rows={3} placeholder={f.platzhalter} value={cur.text ?? ''} onChange={(e) => set(f.id, { text: e.target.value })} />;
  };

  const seiten = bogen.fragen.map((f) => (
    <div key={f.id} className="fb-q">
      <span className="fb-frage">{f.frage}</span>
      {feld(f)}
      {f.typ !== 'text' ? (offen[f.id] || a[f.id]?.notiz
        ? <textarea className="fb-text" id={`${art}-${f.id}-notiz`} rows={2} placeholder={f.typ === 'plan' ? 'Eigene Worte, zum Beispiel eine andere Aufgabe' : 'Eigene Worte, gern diktiert'} value={a[f.id]?.notiz ?? ''} onChange={(e) => set(f.id, { notiz: e.target.value })} autoFocus={!a[f.id]?.notiz} />
        : <button type="button" className="linkbtn fb-say" onClick={() => setOffen((o) => ({ ...o, [f.id]: true }))}>Etwas dazu sagen</button>) : null}
    </div>
  ));

  return (
    <div className="group pad fb">
      <div className="fb-head"><div className="fb-head-text"><b>{bogen.titel}</b><span>{bogen.hinweis}</span></div>
        <button type="button" className="btn primary fb-fertig" onClick={senden} disabled={busy || fehlt}>{busy ? 'Speichert …' : 'Fertig'}</button></div>
      <Blaetter ref={blatt} seiten={seiten} label={bogen.titel} />
    </div>
  );
}

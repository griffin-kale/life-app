'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '../ui';
import { Blaetter, type BlaetterSteuerung } from '../blaetter';
import type { Antwort } from '@/lib/fragen';
import { BEREICH_NAME, ETAPPEN, type Auswertung, type StandFrage, type Vorschlag } from '@/lib/standort';

const ART_NAME: Record<Vorschlag['art'], string> = { fokus: 'Fokus', werte: 'Werte', jahr: 'In einem Jahr', quartal: 'Zwölf Wochen', weglassen: 'Bewusst liegen lassen', engpass: 'Engpass', wochenziel: 'Wochenziel' };
const Mikro = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
const Stern = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor" /></svg>;

export function Etappenleiste({ nr, erledigt }: { nr: number; erledigt: number[] }) {
  return <div className="st-etappen" aria-label={`Etappe ${nr} von 3`}>{[1, 2, 3].map((n) => <span key={n} className={erledigt.includes(n) ? 'an' : n === nr ? 'jetzt' : ''} />)}</div>;
}

/** Eine Etappe: eine Frage pro Seite, Zahl antippen, frei erzählen. Am Ende wertet der Coach aus und schlägt vor. */
export function StandBogen({ nr }: { nr: 1 | 2 | 3 }) {
  const e = ETAPPEN.find((x) => x.nr === nr)!;
  const [a, setA] = useState<Record<string, Antwort>>({});
  const [aus, setAus] = useState<Auswertung | null>(null);
  const [modus, setModus] = useState<'laden' | 'fragen' | 'denkt' | 'auswertung'>('laden');
  const [status, setStatus] = useState<Record<number, 'ja' | 'nein'>>({});
  const [edit, setEdit] = useState<Record<number, string>>({});
  const [fehler, setFehler] = useState('');
  const blatt = useRef<BlaetterSteuerung>(null);
  const set = (id: string, v: Partial<Antwort>) => setA((x) => ({ ...x, [id]: { ...x[id], ...v } }));

  useEffect(() => {
    api<{ letzte: { auswertung: Auswertung | null; antworten: Record<string, Antwort> } | null }>(`/api/stand/${nr}`)
      .then((r) => { if (r.letzte) setA(r.letzte.antworten); if (r.letzte?.auswertung?.vorschlaege.length) { setAus(r.letzte.auswertung); setModus('auswertung'); } else setModus('fragen'); })
      .catch(() => setModus('fragen'));
  }, [nr]);

  const fehlt = e.fragen.filter((f) => f.typ === 'zahl' && a[f.id]?.wert === undefined);
  const erzaehlt = e.fragen.filter((f) => a[f.id]?.text || a[f.id]?.notiz || a[f.id]?.auswahl?.length).length;

  async function auswerten(neu = false) {
    setModus('denkt'); setFehler('');
    try {
      const r = await api<{ auswertung: Auswertung }>(`/api/stand/${nr}`, { method: 'POST', body: JSON.stringify(neu ? { aktion: 'neu' } : { antworten: a }) });
      setAus(r.auswertung); setStatus({}); setEdit({}); setModus('auswertung');
    } catch (x) { setFehler((x as Error).message); setModus('fragen'); }
  }
  async function annehmen(i: number, v: Vorschlag) {
    const text = (edit[i] ?? v.text).trim(); if (!text) return;
    try { await api(`/api/stand/${nr}`, { method: 'POST', body: JSON.stringify({ aktion: 'uebernehmen', vorschlag: { ...v, text } }) }); setStatus((s) => ({ ...s, [i]: 'ja' })); setEdit((x) => { const y = { ...x }; delete y[i]; return y; }); }
    catch (x) { setFehler((x as Error).message); }
  }

  const feld = (f: StandFrage) => {
    const cur = a[f.id] ?? {};
    const text = (wert: string | undefined, platzhalter: string, key: 'text' | 'notiz', label: string) => (
      <div className="st-erzaehl">
        <textarea className="st-text" rows={4} value={wert ?? ''} placeholder={platzhalter} aria-label={label} onChange={(ev) => set(f.id, { [key]: ev.target.value })} />
        <span className="st-mikro"><Mikro />Tipp aufs Mikrofon der Tastatur und erzähl einfach.</span>
      </div>
    );
    if (f.typ === 'zahl') return (<>
      <div className="st-skala" role="radiogroup" aria-label={f.frage}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <button key={n} type="button" role="radio" aria-checked={cur.wert === n} onClick={() => set(f.id, { wert: n })}>{n}</button>)}
      </div>
      <div className="st-skala-achse"><span>gar nicht</span><span>voll und ganz</span></div>
      <p className="st-nachfrage">{f.nachfrage}</p>
      {text(cur.text, f.platzhalter, 'text', f.nachfrage)}
    </>);
    if (f.typ === 'mehrfach') {
      const sel = cur.auswahl ?? [];
      const voll = f.max !== undefined && sel.length >= f.max;
      return (<>
        <div className="st-chips" role="group" aria-label={f.frage}>
          {f.optionen.map((o) => <button key={o} type="button" aria-pressed={sel.includes(o)} disabled={!sel.includes(o) && voll} onClick={() => set(f.id, { auswahl: sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o] })}>{o}</button>)}
        </div>
        {f.max ? <p className="st-hilfe">{sel.length} von {f.max} gewählt</p> : null}
        {f.nachfrage ? <><p className="st-nachfrage">{f.nachfrage}</p>{text(cur.notiz, 'Eigene Worte, gern diktiert', 'notiz', f.nachfrage)}</> : null}
      </>);
    }
    return (<>{f.hilfe ? <p className="st-hilfe">{f.hilfe}</p> : null}{text(cur.text, f.platzhalter, 'text', f.frage)}</>);
  };

  if (modus === 'laden') return <p className="loading">Lädt …</p>;
  if (modus === 'denkt') return <section className="hero st-karte" aria-live="polite"><span className="hero-kopf"><Stern />Coach</span><p className="coach-text">Der Coach hört zu und sortiert, was du erzählt hast …</p><p className="note">Das dauert etwa zwanzig Sekunden.</p></section>;

  if (modus === 'auswertung' && aus) {
    const alleDurch = aus.vorschlaege.every((_, i) => status[i]);
    return (
      <div className="st-auswertung">
        <section className="hero st-karte" aria-label="Zusammenfassung">
          <span className="hero-kopf"><Stern />Das habe ich gehört</span>
          <p className="coach-text">{aus.zusammenfassung || 'Deine Antworten sind gespeichert.'}</p>
        </section>
        {aus.vorschlaege.length ? <h2 className="glabel">Vorschläge vom Coach</h2> : <button type="button" className="btn primary" onClick={() => auswerten(true)}>Nochmal auswerten</button>}
        {aus.vorschlaege.map((v, i) => (
          <section key={i} className={'st-vorschlag' + (status[i] ? ' ' + status[i] : '')} aria-label={`Vorschlag ${ART_NAME[v.art]}`}>
            <span className="st-art">{ART_NAME[v.art]}{v.bereich ? ` · ${BEREICH_NAME[v.bereich]}` : ''}</span>
            {edit[i] !== undefined
              ? <textarea className="fb-text" rows={3} value={edit[i]} onChange={(ev) => setEdit((x) => ({ ...x, [i]: ev.target.value }))} aria-label={`${ART_NAME[v.art]} in deinen Worten`} autoFocus />
              : <p className="st-satz">{v.text}</p>}
            {v.herleitung && edit[i] === undefined ? <p className="st-herleitung">{v.herleitung}</p> : null}
            {status[i] === 'ja' ? <span className="st-ok">Übernommen</span> : status[i] === 'nein' ? <span className="st-weg">Verworfen · <button type="button" className="linkbtn" onClick={() => setStatus((s) => { const x = { ...s }; delete x[i]; return x; })}>Doch ansehen</button></span> : (
              <div className="row-btns">
                <button type="button" className="btn primary" onClick={() => annehmen(i, v)}>{edit[i] !== undefined ? 'So übernehmen' : 'Übernehmen'}</button>
                {edit[i] === undefined ? <button type="button" className="chipbtn" onClick={() => setEdit((x) => ({ ...x, [i]: v.text }))}>Anders formulieren</button> : null}
                <button type="button" className="chipbtn" onClick={() => setStatus((s) => ({ ...s, [i]: 'nein' }))}>Passt nicht</button>
              </div>
            )}
          </section>
        ))}
        {fehler ? <p className="gnote bad">{fehler}</p> : null}
        <div className="row-btns st-weiter">
          {nr < 3 ? <Link href={`/stand/${nr + 1}`} className={'btn' + (alleDurch ? ' primary' : '')}>Weiter zu Etappe {nr + 1}</Link> : null}
          <Link href="/stand" className={'btn' + (nr === 3 && alleDurch ? ' primary' : '')}>Zu deinem Stand</Link>
          <button type="button" className="linkbtn" onClick={() => setModus('fragen')}>Antworten ändern</button>
        </div>
      </div>
    );
  }

  const seiten = [
    ...e.fragen.map((f) => (
      <div key={f.id} className="hero st-karte">
        <span className="hero-kopf"><Stern />{e.titel}{f.typ === 'zahl' ? ` · ${BEREICH_NAME[f.konto]}` : ''}</span>
        <p className="st-frage">{f.frage}</p>
        {feld(f)}
      </div>
    )),
    <div key="ende" className="hero st-karte">
      <span className="hero-kopf"><Stern />Fertig erzählt</span>
      <p className="st-frage">Der Coach fasst zusammen und macht dir Vorschläge.</p>
      <p className="st-hilfe">{erzaehlt} von {e.fragen.length} Fragen mit eigenen Worten. Übernommen wird nur, was du antippst.</p>
      {fehlt.length ? <p className="st-hilfe">Noch ohne Zahl: {fehlt.map((f) => f.typ === 'zahl' ? BEREICH_NAME[f.konto] : '').join(', ')}</p> : null}
      {fehler ? <p className="st-hilfe">{fehler}</p> : null}
      <button type="button" className="btn wide st-los" disabled={fehlt.length > 0} onClick={() => auswerten()}>Auswerten lassen</button>
    </div>,
  ];
  return <Blaetter ref={blatt} seiten={seiten} label={`Etappe ${nr}`} />;
}

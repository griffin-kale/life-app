'use client';
import { useEffect, useState } from 'react';
import { api } from './ui';

const ARTEN: [string, string][] = [['fehler', 'Fehler'], ['verbesserung', 'Verbesserung'], ['idee', 'Idee']];
const BEREICHE = ['Heute', 'Woche', 'Körper', 'Training', 'Essen', 'Ruhe', 'Geld', 'Coach', 'Mitteilungen', 'Anmeldung', 'Sonstiges'];
const GEWICHT: [string, string][] = [['kaum', 'stört kaum'], ['nervt', 'nervt'], ['blockiert', 'blockiert mich']];
const STATUS: Record<string, string> = { neu: 'eingegangen', geplant: 'geplant', erledigt: 'erledigt', abgelehnt: 'nicht geplant' };

type Eintrag = { id: number; art: string; bereich: string; text: string | null; status: string; github_nr: number | null };

/** Fehler und Verbesserungen melden. Alles klickbar, eigene Worte zusätzlich. */
export function Rueckmeldung({ onToast }: { onToast: (t: string, k?: 'ok' | 'err') => void }) {
  const [art, setArt] = useState(''); const [bereich, setBereich] = useState(''); const [gewicht, setGewicht] = useState('');
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false);
  const [liste, setListe] = useState<Eintrag[]>([]); const [github, setGithub] = useState(false);
  const laden = () => api<{ liste: Eintrag[]; github: boolean }>('/api/rueckmeldung').then((r) => { setListe(r.liste); setGithub(r.github); }).catch(() => {});
  useEffect(() => { laden(); }, []);

  async function senden() {
    setBusy(true);
    try {
      const seite = document.referrer ? new URL(document.referrer).pathname : '/einstellungen';
      const r = await api<{ id: number; github: number | null }>('/api/rueckmeldung', { method: 'POST', body: JSON.stringify({ art, bereich, gewicht, text, seite }) });
      onToast(r.github ? `Danke. Als Aufgabe Nr. ${r.github} im Backlog.` : 'Danke. Die Meldung ist im Backlog.');
      setArt(''); setBereich(''); setGewicht(''); setText(''); laden();
    } catch (e) { onToast((e as Error).message, 'err'); } finally { setBusy(false); }
  }
  const chips = (werte: [string, string][], wert: string, set: (v: string) => void, label: string) => (
    <div className="fb-opts" role="radiogroup" aria-label={label}>{werte.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={wert === k} className="fb-chip" onClick={() => set(k)}>{l}</button>)}</div>
  );
  return (
    <section className="gsec" aria-label="Rückmeldung">
      <h2 className="glabel">Fehler oder Verbesserung melden</h2>
      <div className="group pad fb">
        <div className="fb-q"><span className="fb-frage">Was ist es?</span>{chips(ARTEN, art, setArt, 'Art')}</div>
        <div className="fb-q"><span className="fb-frage">Wo?</span>{chips(BEREICHE.map((b) => [b, b]), bereich, setBereich, 'Bereich')}</div>
        <div className="fb-q"><span className="fb-frage">Wie sehr?</span>{chips(GEWICHT, gewicht, setGewicht, 'Gewicht')}</div>
        <textarea className="fb-text" id="rueck-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Was ist passiert oder was wünschst du dir? Gern diktiert." aria-label="Beschreibung" />
        <button type="button" className="btn primary" disabled={busy || !art || !bereich || !gewicht} onClick={senden}>{busy ? 'Sendet …' : 'Melden'}</button>
        {liste.length ? (
          <ul className="essen-liste">{liste.slice(0, 8).map((e) => (
            <li key={e.id}><div><b>{ARTEN.find(([k]) => k === e.art)?.[1]} · {e.bereich}</b><span>{(e.text || '').slice(0, 80) || 'ohne Beschreibung'}</span></div><span className="num">{STATUS[e.status] ?? e.status}{e.github_nr ? ` · Nr. ${e.github_nr}` : ''}</span></li>
          ))}</ul>
        ) : null}
      </div>
      <p className="gnote">{github ? 'Jede Meldung wird eine Aufgabe im Entwicklungs-Backlog auf GitHub. Namen ersetzt Life dabei durch Platzhalter.' : 'Meldungen landen im Backlog von Life. Sobald der GitHub-Schlüssel auf dem Server steht, werden daraus automatisch Aufgaben im Repo.'} Schreib bitte nichts Privates hinein.</p>
    </section>
  );
}

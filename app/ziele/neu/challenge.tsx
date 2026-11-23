'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../ui';
import { LAENGEN, MAX_STANDARDS, jokerFuer, plusTage, type StandardArt } from '@/lib/hunderter-regeln';

type Std = { key?: string; name: string; art: StandardArt };
/** Vorschläge zum Antippen. Eigene Worte gehen immer. */
const IDEEN: Std[] = [
  { name: 'Fokus Arbeit', art: 'fokus' }, { name: 'Akquise', art: 'fokus' }, { name: 'Schreiben', art: 'fokus' },
  { name: 'Content', art: 'haken' }, { name: 'Training', art: 'haken' }, { name: 'Lesen', art: 'haken' },
];
const NAMEN = ['Winter-Challenge', 'Sprint bis Ostern'];

/**
 * Neue Saison im Format Challenge (0.33, MAYA): Name, Länge, Start und bis zu sechs Standards.
 * Wer schon eine Challenge hatte, bekommt deren Name und Standards vorgewählt.
 */
export function ChallengeNeu({ heute, vorher }: { heute: string; vorher: { name: string; standards: Std[] } | null }) {
  const router = useRouter();
  const [name, setName] = useState(vorher?.name ?? NAMEN[0]);
  const [eigenerName, setEigenerName] = useState('');
  const [tage, setTage] = useState<number>(100);
  const [start, setStart] = useState<'heute' | 'morgen'>('morgen');
  const [standards, setStandards] = useState<Std[]>(vorher?.standards ?? [IDEEN[0]]);
  const [eigen, setEigen] = useState('');
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState('');

  const hat = (n: string) => standards.some((s) => s.name.toLowerCase() === n.toLowerCase());
  const dazu = (s: Std) => { if (!hat(s.name) && standards.length < MAX_STANDARDS) setStandards([...standards, s]); };
  const weg = (n: string) => setStandards(standards.filter((s) => s.name !== n));
  const art = (n: string, a: StandardArt) => setStandards(standards.map((s) => (s.name === n ? { ...s, art: a } : s)));
  const namenWahl = [...new Set([...(vorher ? [vorher.name] : []), ...NAMEN])];

  async function anlegen() {
    setBusy(true); setFehler('');
    try {
      await api('/api/hunderter', { method: 'POST', body: JSON.stringify({ aktion: 'anlegen', start: start === 'heute' ? heute : plusTage(heute, 1), format: { name, tage, standards } }) });
      router.push('/ziele');
    } catch (e) { setFehler((e as Error).message); setBusy(false); }
  }

  return (
    <div className="group pad ws-seite">
      <h2 className="ws-titel">Challenge</h2>
      <p className="muted small">Jeden Tag ein paar Standards, dazu verordnet Life dir fünf kleine Aufgaben für deine Lebensbereiche. Die Hälfte jedes Standards plus alle fünf Aufgaben, dann zählt der Tag. Joker fangen schlechte Tage ab und hängen je einen Tag hinten an.</p>

      <span className="fb-frage">Wie soll sie heißen?</span>
      <div className="fb-opts" role="radiogroup" aria-label="Name">
        {namenWahl.map((n) => <button key={n} type="button" role="radio" aria-checked={name === n} className="fb-chip" onClick={() => setName(n)}>{n}</button>)}
        {!namenWahl.includes(name) ? <button type="button" role="radio" aria-checked className="fb-chip">{name}</button> : null}
      </div>
      <div className="geld-neu">
        <input value={eigenerName} onChange={(e) => setEigenerName(e.target.value)} placeholder="Etwas dazu sagen: eigener Name" aria-label="Eigener Name" maxLength={40}
          onKeyDown={(e) => { if (e.key === 'Enter' && eigenerName.trim().length >= 2) { e.preventDefault(); setName(eigenerName.trim()); setEigenerName(''); } }} />
        <button type="button" className="chipbtn" disabled={eigenerName.trim().length < 2} onClick={() => { setName(eigenerName.trim()); setEigenerName(''); }}>Nehmen</button>
      </div>

      <span className="fb-frage">Wie lange?</span>
      <div className="fb-opts" role="radiogroup" aria-label="Länge">
        {LAENGEN.map((t) => <button key={t} type="button" role="radio" aria-checked={tage === t} className="fb-chip" onClick={() => setTage(t)}>{t} Tage · {jokerFuer(t)} Joker</button>)}
      </div>

      <span className="fb-frage">Wann geht es los?</span>
      <div className="fb-opts" role="radiogroup" aria-label="Start">
        {(['heute', 'morgen'] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={start === k} className="fb-chip" onClick={() => setStart(k)}>{k === 'heute' ? 'Heute' : 'Morgen'}</button>)}
      </div>

      <span className="fb-frage">Deine Standards ({standards.length} von {MAX_STANDARDS})</span>
      <p className="muted small">Fokus zählt Fokusblöcke à 50 Minuten, zwei pro Tag sind voll. Haken setzt du selbst: halb oder voll.</p>
      <ul className="ch-std" aria-label="Standards">
        {standards.map((s) => (
          <li key={s.name}>
            <span className="grow">{s.name}</span>
            <span className="fb-opts" role="radiogroup" aria-label={`Wie zählt ${s.name}?`}>
              {(['fokus', 'haken'] as const).map((a) => <button key={a} type="button" role="radio" aria-checked={s.art === a} className="fb-chip klein" onClick={() => art(s.name, a)}>{a === 'fokus' ? 'Fokus' : 'Haken'}</button>)}
            </span>
            <button type="button" className="chipbtn" onClick={() => weg(s.name)} disabled={standards.length <= 1} aria-label={`${s.name} entfernen`}>Weg</button>
          </li>
        ))}
      </ul>
      <div className="fb-opts" role="group" aria-label="Vorschläge">
        {IDEEN.filter((i) => !hat(i.name)).map((i) => <button key={i.name} type="button" className="fb-chip" disabled={standards.length >= MAX_STANDARDS} onClick={() => dazu(i)}>+ {i.name}</button>)}
      </div>
      <div className="geld-neu">
        <input value={eigen} onChange={(e) => setEigen(e.target.value)} placeholder="Etwas dazu sagen: eigener Standard" aria-label="Eigener Standard" maxLength={24}
          onKeyDown={(e) => { if (e.key === 'Enter' && eigen.trim().length >= 2) { e.preventDefault(); dazu({ name: eigen.trim(), art: 'fokus' }); setEigen(''); } }} />
        <button type="button" className="chipbtn" disabled={eigen.trim().length < 2 || standards.length >= MAX_STANDARDS} onClick={() => { dazu({ name: eigen.trim(), art: 'fokus' }); setEigen(''); }}>Dazu</button>
      </div>

      {fehler ? <p className="gnote bad">{fehler}</p> : null}
      <button type="button" className="btn primary wide" onClick={anlegen} disabled={busy || !standards.length}>{busy ? 'Speichert …' : 'Challenge starten'}</button>
    </div>
  );
}

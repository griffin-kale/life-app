'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon, TaskRow, TimeChip, fTime, taskTitle, type Item } from './ui';
import { EnergieChips, WennChip } from './wenn';

/** The ONE Thing (Gary Keller): eine Sache, durch die alles andere leichter oder unnötig wird. Alles Weitere liegt eine Ebene tiefer. */
export function EineSache({ it, frei, leaving, onErledigt, onZeit, onSpaeter, onWenn, sortiert, onNeuSortieren }: {
  it: Item; frei: { von: string; bis: string } | null; leaving: boolean;
  onErledigt: () => void; onZeit: (v: string) => void; onSpaeter: () => void; onWenn: (w: string) => void;
  sortiert: { laeuft: boolean; am: string | null }; onNeuSortieren: () => void;
}) {
  const [menue, setMenue] = useState(false);
  useEffect(() => {
    if (!menue) return;
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenue(false); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [menue]);
  const titel = taskTitle(it);
  return (
    <section className={'eine-sache' + (leaving ? ' leaving' : '')} aria-label="Die eine Sache">
      <span className="es-kopf">Die eine Sache</span>
      <Link href={`/eintrag/${it.id}`} className="es-titel">{titel}</Link>
      {it.zeit ? <span className="es-zeit">um {it.zeit}</span>
        : frei ? <button type="button" className="es-frei" aria-label={`Im Kalender frei von ${frei.von} bis ${frei.bis}, als Uhrzeit setzen`} onClick={() => onZeit(frei.von)}>{frei.von}–{frei.bis} frei</button> : null}
      {it.wenn ? <p className="es-wenn">{it.wenn}</p> : null}
      <div className="es-knoepfe">
        <Link href={`/fokus?item=${it.id}`} className="es-dw" aria-label={`Deep Work: ${titel}`}>{Icon.play}Deep Work</Link>
        <button type="button" className="es-ok" onClick={onErledigt}>{Icon.check}Erledigt</button>
        <button type="button" className="es-mehr" aria-label="Mehr zu dieser Sache" aria-haspopup="dialog" onClick={() => setMenue(true)}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="18.5" cy="12" r="1.8" /></svg>
        </button>
      </div>
      {menue ? <>
        <button type="button" className="blatt-scrim" aria-label="Schließen" onClick={() => setMenue(false)} />
        <div className="blatt es-blatt" role="dialog" aria-modal="true" aria-label="Mehr zu dieser Sache">
          <span className="blatt-griff" aria-hidden="true" />
          <h2 className="blatt-titel">{titel}</h2>
          <div className="es-aktionen">
            <TimeChip value={it.zeit} onChange={(v) => onZeit(v)} />
            <button type="button" className="chipbtn" onClick={() => { setMenue(false); onSpaeter(); }}>Nicht heute</button>
            <WennChip aufgabe={titel} wert={it.wenn} onSetzen={onWenn} />
          </div>
          <p className="gnote flush">
            {sortiert.laeuft ? <span className="working">Claude sortiert …</span> : sortiert.am ? `Sortiert um ${fTime(sortiert.am)}` : 'Noch nicht sortiert'}
            {' · '}<button type="button" className="linkbtn" onClick={() => { setMenue(false); onNeuSortieren(); }} disabled={sortiert.laeuft}>Neu sortieren</button>
          </p>
        </div>
      </> : null}
    </section>
  );
}

/** Eine Zeile, die eine Liste aufklappt: „Danach 2“, „Heute erledigt 1“. */
export function Aufklapp({ name, zahl, children }: { name: string; zahl: number; children: React.ReactNode }) {
  const [offen, setOffen] = useState(false);
  if (!zahl) return null;
  return (
    <section className="aufklapp" aria-label={name}>
      <button type="button" className="ak-zeile" aria-expanded={offen} onClick={() => setOffen((x) => !x)}>
        <span>{name}</span><b className="num">{zahl}</b>{Icon.chevronRight}
      </button>
      {offen ? children : null}
    </section>
  );
}

/** Die anderen Aufgaben von heute. Ein Tipp holt eine davon nach vorn. */
export function Danach({ items, leaving, onToggle, onVor }: { items: Item[]; leaving: string | null; onToggle: (it: Item) => void; onVor: (it: Item) => void }) {
  return (
    <Aufklapp name="Danach" zahl={items.length}>
      <ul className="tasks group">
        {items.map((it) => (
          <TaskRow key={it.id} it={it} onToggle={() => onToggle(it)} leaving={leaving === it.id}>
            <button type="button" className="chipbtn" onClick={() => onVor(it)}>{Icon.up}Zur einen Sache</button>
          </TaskRow>
        ))}
      </ul>
    </Aufklapp>
  );
}

/** Was heute erledigt ist, mit der Frage nach der Energie. */
export function Erledigt({ items, onToggle, onEnergie }: { items: Item[]; onToggle: (it: Item) => void; onEnergie: (it: Item, n: number) => void }) {
  return (
    <Aufklapp name="Heute erledigt" zahl={items.length}>
      <ul className="tasks group">{items.map((it) => <TaskRow key={it.id} it={it} onToggle={() => onToggle(it)}><EnergieChips wert={it.energie} onSetzen={(n) => onEnergie(it, n)} /></TaskRow>)}</ul>
    </Aufklapp>
  );
}

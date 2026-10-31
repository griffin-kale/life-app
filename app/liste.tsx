'use client';
import Link from 'next/link';
import { Icon, TaskRow, isPending, taskTitle, type Item } from './ui';

/**
 * Die Liste auf Heute (0.27, Peter 31.10.2026): Jetzt mit sichtbarem Fortschritt, was gerade festgehalten wurde,
 * und aus jeder Aufgabe ein Fokusblock. Kein Punktestand: der Balken füllt sich, mehr nicht.
 */
export function Liste({ jetzt, eins, erledigtHeute, zuletzt, woche, geparkt, leaving, onToggle, onVor }: {
  jetzt: Item[]; eins: Item | null; erledigtHeute: Item[]; zuletzt: Item[]; woche: number; geparkt: number;
  leaving: string | null; onToggle: (it: Item) => void; onVor: (it: Item) => void;
}) {
  const offen = jetzt.filter((i) => i.status !== 'erledigt' && i.id !== eins?.id);
  const geschafft = erledigtHeute.filter((i) => i.stapel === 'jetzt').length;
  const gesamt = geschafft + jetzt.filter((i) => i.status !== 'erledigt').length;
  // Gerade festgehalten und noch nicht eingeordnet. Ideen, Zitate und Wissen landen bewusst in keinem Stapel und bleiben weg.
  const neu = zuletzt.filter((i) => i.status !== 'erledigt' && i.status !== 'archiv' && isPending(i)).slice(0, 5);
  return (
    <section className="gsec liste" aria-label="Liste">
      <div className="li-kopf">
        <h2 className="glabel">Liste</h2>
        <span className="li-stand">{gesamt ? `${geschafft} von ${gesamt} geschafft` : 'Heute ist nichts gesetzt'}</span>
      </div>
      {gesamt ? (
        <div className="li-balken" role="progressbar" aria-label="Jetzt geschafft" aria-valuenow={geschafft} aria-valuemax={gesamt}>
          {Array.from({ length: Math.min(gesamt, 6) }, (_, i) => <i key={i} className={i < Math.round((geschafft / gesamt) * Math.min(gesamt, 6)) ? 'an' : ''} />)}
        </div>
      ) : null}
      {offen.length ? (
        <ul className="tasks group">
          {offen.map((it) => (
            <TaskRow key={it.id} it={it} onToggle={() => onToggle(it)} leaving={leaving === it.id}>
              <Link href={`/fokus?item=${it.id}`} className="chipbtn" aria-label={`Fokus starten: ${taskTitle(it)}`}>{Icon.play}Fokus</Link>
              <button type="button" className="chipbtn" onClick={() => onVor(it)}>{Icon.up}Zur einen Sache</button>
            </TaskRow>
          ))}
        </ul>
      ) : null}
      {neu.length ? (
        <>
          <div className="li-kopf klein"><span>Gerade festgehalten</span><span className="li-stand">Claude ordnet ein …</span></div>
          <ul className="tasks group">{neu.map((it) => <TaskRow key={it.id} it={it} onToggle={() => onToggle(it)} leaving={leaving === it.id} />)}</ul>
        </>
      ) : null}
      <Link href="/woche#liste" className="li-mehr"><span>Diese Woche {woche} · Parkplatz {geparkt}</span><span>Ganze Liste{Icon.chevronRight}</span></Link>
    </section>
  );
}

'use client';
import Link from 'next/link';
import { Icon, TaskRow, isPending, taskTitle, type Item } from './ui';

/**
 * Die Liste auf Heute (0.27, Peter 31.10.2026): Jetzt mit sichtbarem Fortschritt, was gerade festgehalten wurde,
 * und aus jeder Aufgabe ein Fokusblock. Kein Punktestand: der Balken füllt sich, mehr nicht.
 */
export function Liste({ jetzt, eins, erledigtHeute, zuletzt, woche, geparkt, leaving, onToggle }: {
  jetzt: Item[]; eins: Item | null; erledigtHeute: Item[]; zuletzt: Item[]; woche: number; geparkt: number;
  leaving: string | null; onToggle: (it: Item) => void;
}) {
  const offen = jetzt.filter((i) => i.status !== 'erledigt' && i.id !== eins?.id);
  const geschafft = erledigtHeute.filter((i) => i.stapel === 'jetzt').length;
  const gesamt = geschafft + jetzt.filter((i) => i.status !== 'erledigt').length;
  // Neu heute und noch ohne Stapel: Claude ordnet ein oder hat es gerade getan
  const neu = zuletzt.filter((i) => i.status !== 'erledigt' && i.status !== 'archiv' && (!i.stapel || isPending(i))).slice(0, 5);
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
      {offen.length || eins ? (
        <ul className="tasks group">
          {[...(eins && eins.status !== 'erledigt' ? [eins] : []), ...offen].map((it) => (
            <TaskRow key={it.id} it={it} onToggle={() => onToggle(it)} leaving={leaving === it.id}>
              <Link href={`/fokus?item=${it.id}`} className="chipbtn" aria-label={`Fokus starten: ${taskTitle(it)}`}>{Icon.play}Fokus</Link>
            </TaskRow>
          ))}
        </ul>
      ) : null}
      {neu.length ? (
        <>
          <div className="li-kopf klein"><span>Gerade festgehalten</span>{neu.some(isPending) ? <span className="li-stand">Claude ordnet ein …</span> : null}</div>
          <ul className="tasks group">{neu.map((it) => <TaskRow key={it.id} it={it} onToggle={() => onToggle(it)} leaving={leaving === it.id} />)}</ul>
        </>
      ) : null}
      <Link href="/woche#liste" className="li-mehr"><span>Diese Woche {woche} · Parkplatz {geparkt}</span><span>Ganze Liste{Icon.chevronRight}</span></Link>
    </section>
  );
}

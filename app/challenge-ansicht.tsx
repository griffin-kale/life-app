'use client';
import type { HunderterHeute, HunderterUebersicht } from '@/lib/hunderter';

const datum = (t: string) => new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(t + 'T00:00:00Z'));
const zahl = (n: number) => n.toLocaleString('de-DE');

/**
 * Saison im Format Challenge (0.33, vorher die Seite „Die Hunderter“): Raster der Tage, Quoten, Zähler, Joker.
 * Steht unter Plan → Saison, solange eine Challenge läuft oder noch nicht begonnen hat.
 */
export function ChallengeAnsicht({ s, h, heute, busy, jokerTag, setJokerTag, tun }: {
  s: HunderterUebersicht; h: HunderterHeute | null; heute: string; busy: boolean;
  jokerTag: string; setJokerTag: (t: string) => void; tun: (body: Record<string, unknown>, ok: string) => void;
}) {
  const bisher = Math.max(1, s.zellen.filter((z) => z.tag <= s.heute).length);
  const fokus = h?.standards.filter((x) => x.art === 'fokus').length ?? 0;
  const content = !!h?.standards.some((x) => x.key === 'content');
  return (
    <>
      <section className="sz-saison" aria-label="Laufende Saison">
        <span className="hu-format">Challenge · {s.tage} Tage</span>
        <b className="sz-ch-name">{s.name}</b>
        <div className="sz-zeile"><span>{datum(s.start)} bis {datum(s.ende)}</span><span>{s.nr ? `Tag ${s.nr} · ${s.gezaehlt} von ${s.zellen.filter((z) => z.tag <= s.heute).length} gezählt` : heute < s.start ? 'startet bald' : 'Joker-Tag'}</span></div>
      </section>

      <section className="gsec" aria-label={`Die ${s.tage} Tage`}>
        <h2 className="glabel">{s.tage} Tage · {s.voll} voll</h2>
        <div className="group pad">
          <div className="hu-raster" role="img" aria-label={`Raster der ${s.tage} Tage, ${s.gezaehlt} gezählt`}>
            {s.zellen.map((z) => <span key={z.tag} className={'hu-zelle ' + z.zustand} title={`Tag ${z.nr}, ${datum(z.tag)}`}>{z.zustand === 'heute' || z.nr % 10 === 0 ? z.nr : ''}</span>)}
          </div>
          <div className="hu-legende small">
            <span><i className="hu-zelle voll" />voll</span><span><i className="hu-zelle zaehlt" />zählt</span>
            <span><i className="hu-zelle nicht" />zählt nicht</span><span><i className="hu-zelle heute" />heute</span>
          </div>
        </div>
      </section>

      <section className="gsec">
        <h2 className="glabel">Standards · mindestens die Hälfte geschafft</h2>
        <div className="group pad">
          {s.quoten.map((q) => {
            const p = Math.round((q.tage / bisher) * 100);
            return (
              <div key={q.name} className="hu-quote">
                <span>{q.name}</span><span className="hu-spur"><i className={p >= 80 ? 'gut' : ''} style={{ width: `${Math.min(100, p)}%` }} /></span><small className="num">{q.tage}/{bisher}</small>
              </div>
            );
          })}
        </div>
      </section>

      <section className="gsec">
        <h2 className="glabel">Zähler der Saison</h2>
        <div className="hu-zaehler">
          {fokus ? <div className="group pad"><b className="num">{zahl(s.phasen)}</b><small>von {zahl(fokus * 2 * s.tage)} Phasen</small></div> : null}
          {content ? <div className="group pad"><b className="num">{zahl(s.contentPieces)}</b><small>von {zahl(100 * s.tage)} Pieces</small></div> : null}
          <div className="group pad"><b className="num">{zahl(s.leben)}</b><small>von {zahl(5 * s.tage)} Leben</small></div>
        </div>
      </section>

      {s.bremsen.length ? (
        <section className="gsec">
          <h2 className="glabel">Was am häufigsten gebremst hat</h2>
          <div className="group pad"><p className="small">{s.bremsen.slice(0, 4).map((b) => `${b.name} (${b.n})`).join(' · ')}</p></div>
        </section>
      ) : null}

      <section className="gsec">
        <h2 className="glabel">Joker · {s.jokerFrei} von {s.jokerMax} frei</h2>
        <div className="group pad">
          {s.jokerTage.length ? (
            <ul className="hu-joker">
              {s.jokerTage.map((t) => (
                <li key={t}><span className="grow">{datum(t)}</span>
                  {t >= heute ? <button type="button" className="linkbtn" disabled={busy} onClick={() => tun({ aktion: 'joker', tag: t, setzen: false }, 'Joker zurückgenommen')}>Zurücknehmen</button> : <small className="muted">genommen</small>}
                </li>
              ))}
            </ul>
          ) : <p className="muted small">Noch kein Joker gesetzt.</p>}
          <label className="fb-frage" htmlFor="joker-tag">Joker planen, zum Beispiel Weihnachten</label>
          <div className="hu-zeile">
            <input id="joker-tag" type="date" className="fb-text" value={jokerTag} min={heute} max={s.ende} onChange={(e) => setJokerTag(e.target.value)} />
            <button type="button" className="btn" disabled={busy || !jokerTag || s.jokerFrei < 1} onClick={() => tun({ aktion: 'joker', tag: jokerTag, setzen: true }, 'Joker gesetzt')}>Joker setzen</button>
          </div>
          <p className="muted small">Für heute geht ein Joker nur bis 10 Uhr. Jeder Joker schiebt das Ende um einen Tag.</p>
        </div>
      </section>
    </>
  );
}

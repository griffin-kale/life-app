'use client';
/** Ein Ring wie bei Apple Fitness: füllt sich im Uhrzeigersinn, ab 100 % geschlossen. */
export function Ring({ wert, farbe, groesse = 64, dicke = 7, label }: { wert: number | null; farbe: string; groesse?: number; dicke?: number; label?: string }) {
  const r = (groesse - dicke) / 2; const u = 2 * Math.PI * r; const v = wert === null ? 0 : Math.min(1, wert);
  return (
    <svg width={groesse} height={groesse} viewBox={`0 0 ${groesse} ${groesse}`} role="img" aria-label={label ?? (wert === null ? 'noch keine Daten' : `${Math.round(v * 100)} Prozent`)} className="ring">
      <circle cx={groesse / 2} cy={groesse / 2} r={r} fill="none" stroke={farbe} strokeOpacity={0.18} strokeWidth={dicke} />
      {wert !== null && v > 0 ? <circle cx={groesse / 2} cy={groesse / 2} r={r} fill="none" stroke={farbe} strokeWidth={dicke} strokeLinecap="round" strokeDasharray={`${u * v} ${u}`} transform={`rotate(-90 ${groesse / 2} ${groesse / 2})`} /> : null}
    </svg>
  );
}

export const FARBE: Record<string, string> = { zeit: 'var(--k-zeit)', sozial: 'var(--k-sozial)', mental: 'var(--k-mental)', koerper: 'var(--k-koerper)', geld: 'var(--k-geld)' };
export const NAME: Record<string, string> = { zeit: 'Zeit', sozial: 'Sozial', mental: 'Mental', koerper: 'Körper', geld: 'Geld' };
export const KONTEN = ['zeit', 'sozial', 'mental', 'koerper', 'geld'] as const;

/** Weg bis zum nächsten Level: Strecke mit Punkt für den Stand und Fahne am Ziel. */
export function Weg({ anteil, level, naechstes }: { anteil: number; level: number; naechstes: number }) {
  const p = Math.round(Math.max(0, Math.min(1, anteil)) * 100);
  return (
    <div className="weg-box">
      <div className="weg" role="progressbar" aria-label={`Level ${level}`} aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${naechstes} Punkte bis Level ${level + 1}`}>
        <span className="weg-bahn" /><span className="weg-voll" style={{ width: `calc((100% - 22px) * ${p / 100})` }} /><span className="weg-ich" style={{ left: `calc((100% - 22px) * ${p / 100})` }} />
        <svg className="weg-fahne" viewBox="0 0 22 26" aria-hidden="true"><path d="M3 25V2M3 3h15l-4 5 4 5H3" fill="var(--k-geld)" stroke="var(--ink)" strokeWidth="1.8" strokeLinejoin="round" /></svg>
      </div>
      <div className="weg-text"><span>Level {level}</span><span className="num">noch {naechstes} Punkte bis Level {level + 1}</span></div>
    </div>
  );
}

const WT = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
const WT_LANG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
/** Die Woche als sieben Punkte: voll ab 80 %, halb ab 30 %, sonst leer. Keine Serie, die reißen kann. */
export function Tagespunkte({ tage, heute }: { tage: { tag: string; wert: number | null }[]; heute: string }) {
  const gut = tage.filter((t) => (t.wert ?? 0) >= 0.8).length;
  return (
    <div className="tagespunkte">
      <ol aria-label="Diese Woche Tag für Tag">
        {tage.map((t, i) => {
          const stufe = t.wert === null ? 'spaeter' : t.wert >= 0.8 ? 'voll' : t.wert >= 0.3 ? 'halb' : 'leer';
          return (
            <li key={t.tag} className={t.tag === heute ? 'heute' : ''}>
              <span className={'tp ' + stufe} role="img" aria-label={`${WT_LANG[i]}: ${t.wert === null ? 'kommt noch' : Math.round(t.wert * 100) + ' Prozent'}`} />
              <span aria-hidden="true">{WT[i]}</span>
            </li>
          );
        })}
      </ol>
      <span className="tp-zahl">{gut === 1 ? '1 guter Tag' : `${gut} gute Tage`}</span>
    </div>
  );
}

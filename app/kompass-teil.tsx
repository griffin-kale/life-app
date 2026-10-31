'use client';
import { useEffect, useState } from 'react';
import { Icon, api } from './ui';
import { FARBE, KONTEN, NAME, Ring } from './ringe';

type Teil = { name: string; ist: number; ziel: number; einheit?: string };
type Woche = { woche: string; teile: Record<string, Teil[]>; ringe: Record<string, number | null>; gefuehl: Record<string, number | null>; who5: number | null; alleZu: boolean };
type Level = { level: number; punkte: number; naechstes: number; anteil: number };
type K = { wochen: string[]; verlauf: Woche[]; jetzt: Woche; level: Record<string, Level>; gesamt: Level; meilensteine: { id: string; name: string; wie: string; konto: string; am: string | null }[]; neu: string[] };

const pz = (x: number | null) => (x === null ? '–' : `${Math.round(Math.min(1, x) * 100)} %`);
const kurz = (d: string) => new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric' }).format(new Date(d + 'T12:00:00Z'));
const datum = (d: string) => new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' }).format(new Date(d + 'T12:00:00Z'));

/** Säulen für acht Wochen, Höhe genau im Verhältnis 0 bis 100 %. */
function Verlauf({ werte, farbe, label }: { werte: (number | null)[]; farbe: string; label: string }) {
  return (
    <div className="verlauf" role="img" aria-label={`${label}: ${werte.map((w) => pz(w)).join(', ')}`}>
      {werte.map((w, i) => <span key={i} className={w === null ? 'leer' : ''} style={{ height: `${w === null ? 4 : Math.max(4, Math.min(1, w) * 100)}%`, background: w === null ? undefined : farbe, opacity: i === werte.length - 1 ? 1 : 0.55 }} />)}
    </div>
  );
}

/** Die Wochenringe aus dem Kompass. Seit 0.28 (Peter, 31.10.2026) stehen sie oben auf „Stand“, der Kompass hat keine eigene Seite mehr. */
export function KompassTeil() {
  const [k, setK] = useState<K | null>(null);
  useEffect(() => { api<K>('/api/kompass').then(setK).catch(() => {}); }, []);
  if (!k) return null;
  const j = k.jetzt;
  return (
    <>
      <section className="gsec" aria-label="Diese Woche">
        <h2 className="glabel">Diese Woche ab {datum(j.woche)}</h2>
        <div className="group pad kompass-top">
          <div className="ringreihe">
            {KONTEN.map((x) => (
              <a key={x} href={`#${x}`} className="ringzelle"><Ring wert={j.ringe[x]} farbe={FARBE[x]} label={`${NAME[x]}: ${pz(j.ringe[x])}`} /><b>{NAME[x]}</b><span className="num">{pz(j.ringe[x])}</span></a>
            ))}
          </div>
          {j.alleZu ? <p className="meilen-neu">Alle fünf Ringe zu.</p> : null}
        </div>
      </section>

      {/* Ringe statt Punkte (Peter, 29.10.2026): jedes Konto zeigt Ring und Prozent, der Rest klappt auf */}
      <section className="gsec" aria-label="Konten">
        <div className="group">
          {KONTEN.map((x) => (
            <details key={x} id={x} className="konto" aria-label={NAME[x]}>
              <summary className="konto-zeile">
                <Ring wert={j.ringe[x]} farbe={FARBE[x]} groesse={34} dicke={5} />
                <b>{NAME[x]}</b><span className="num">{pz(j.ringe[x])}</span>{Icon.chevronRight}
              </summary>
              <div className="konto-mehr">
                {j.teile[x].length ? j.teile[x].map((t) => (
                  <div key={t.name} className="geld-zeile"><span>{t.name}</span><span className="num">{Math.round(t.ist)} / {t.ziel}{t.einheit ? ` ${t.einheit}` : ''}</span></div>
                )) : <p className="muted small">Noch keine Daten.</p>}
                <Verlauf werte={k.verlauf.map((v) => v.ringe[x])} farbe={FARBE[x]} label={`${NAME[x]} über acht Wochen`} />
                <div className="verlauf-achse"><span>{kurz(k.wochen[0])}</span><span>diese Woche</span></div>
              </div>
            </details>
          ))}
          <details className="konto" aria-label="Wohlbefinden">
            <summary className="konto-zeile"><b>Wohlbefinden</b><span className="num">{k.verlauf.filter((v) => v.who5 !== null).slice(-1)[0]?.who5 ?? '–'}</span>{Icon.chevronRight}</summary>
            <div className="konto-mehr">
              <Verlauf werte={k.verlauf.map((v) => (v.who5 === null ? null : v.who5 / 100))} farbe="var(--sand)" label="WHO-5 über acht Wochen" />
              <div className="verlauf-achse"><span>{kurz(k.wochen[0])}</span><span>von 100 zuletzt</span></div>
            </div>
          </details>
        </div>
      </section>
    </>
  );
}

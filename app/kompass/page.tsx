'use client';
import { useEffect, useState } from 'react';
import { TabBar, TopBar, api } from '../ui';
import { FARBE, KONTEN, NAME, Ring, Weg } from '../ringe';

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

export default function Kompass() {
  const [k, setK] = useState<K | null>(null);
  useEffect(() => { api<K>('/api/kompass').then(setK).catch(() => {}); }, []);
  const j = k?.jetzt;
  return (
    <main className="wrap">
      <TopBar title="Kompass" />
      <header className="head"><span className="eyebrow">Woche ab {k ? datum(j!.woche) : '…'}</span><h1 className="title">Kompass<i>.</i></h1></header>

      {k ? <>
        <section className="gsec" aria-label="Diese Woche">
          <div className="group pad kompass-top">
            <div className="ringreihe">
              {KONTEN.map((x) => (
                <a key={x} href={`#${x}`} className="ringzelle"><Ring wert={j!.ringe[x]} farbe={FARBE[x]} label={`${NAME[x]}: ${pz(j!.ringe[x])}`} /><b>{NAME[x]}</b><span className="num">{pz(j!.ringe[x])}</span></a>
              ))}
            </div>
            <Weg anteil={k.gesamt.anteil} level={k.gesamt.level} naechstes={k.gesamt.naechstes} />
            {k.neu.length ? <p className="meilen-neu">Neu freigeschaltet: {k.neu.join(', ')}</p> : null}
            {j!.alleZu ? <p className="meilen-neu">Alle fünf Ringe zu. Perfekte Woche.</p> : null}
          </div>
          <p className="gnote">Ein voller Ring bringt 100 Punkte pro Woche. Tage zählen nicht einzeln, eine verpasste Einheit kostet nichts.</p>
        </section>

        {KONTEN.map((x) => (
          <section key={x} id={x} className="gsec konto-sec" aria-label={NAME[x]}>
            <h2 className="glabel">{NAME[x]} · Level {k.level[x].level}</h2>
            <div className="group pad">
              <div className="konto-kopf">
                <Ring wert={j!.ringe[x]} farbe={FARBE[x]} groesse={54} dicke={6} />
                <div className="kb-row grow">
                  <div className="kb-top"><span>{pz(j!.ringe[x])} diese Woche</span><span className="num">{k.level[x].naechstes} bis Level {k.level[x].level + 1}</span></div>
                  <div className="kb-bar"><i style={{ width: `${Math.round(k.level[x].anteil * 100)}%`, background: FARBE[x] }} /></div>
                </div>
              </div>
              {j!.teile[x].length ? j!.teile[x].map((t) => (
                <div key={t.name} className="geld-zeile"><span>{t.name}</span><span className="num">{Math.round(t.ist)} / {t.ziel}{t.einheit ? ` ${t.einheit}` : ''}</span></div>
              )) : <p className="muted small">{x === 'geld' ? 'Lege unter Geld Wochentöpfe an, dann füllt sich der Ring.' : 'Noch keine Daten.'}</p>}
              <Verlauf werte={k.verlauf.map((v) => v.ringe[x])} farbe={FARBE[x]} label={`${NAME[x]} über acht Wochen`} />
              <div className="verlauf-achse"><span>{kurz(k.wochen[0])}</span><span>diese Woche</span></div>
              {j!.gefuehl[x] !== null ? <p className="small muted">Dein Gefühl im Wochenbogen: {j!.gefuehl[x]} von 4</p> : null}
            </div>
          </section>
        ))}

        <section className="gsec" aria-label="Wohlbefinden">
          <h2 className="glabel">Wohlbefinden (WHO-5)</h2>
          <div className="group pad">
            <Verlauf werte={k.verlauf.map((v) => (v.who5 === null ? null : v.who5 / 100))} farbe="var(--sand)" label="WHO-5 über acht Wochen" />
            <div className="verlauf-achse"><span>{kurz(k.wochen[0])}</span><span>{k.verlauf.filter((v) => v.who5 !== null).slice(-1)[0]?.who5 ?? '–'} von 100 zuletzt</span></div>
            <p className="small muted">Aus dem Wochenbogen. Unter 51 lohnt ein genauerer Blick, gern mit ärztlichem Rat.</p>
          </div>
        </section>

        <section className="gsec" aria-label="Meilensteine">
          <h2 className="glabel">Meilensteine · {k.meilensteine.filter((m) => m.am).length} von {k.meilensteine.length}</h2>
          <div className="meilen">
            {k.meilensteine.map((m) => (
              <div key={m.id} className={'meilenstein' + (m.am ? ' an' : '')} style={{ ['--c' as string]: m.konto === 'alle' ? 'var(--sand)' : FARBE[m.konto] }}>
                <b>{m.name}</b><span>{m.am ? `am ${datum(m.am)}` : m.wie}</span>
              </div>
            ))}
          </div>
        </section>
      </> : <p className="muted small">Lädt …</p>}
      <TabBar />
    </main>
  );
}

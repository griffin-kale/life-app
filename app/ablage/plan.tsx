'use client';
import { useEffect, useState } from 'react';
import { api } from '../ui';
import { PinSetzen, type PinStand } from './pin';
import { ABSCHNITT, abgleich, istObj, liste, quartal, txt, type Abgleich, type Obj } from '@/lib/ablage-plan';
import { AbgleichAnsicht, DateiWahl, PRIVAT, type QuartalBlock, type Teil } from './offen';

/**
 * Kompass in der Ablage (0.31): Ziel, Kategorien, Prinzipien und rote Linien, dazu die seltenen Reflexionen
 * (Annahmen im Quartal, Jahresbewertung im Oktober), Gedanken und die Pflege des Plans.
 * Alles wird als Text gezeigt, React maskiert es. Unbekannte Felder bleiben weg.
 */
const ANNAHME: [string, string][] = [['haelt', 'Hält'], ['wackelt', 'Wackelt'], ['falsch', 'Falsch']];
const NAME: Record<string, string> = { ist: 'Ist', ziel: 'Ziel', soll: 'Soll' };
const zahl = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

export function Kompass({ plan, nach, heute, onSpeichern, onLoeschen, onFehler, onExport }: Teil & { onExport: () => void }) {
  const d = plan.daten;
  const kategorien = liste(d.kategorien).filter(istObj);
  const spalten = [...new Set(kategorien.flatMap((k) => Object.keys(k).filter((s) => /^(ist|ziel|soll)_\d{4}$/.test(s))))].sort((a, b) => a.slice(-4).localeCompare(b.slice(-4)));
  const max = Math.max(1, ...kategorien.flatMap((k) => spalten.map((s) => zahl(k[s]) ?? 0)));
  const bs = istObj(d.betriebssystem) ? d.betriebssystem : {};
  const fokus = liste(d.fokus_wahlen).filter(istObj);
  const [neu, setNeu] = useState<{ daten: Obj; unterschiede: Abgleich } | null>(null);
  const versionen = nach('version').sort((a, b) => b.am.localeCompare(a.am));

  async function uebernehmen() {
    if (!neu) return;
    await onSpeichern({ art: 'version', daten: d, am: heute });
    await onSpeichern({ art: 'plan', daten: neu.daten, haken: plan.haken }, plan.id);
    setNeu(null);
  }
  function klartext() {
    if (!window.confirm('Die Datei ist unverschlüsselt. Jeder, der sie findet, kann sie lesen. Nur herunterladen, wenn du sie gleich weiterbearbeitest und danach löschst.')) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `plan-${heute}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <div className="pl">
      <section className="gsec" aria-label="Überblick">
        <div className="group pad pl-kopf">
          <h2 className="pl-titel">{txt(d.titel)}</h2>
          {d.ziel ? <p className="pl-ziel">{txt(d.ziel)}</p> : null}
          {d.weg ? <p className="muted small">{txt(d.weg)}</p> : null}
          {d.stand ? <p className="muted small">Stand {txt(d.stand)}</p> : null}
        </div>
      </section>

      {fokus.length ? (
        <details className="disclose pl-teil" aria-label="Wahlen"><summary>Entscheidende Wahlen</summary>
          <div className="group">{fokus.map((f, i) => <div key={i} className="cell static"><span className="lbl">{txt(f.jahr)}{f.art ? ` · ${txt(f.art)}` : ''}<small>{f.alter ? `mit ${txt(f.alter)}` : ''}{f.prioritaet ? ` · ${txt(f.prioritaet)}` : ''}</small></span></div>)}</div>
        </details>
      ) : null}

      {kategorien.length ? (
        <details className="disclose pl-teil" aria-label="Kategorien"><summary>Kategorien</summary>
          <div className="pl-legende">{spalten.map((s, i) => <span key={s} className={'pl-l' + i}>{NAME[s.split('_')[0]] ?? s} {s.slice(-4)}</span>)}</div>
          <div className="group">
            {kategorien.map((k, i) => (
              <div key={i} className={'cell static pl-kat' + (/gate|tor/i.test(txt(k.typ)) ? ' gate' : '')}>
                <span className="lbl">{txt(k.nr)}. {txt(k.name)}{k.typ ? <small>{txt(k.typ)}</small> : null}</span>
                <span className="pl-balken" role="img" aria-label={spalten.map((s) => `${NAME[s.split('_')[0]] ?? s} ${s.slice(-4)}: ${zahl(k[s]) ?? '–'}`).join(', ')}>
                  {spalten.map((s, j) => <i key={s} className={'pl-l' + j} style={{ width: `${((zahl(k[s]) ?? 0) / max) * 100}%` }} />)}
                </span>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {[['Prinzipien', bs.prinzipien], ['Rote Linien', d.rote_linien]].map(([t, l]) => liste(l).length ? (
        <details key={t as string} className="disclose pl-teil" aria-label={t as string}><summary>{t as string}</summary>
          <ul className="pl-liste">{liste(l).map((x, i) => <li key={i}>{txt(x)}</li>)}</ul>
        </details>
      ) : null)}

      <Annahmen plan={plan} nach={nach} heute={heute} onSpeichern={onSpeichern} />
      <Jahresbewertung kategorien={kategorien} nach={nach} heute={heute} onSpeichern={onSpeichern} />
      <Gedanken nach={nach} onSpeichern={onSpeichern} onLoeschen={onLoeschen} />
      <PinBereich onFehler={onFehler} />

      {neu ? <AbgleichAnsicht unterschiede={neu.unterschiede} onUebernehmen={uebernehmen} onAbbrechen={() => setNeu(null)} /> : (
        <section className="gsec" aria-label="Plan pflegen">
          <h2 className="glabel">Plan pflegen</h2>
          <div className="group pad tr-form">
            <DateiWahl label="Neue Fassung einlesen" onDaten={(x) => setNeu({ daten: x, unterschiede: abgleich(d, x) })} onFehler={onFehler} />
            <p className="muted small">Life zeigt dir zuerst, was neu, geändert oder weg ist. Deine Haken und Reflexionen bleiben.</p>
          </div>
          <div className="group">
            <button type="button" className="cell tr-zeile" onClick={onExport}><span className="lbl">Verschlüsselt exportieren<small>Alles als Datei, nur mit Passphrase oder Wiederherstellungsschlüssel lesbar</small></span></button>
            <button type="button" className="cell tr-zeile" onClick={klartext}><span className="lbl">Plan als JSON herunterladen<small>Unverschlüsselt, zum Weiterbearbeiten. Danach löschen.</small></span></button>
          </div>
          {versionen.length ? (
            <details className="disclose pl-teil"><summary>Frühere Fassungen · {versionen.length}</summary>
              <div className="group">
                {versionen.map((v) => (
                  <div key={v.id} className="cell static">
                    <span className="lbl">Fassung bis {v.am}<small>{Object.keys(v.daten).map((k) => ABSCHNITT[k] ?? k).slice(0, 4).join(', ')}</small></span>
                    <button type="button" className="chipbtn" onClick={() => setNeu({ daten: v.daten, unterschiede: abgleich(d, v.daten) })}>Zurückholen</button>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </section>
      )}
    </div>
  );
}

/** Quartal: jede Annahme prüfen. Was nicht mehr hält, ist ein Anlass, den Plan zu ändern. */
function Annahmen({ plan, nach, heute, onSpeichern }: Pick<Teil, 'plan' | 'nach' | 'heute' | 'onSpeichern'>) {
  const q = quartal(heute);
  const annahmen = liste(plan.daten.annahmen).map(txt).filter(Boolean);
  const bloecke = nach('quartal');
  const b = bloecke.find((x) => x.q === q);
  const daten: QuartalBlock = b ?? { art: 'quartal', q, annahmen: {} };
  const [notiz, setNotiz] = useState(daten.notiz ?? '');
  const frueher = bloecke.filter((x) => x.q < q).sort((a, c) => c.q.localeCompare(a.q))[0];
  if (!annahmen.length) return null;
  const geprueft = annahmen.filter((a) => daten.annahmen[a]).length;
  return (
    <details className="disclose pl-teil" aria-label="Annahmen" open={geprueft < annahmen.length}>
      <summary>Annahmen prüfen · {q.replace('-', ' ')}<span className="muted small"> · {geprueft} von {annahmen.length}</span></summary>
      <div className="group pad tr-form">
        {annahmen.map((a) => (
          <div key={a} className="fb-q">
            <span className="fb-frage">{a}</span>
            <div className="fb-opts" role="radiogroup" aria-label={a}>
              {ANNAHME.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={daten.annahmen[a] === k} className="fb-chip" onClick={() => onSpeichern({ ...daten, annahmen: { ...daten.annahmen, [a]: k as 'haelt' } }, b?.id)}>{l}</button>)}
            </div>
            {frueher?.annahmen[a] ? <small className="muted">Letztes Quartal: {ANNAHME.find(([k]) => k === frueher.annahmen[a])?.[1]}</small> : null}
          </div>
        ))}
        <textarea className="fb-text" rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} onBlur={() => { if (notiz !== (daten.notiz ?? '')) onSpeichern({ ...daten, notiz: notiz.trim() || undefined }, b?.id); }}
          placeholder="Etwas dazu sagen: Was folgt daraus für den Plan?" aria-label="Notiz zu den Annahmen" maxLength={2000} {...PRIVAT} />
      </div>
    </details>
  );
}

/** Jahresbewertung im Oktober: ein Regler je Kategorie von 1 bis 10, Verlauf über die Jahre. Geht jederzeit, im Oktober steht sie offen. */
function Jahresbewertung({ kategorien, nach, heute, onSpeichern }: { kategorien: Obj[] } & Pick<Teil, 'nach' | 'heute' | 'onSpeichern'>) {
  const jahr = heute.slice(0, 4);
  const bloecke = nach('jahr');
  const b = bloecke.find((x) => x.jahr === jahr);
  const [werte, setWerte] = useState<Record<string, number>>(b?.werte ?? {});
  const [text, setText] = useState(b?.text ?? '');
  const frueher = bloecke.filter((x) => x.jahr < jahr).sort((a, c) => c.jahr.localeCompare(a.jahr));
  if (!kategorien.length) return null;
  const oktober = heute.slice(5, 7) === '10';
  return (
    <details className="disclose pl-teil" aria-label="Jahresbewertung" open={oktober && !b}>
      <summary>Jahresbewertung {jahr}{b ? <span className="muted small"> · erledigt</span> : oktober ? <span className="muted small"> · jetzt dran</span> : null}</summary>
      <div className="group pad tr-form">
        {kategorien.map((k) => {
          const key = String(k.nr ?? txt(k.name)); const w = werte[key] ?? 5; const vorher = frueher[0]?.werte[key];
          return (
            <label key={key} className="tr-regler">
              <span>{txt(k.name)}<b className="num">{w}</b>{vorher !== undefined ? <small className="muted"> · {frueher[0].jahr}: {vorher}</small> : null}</span>
              <input type="range" min={1} max={10} step={1} value={w} onChange={(e) => setWerte({ ...werte, [key]: Number(e.target.value) })} aria-label={`${txt(k.name)}: 1 bis 10`} />
            </label>
          );
        })}
        <textarea className="fb-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Etwas dazu sagen: Was war das Jahr?" aria-label="Etwas dazu sagen zum Jahr" maxLength={4000} {...PRIVAT} />
        <button type="button" className="btn primary" onClick={() => onSpeichern({ art: 'jahr', jahr, werte: Object.fromEntries(kategorien.map((k) => { const key = String(k.nr ?? txt(k.name)); return [key, werte[key] ?? 5]; })), text: text.trim() || undefined }, b?.id)}>Jahresbewertung speichern</button>
      </div>
    </details>
  );
}

/** Gedanken zum Plan: freie Notizen, verschlüsselt. */
function Gedanken({ nach, onSpeichern, onLoeschen }: Pick<Teil, 'nach' | 'onSpeichern' | 'onLoeschen'>) {
  const [titel, setTitel] = useState('');
  const [text, setText] = useState('');
  const [offen, setOffen] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState('');
  const notizen = nach('notiz').sort((a, b) => b.geaendert.localeCompare(a.geaendert));
  return (
    <details className="disclose pl-teil" aria-label="Gedanken"><summary>Gedanken · {notizen.length}</summary>
      <div className="group pad tr-form">
        <input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Titel (darf leer bleiben)" aria-label="Titel" maxLength={120} {...PRIVAT} />
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Gedanke" aria-label="Gedanke" {...PRIVAT} />
        <button type="button" className="btn primary" disabled={!text.trim()} onClick={async () => { await onSpeichern({ art: 'notiz', titel: titel.trim().slice(0, 120), text: text.slice(0, 50_000) }); setTitel(''); setText(''); }}>Verschlüsselt speichern</button>
      </div>
      {notizen.length ? (
        <div className="group">
          {notizen.map((x) => (
            <div key={x.id} className="tr-notiz">
              <button type="button" className="cell tr-notiz-kopf" aria-expanded={offen === x.id} onClick={() => { setOffen(offen === x.id ? null : x.id); setEntwurf(x.text); }}>
                <span className="lbl">{x.titel || x.text.slice(0, 60)}<small>{new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' }).format(new Date(x.geaendert))}</small></span>
              </button>
              {offen === x.id ? (
                <div className="pad tr-form">
                  <textarea value={entwurf} onChange={(e) => setEntwurf(e.target.value)} rows={8} aria-label="Gedanke bearbeiten" {...PRIVAT} />
                  <div className="tr-reihe">
                    <button type="button" className="btn primary" disabled={entwurf === x.text} onClick={() => onSpeichern({ art: 'notiz', titel: x.titel, text: entwurf.slice(0, 50_000) }, x.id)}>Speichern</button>
                    <button type="button" className="chipbtn" onClick={() => onLoeschen(x)}>Löschen</button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </details>
  );
}

/** PIN fürs iPhone festlegen oder ändern (0.31.2). Braucht eine frische Bestätigung, die das Formular selbst einholt. */
function PinBereich({ onFehler }: { onFehler: (m: string) => void }) {
  const [stand, setStand] = useState<PinStand | null>(null);
  const [offen, setOffen] = useState(false);
  const laden = () => api<PinStand>('/api/ablage/pin').then(setStand).catch(() => {});
  useEffect(() => { laden(); }, []);
  if (!stand) return null;
  if (offen) return <PinSetzen stand={stand} onFehler={onFehler} onFertig={() => { setOffen(false); laden(); }} onAbbrechen={() => setOffen(false)} />;
  return (
    <div className="group pl-teil">
      <button type="button" className="cell tr-zeile" onClick={() => setOffen(true)}>
        <span className="lbl">{stand.gesetzt ? 'PIN ändern' : 'PIN festlegen'}<small>{stand.gesperrt ? 'Gesperrt nach 5 Fehlversuchen' : 'Zum Öffnen auf dem iPhone, solange dort keine Passkeys gehen'}</small></span>
      </button>
    </div>
  );
}

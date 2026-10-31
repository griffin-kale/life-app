'use client';
import { useMemo, useState } from 'react';
import { api } from '../ui';
import {
  ABSCHNITT, abendfrage, erfuellt, gewohnheiten, istObj, liste, montagVon, tagBerlin, tageBis, txt, wochenTage, zielquote,
  type Abgleich, type Gewohnheit, type Obj,
} from '@/lib/ablage-plan';
import { Kompass } from './plan';

/**
 * Die offene Ablage als lebendes Dokument (0.31, Peter 31.10.2026): vier Reiter statt einer langen Seite.
 * Heute: tägliche Gewohnheiten und Abendfrage. Woche: Wochengewohnheiten, Wochenaufgaben, Wochenblick.
 * Weg: Meilensteine, Jahresziele, Phasen. Kompass: Ziel, Kategorien, Prinzipien, Quartal, Jahresbewertung, Gedanken, Pflege.
 * Jeder Block wird im Browser verschlüsselt. Der Plan lässt sich hier ändern und mit einer neuen JSON-Fassung abgleichen.
 */
export type Notiz = { art: 'notiz'; titel: string; text: string };
export type Aufgabe = { art: 'aufgabe'; titel: string; erledigt?: boolean; meilenstein?: boolean; datum?: string };
export type PlanBlock = { art: 'plan'; daten: Obj; haken: Record<string, boolean> };
export type Version = { art: 'version'; daten: Obj; am: string };
export type TagBlock = { art: 'tag'; datum: string; erledigt: string[]; antwort?: string; notiz?: string };
export type WochenBlock = { art: 'woche'; montag: string; erledigt: string[]; aufgaben: { id: string; titel: string; erledigt?: boolean }[]; blick?: { wert?: number; trug?: string; zaehlt?: string } };
export type QuartalBlock = { art: 'quartal'; q: string; annahmen: Record<string, 'haelt' | 'wackelt' | 'falsch'>; notiz?: string };
export type JahrBlock = { art: 'jahr'; jahr: string; werte: Record<string, number>; text?: string };
export type Inhalt = Notiz | Aufgabe | PlanBlock | Version | TagBlock | WochenBlock | QuartalBlock | JahrBlock;
export type Eintrag = Inhalt & { id: string; geaendert: string };
type Mit<T> = T & { id: string; geaendert: string };

// Kein Diktat, keine Vorschläge, keine Rechtschreibprüfung: Diese Dienste schicken Text an Dritte
export const PRIVAT = { autoComplete: 'off', autoCorrect: 'off', spellCheck: false, 'data-1p-ignore': true, 'data-lpignore': 'true' } as const;
const kurzTag = (t: string) => new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(t + 'T12:00:00Z'));
const wtag = (t: string) => new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'UTC' }).format(new Date(t + 'T12:00:00Z'));
const neueId = () => Math.random().toString(36).slice(2, 10);
const WOCHENWERT = ['Schwach', 'Mau', 'Okay', 'Gut', 'Stark'];

type Speichern = (i: Inhalt, id?: string) => Promise<void>;
type Reiter = 'heute' | 'woche' | 'weg' | 'kompass';

export function Offen({ eintraege, onSpeichern, onLoeschen, onSperren, onExport, onFehler }: {
  eintraege: Eintrag[]; onSpeichern: Speichern; onLoeschen: (e: Eintrag, frage?: boolean) => void; onSperren: () => void; onExport: () => void; onFehler: (m: string) => void;
}) {
  const [reiter, setReiter] = useState<Reiter>('heute');
  const heute = tagBerlin(); const montag = montagVon(heute);
  const nach = <A extends Inhalt['art']>(art: A) => eintraege.filter((e): e is Mit<Extract<Inhalt, { art: A }>> => e.art === art);
  const plan = nach('plan')[0];

  /** Ein Plan-Feld ändern und verschlüsselt speichern. */
  const planAendern = (f: (d: Obj) => Obj) => plan ? onSpeichern({ art: 'plan', daten: f(structuredClone(plan.daten)), haken: plan.haken }, plan.id) : Promise.resolve();

  if (!plan) return <PlanStart onSpeichern={onSpeichern} onFehler={onFehler} onSperren={onSperren} />;

  const props = { plan, eintraege, nach, heute, montag, onSpeichern, onLoeschen, planAendern, onFehler };
  return (
    <>
      <div className="tr-leiste">
        <nav className="plan-um tr-vier" aria-label="Ansicht">
          {([['heute', 'Heute'], ['woche', 'Woche'], ['weg', 'Weg'], ['kompass', 'Kompass']] as const).map(([k, l]) => <button key={k} type="button" aria-current={reiter === k ? 'page' : undefined} onClick={() => setReiter(k)}>{l}</button>)}
        </nav>
        <button type="button" className="chipbtn" onClick={onSperren}>Sperren</button>
      </div>
      {reiter === 'heute' ? <Heute {...props} zurWoche={() => setReiter('woche')} /> : null}
      {reiter === 'woche' ? <Woche {...props} /> : null}
      {reiter === 'weg' ? <Weg {...props} /> : null}
      {reiter === 'kompass' ? <Kompass {...props} onExport={onExport} /> : null}
    </>
  );
}

export type Teil = {
  plan: Mit<PlanBlock>; eintraege: Eintrag[]; heute: string; montag: string;
  nach: <A extends Inhalt['art']>(art: A) => Mit<Extract<Inhalt, { art: A }>>[];
  onSpeichern: Speichern; onLoeschen: (e: Eintrag, frage?: boolean) => void; planAendern: (f: (d: Obj) => Obj) => Promise<void>; onFehler: (m: string) => void;
};

/** Noch kein Plan: Datei einlesen oder leer anfangen. */
function PlanStart({ onSpeichern, onFehler, onSperren }: { onSpeichern: Speichern; onFehler: (m: string) => void; onSperren: () => void }) {
  return (
    <>
      <div className="tr-leiste"><span /><button type="button" className="chipbtn" onClick={onSperren}>Sperren</button></div>
      <section className="gsec" aria-label="Plan einlesen">
        <div className="group pad tr-form">
          <p className="tr-satz">Lies deine Plan-Datei ein oder fang leer an. Life liest die Datei hier im Browser und speichert sie nur verschlüsselt.</p>
          <DateiWahl label="Plan-Datei wählen" onDaten={(daten) => onSpeichern({ art: 'plan', daten, haken: {} })} onFehler={onFehler} />
          <button type="button" className="btn wide" onClick={() => onSpeichern({ art: 'plan', daten: { titel: 'Mein Plan' }, haken: {} })}>Leer anfangen</button>
        </div>
      </section>
    </>
  );
}

export function DateiWahl({ label, onDaten, onFehler }: { label: string; onDaten: (d: Obj) => void; onFehler: (m: string) => void }) {
  async function lesen(f: File | undefined, el: HTMLInputElement) {
    if (!f) return;
    try {
      if (f.size > 60_000) { onFehler('Die Datei ist zu groß.'); return; }
      const d = JSON.parse(await f.text());
      if (!istObj(d) || typeof d.titel !== 'string') { onFehler('Das ist keine Plan-Datei.'); return; }
      onDaten(d);
    } catch { onFehler('Die Datei lässt sich nicht lesen.'); }
    finally { el.value = ''; }
  }
  return <label className="btn primary wide tr-datei">{label}<input type="file" accept="application/json,.json" onChange={(e) => lesen(e.target.files?.[0], e.target)} /></label>;
}

/** Gewohnheit dem Plan hinzufügen oder entfernen. Gewohnheiten liegen in dividenden_gewohnheiten, Rhythmen im Betriebssystem. */
function gewohnheitDazu(d: Obj, text: string, rhythmus: 'täglich' | 'wöchentlich', heute: string): Obj {
  const l = liste(d.dividenden_gewohnheiten);
  return { ...d, dividenden_gewohnheiten: [...l, { ebene: rhythmus === 'täglich' ? 'Tag' : 'Woche', text, rhythmus, start: heute.slice(0, 7), kategorien: [] }] };
}
function gewohnheitWeg(d: Obj, g: Gewohnheit): Obj {
  if (g.quelle === 'gewohnheit') return { ...d, dividenden_gewohnheiten: liste(d.dividenden_gewohnheiten).filter((x) => !(istObj(x) && txt(x.text) === g.text)) };
  const bs = istObj(d.betriebssystem) ? d.betriebssystem : {};
  return { ...d, betriebssystem: { ...bs, rhythmen: liste(bs.rhythmen).filter((x) => !(istObj(x) && txt(x.name) === g.text)) } };
}

/** Eine Liste zum Abhaken mit Hinzufügen und Bearbeiten. */
function Abhaken({ titel, eintraege, erledigt, onUmschalten, onDazu, onWeg, platzhalter }: {
  titel: string; eintraege: { id: string; text: string; info?: string }[]; erledigt: string[]; onUmschalten: (id: string) => void;
  onDazu?: (text: string) => void; onWeg?: (id: string) => void; platzhalter?: string;
}) {
  const [neu, setNeu] = useState('');
  const [bearbeiten, setBearbeiten] = useState(false);
  const fertig = eintraege.filter((e) => erledigt.includes(e.id)).length;
  return (
    <section className="gsec" aria-label={titel}>
      <div className="tr-kopf"><h2 className="glabel">{titel}{eintraege.length ? ` · ${fertig} von ${eintraege.length}` : ''}</h2>{onWeg && eintraege.length ? <button type="button" className="linkbtn" onClick={() => setBearbeiten(!bearbeiten)}>{bearbeiten ? 'Fertig' : 'Bearbeiten'}</button> : null}</div>
      <div className="group">
        {eintraege.map((e) => (
          <div key={e.id} className={'cell static tr-aufgabe' + (erledigt.includes(e.id) ? ' erledigt' : '')}>
            {bearbeiten && onWeg ? <button type="button" className="chipbtn tr-weg" onClick={() => onWeg(e.id)} aria-label={`Entfernen: ${e.text}`}>Entfernen</button>
              : <input type="checkbox" className="tr-haken" checked={erledigt.includes(e.id)} aria-label={e.text} onChange={() => onUmschalten(e.id)} />}
            <span className="lbl">{e.text}{e.info ? <small>{e.info}</small> : null}</span>
          </div>
        ))}
        {onDazu ? (
          <div className="cell static tr-dazu">
            <input value={neu} onChange={(e) => setNeu(e.target.value)} placeholder={platzhalter ?? 'Hinzufügen'} aria-label={`${titel}: hinzufügen`} maxLength={200} {...PRIVAT}
              onKeyDown={(e) => { if (e.key === 'Enter' && neu.trim()) { onDazu(neu.trim()); setNeu(''); } }} />
            <button type="button" className="chipbtn" disabled={!neu.trim()} onClick={() => { onDazu(neu.trim()); setNeu(''); }}>Dazu</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Heute({ plan, nach, heute, montag, onSpeichern, onLoeschen, planAendern, zurWoche }: Teil & { zurWoche: () => void }) {
  const tage = nach('tag');
  const tag = tage.find((t) => t.datum === heute);
  const daten: TagBlock = tag ?? { art: 'tag', datum: heute, erledigt: [] };
  const gw = useMemo(() => gewohnheiten(plan.daten), [plan.daten]);
  const taeglich = gw.filter((g) => g.rhythmus === 'taeglich');
  const af = abendfrage(plan.daten);
  const quote = zielquote(plan.daten);
  const woche = wochenTage(montag);
  const erfuellteTage = woche.filter((d) => erfuellt(tage.find((t) => t.datum === d)?.antwort, af)).length;
  const [notiz, setNotiz] = useState(tag?.notiz ?? '');
  const meilenstein = nach('aufgabe').filter((a) => a.meilenstein && !a.erledigt && a.datum && a.datum >= heute).sort((a, b) => a.datum!.localeCompare(b.datum!))[0];
  const sonntag = new Date(heute + 'T12:00:00Z').getUTCDay() === 0;
  const blickFertig = !!nach('woche').find((w) => w.montag === montag)?.blick?.wert;

  const tagSpeichern = (t: TagBlock) => onSpeichern(t, tag?.id);
  async function antworten(a: string) {
    await tagSpeichern({ ...daten, antwort: daten.antwort === a ? undefined : a, notiz: notiz.trim() || undefined });
    // Neutrales Zeichen für Heute: nur das Datum, kein Inhalt
    api('/api/ablage/zeichen', { method: 'POST' }).catch(() => {});
  }

  return (
    <>
      {sonntag && !blickFertig ? <button type="button" className="ws-banner tr-banner" onClick={zurWoche}><span><b>Wochenblick</b><small>Sonntag: Woche anschauen, nächste setzen</small></span></button> : null}
      <section className="gsec" aria-label="Diese Woche">
        <div className="tr-woche" role="img" aria-label={`Diese Woche ${erfuellteTage} Tage erfüllt${quote ? `, Ziel ${quote[0]} von ${quote[1]}` : ''}`}>
          {woche.map((d) => {
            const t = tage.find((x) => x.datum === d);
            return <span key={d} className={'tr-tag' + (erfuellt(t?.antwort, af) ? ' an' : t?.antwort ? ' halb' : '') + (d === heute ? ' heute' : '')}><small>{wtag(d)}</small></span>;
          })}
          <b className="tr-quote">{erfuellteTage}{quote ? `/${quote[0]}` : ''}</b>
        </div>
      </section>

      <Abhaken titel="Heute" eintraege={taeglich.map((g) => ({ id: g.id, text: g.text, info: g.info }))} erledigt={daten.erledigt}
        onUmschalten={(id) => tagSpeichern({ ...daten, erledigt: daten.erledigt.includes(id) ? daten.erledigt.filter((x) => x !== id) : [...daten.erledigt, id] })}
        onDazu={(t) => planAendern((d) => gewohnheitDazu(d, t, 'täglich', heute))} onWeg={(id) => { const g = gw.find((x) => x.id === id); if (g) planAendern((d) => gewohnheitWeg(d, g)); }}
        platzhalter="Tägliche Gewohnheit hinzufügen" />

      <section className="gsec" aria-label="Abendfrage">
        <h2 className="glabel">Abendfrage</h2>
        <div className="group pad tr-form">
          <span className="fb-frage">{af.frage}</span>
          <div className="fb-opts" role="radiogroup" aria-label={af.frage}>
            {af.optionen.map((o) => <button key={o} type="button" role="radio" aria-checked={daten.antwort === o} className="fb-chip" onClick={() => antworten(o)}>{o}</button>)}
          </div>
          <textarea className="fb-text" rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} onBlur={() => { if ((notiz.trim() || undefined) !== daten.notiz) tagSpeichern({ ...daten, notiz: notiz.trim() || undefined }); }}
            placeholder="Etwas dazu sagen" aria-label="Etwas dazu sagen" maxLength={2000} {...PRIVAT} />
        </div>
      </section>

      {meilenstein ? (
        <section className="gsec" aria-label="Nächster Meilenstein">
          <div className="group pad tr-meilenstein"><span className="ck-name">Nächster Meilenstein</span><b>{meilenstein.titel}</b><small>{tageBis(heute, meilenstein.datum!) === 0 ? 'heute' : `in ${tageBis(heute, meilenstein.datum!)} Tagen`} · {kurzTag(meilenstein.datum!)}</small></div>
        </section>
      ) : null}
      {tag && !daten.erledigt.length && !daten.antwort && !daten.notiz ? <button type="button" className="linkbtn" onClick={() => onLoeschen(tag, false)}>Leeren Tag entfernen</button> : null}
    </>
  );
}

function Woche({ plan, nach, montag, heute, onSpeichern, planAendern }: Teil) {
  const wochen = nach('woche');
  const w = wochen.find((x) => x.montag === montag);
  const daten: WochenBlock = w ?? { art: 'woche', montag, erledigt: [], aufgaben: [] };
  const gw = useMemo(() => gewohnheiten(plan.daten), [plan.daten]);
  const woechentlich = gw.filter((g) => g.rhythmus === 'woechentlich');
  const [trug, setTrug] = useState(daten.blick?.trug ?? '');
  const [zaehlt, setZaehlt] = useState(daten.blick?.zaehlt ?? '');
  const naechster = wochenTage(montag)[6] ? (() => { const d = new Date(montag + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString().slice(0, 10); })() : montag;
  const speichern = (x: WochenBlock) => onSpeichern(x, w?.id);

  async function blickSpeichern(wert?: number) {
    await speichern({ ...daten, blick: { wert: wert ?? daten.blick?.wert, trug: trug.trim() || undefined, zaehlt: zaehlt.trim() || undefined } });
    // Was nächste Woche zählt, wird dort zu Wochenaufgaben (eine pro Zeile, höchstens drei)
    const zeilen = zaehlt.split('\n').map((z) => z.trim()).filter(Boolean).slice(0, 3);
    if (wert === undefined && zeilen.length) {
      const n = wochen.find((x) => x.montag === naechster);
      const alt = n?.aufgaben ?? [];
      const neu = zeilen.filter((z) => !alt.some((a) => a.titel === z)).map((titel) => ({ id: neueId(), titel }));
      if (neu.length) await onSpeichern({ art: 'woche', montag: naechster, erledigt: n?.erledigt ?? [], aufgaben: [...alt, ...neu], blick: n?.blick }, n?.id);
    }
  }

  return (
    <>
      <Abhaken titel="Diese Woche" eintraege={woechentlich.map((g) => ({ id: g.id, text: g.text, info: g.info }))} erledigt={daten.erledigt}
        onUmschalten={(id) => speichern({ ...daten, erledigt: daten.erledigt.includes(id) ? daten.erledigt.filter((x) => x !== id) : [...daten.erledigt, id] })}
        onDazu={(t) => planAendern((d) => gewohnheitDazu(d, t, 'wöchentlich', heute))} onWeg={(id) => { const g = gw.find((x) => x.id === id); if (g) planAendern((d) => gewohnheitWeg(d, g)); }}
        platzhalter="Wöchentliche Gewohnheit hinzufügen" />

      <Abhaken titel="Wochenaufgaben" eintraege={daten.aufgaben.map((a) => ({ id: a.id, text: a.titel }))} erledigt={daten.aufgaben.filter((a) => a.erledigt).map((a) => a.id)}
        onUmschalten={(id) => speichern({ ...daten, aufgaben: daten.aufgaben.map((a) => (a.id === id ? { ...a, erledigt: !a.erledigt } : a)) })}
        onDazu={(t) => speichern({ ...daten, aufgaben: [...daten.aufgaben, { id: neueId(), titel: t }] })}
        onWeg={(id) => speichern({ ...daten, aufgaben: daten.aufgaben.filter((a) => a.id !== id) })} platzhalter="Aufgabe für diese Woche" />

      <section className="gsec" aria-label="Wochenblick">
        <h2 className="glabel">Wochenblick</h2>
        <div className="group pad tr-form">
          <span className="fb-frage">Wie war die Woche für dein Ziel?</span>
          <div className="fb-opts" role="radiogroup" aria-label="Wie war die Woche für dein Ziel?">
            {WOCHENWERT.map((l, i) => <button key={l} type="button" role="radio" aria-checked={daten.blick?.wert === i + 1} className="fb-chip" onClick={() => blickSpeichern(i + 1)}>{l}</button>)}
          </div>
          <label className="field">Was hat getragen?<textarea className="fb-text" rows={2} value={trug} onChange={(e) => setTrug(e.target.value)} maxLength={2000} {...PRIVAT} /></label>
          <label className="field">Was zählt nächste Woche? Eine Sache pro Zeile, sie landen dort als Wochenaufgaben.<textarea className="fb-text" rows={3} value={zaehlt} onChange={(e) => setZaehlt(e.target.value)} maxLength={600} {...PRIVAT} /></label>
          <button type="button" className="btn primary" onClick={() => blickSpeichern()}>Wochenblick speichern</button>
        </div>
      </section>

      {wochen.filter((x) => x.montag < montag && x.blick?.wert).length ? (
        <section className="gsec" aria-label="Letzte Wochen">
          <h2 className="glabel">Letzte Wochen</h2>
          <div className="group">
            {wochen.filter((x) => x.montag < montag && x.blick?.wert).sort((a, b) => b.montag.localeCompare(a.montag)).slice(0, 6).map((x) => (
              <div key={x.id} className="cell static"><span className="lbl">Woche ab {kurzTag(x.montag)}<small>{x.blick?.trug ?? ''}</small></span><span className="val">{WOCHENWERT[(x.blick!.wert ?? 1) - 1]}</span></div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function Weg({ plan, nach, heute, onSpeichern, onLoeschen, planAendern }: Teil) {
  const [titel, setTitel] = useState('');
  const [datum, setDatum] = useState('');
  const [bearbeiten, setBearbeiten] = useState(false);
  const meilensteine = nach('aufgabe').filter((a) => a.meilenstein || a.datum).sort((a, b) => Number(!!a.erledigt) - Number(!!b.erledigt) || (a.datum ?? '9').localeCompare(b.datum ?? '9'));
  const jahr = Number(heute.slice(0, 4));
  const kat = liste(plan.daten.kategorien).filter(istObj);
  const katName = (nr: unknown) => txt(kat.find((k) => k.nr === nr)?.name) || String(nr);
  const jz = liste(plan.daten.jahresziele).filter(istObj);
  const zieljahr = Math.max(0, ...liste(plan.daten.fokus_wahlen).filter(istObj).map((f) => (typeof f.jahr === 'number' ? f.jahr : 0)));
  const seltener = gewohnheiten(plan.daten).filter((g) => g.rhythmus === 'seltener');
  const phasen = liste(plan.daten.phasen).filter(istObj);
  const haken = plan.haken;

  async function meilensteinDazu() {
    if (!titel.trim()) return;
    await onSpeichern({ art: 'aufgabe', titel: titel.trim().slice(0, 200), meilenstein: true, erledigt: false, datum: /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : undefined });
    setTitel(''); setDatum('');
  }
  const zielDazu = (j: string, text: string) => planAendern((d) => {
    const l = liste(d.jahresziele).filter(istObj); const i = l.findIndex((x) => txt(x.jahr) === j);
    if (i >= 0) l[i] = { ...l[i], ziele: [...liste(l[i].ziele), { text, kategorien: [] }] }; else l.push({ jahr: j, ziele: [{ text, kategorien: [] }] });
    return { ...d, jahresziele: l.sort((a, b) => txt(a.jahr).localeCompare(txt(b.jahr))) };
  });
  const zielWeg = (j: string, idx: number) => planAendern((d) => ({ ...d, jahresziele: liste(d.jahresziele).filter(istObj).map((x) => (txt(x.jahr) === j ? { ...x, ziele: liste(x.ziele).filter((_, i) => i !== idx) } : x)) }));
  const hakenKey = (j: string, z: unknown, i: number) => `${j}|${txt(z) || i}`;
  // Haken aus 0.30 hingen an der Position, ab 0.31 am Text. Beide zählen, beim nächsten Tippen gilt nur noch der Text.
  const ist = (j: string, z: unknown, i: number) => !!(haken[hakenKey(j, z, i)] || haken[`${j}|${i}`]);
  const umschalten = (j: string, z: unknown, i: number) => { const h = { ...haken, [hakenKey(j, z, i)]: !ist(j, z, i) }; delete h[`${j}|${i}`]; return onSpeichern({ ...plan, haken: h }, plan.id); };

  return (
    <>
      {zieljahr > jahr ? <p className="pl-count"><b className="num">{zieljahr - jahr}</b> Jahre bis {zieljahr}</p> : null}

      <section className="gsec" aria-label="Meilensteine">
        <h2 className="glabel">Meilensteine</h2>
        <div className="group">
          {meilensteine.map((m) => (
            <div key={m.id} className={'cell static tr-aufgabe' + (m.erledigt ? ' erledigt' : '')}>
              <input type="checkbox" className="tr-haken" checked={!!m.erledigt} aria-label={m.titel} onChange={() => onSpeichern({ art: 'aufgabe', titel: m.titel, meilenstein: true, datum: m.datum, erledigt: !m.erledigt }, m.id)} />
              <span className="lbl">{m.titel}{m.datum ? <small>{kurzTag(m.datum)}{!m.erledigt && m.datum >= heute ? ` · in ${tageBis(heute, m.datum)} Tagen` : ''}</small> : null}</span>
              <button type="button" className="chipbtn" onClick={() => onLoeschen(m)} aria-label={`Löschen: ${m.titel}`}>Löschen</button>
            </div>
          ))}
          <div className="cell static tr-dazu tr-dazu-datum">
            <input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Neuer Meilenstein" aria-label="Neuer Meilenstein" maxLength={200} {...PRIVAT} />
            <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} aria-label="Datum des Meilensteins" />
            <button type="button" className="chipbtn" disabled={!titel.trim()} onClick={meilensteinDazu}>Dazu</button>
          </div>
        </div>
      </section>

      <section className="gsec" aria-label="Jahresziele">
        <div className="tr-kopf"><h2 className="glabel">Jahresziele</h2><button type="button" className="linkbtn" onClick={() => setBearbeiten(!bearbeiten)}>{bearbeiten ? 'Fertig' : 'Bearbeiten'}</button></div>
        {[...new Set([String(jahr), String(jahr + 1), ...jz.map((j) => txt(j.jahr))])].sort().map((j) => {
          const eintrag = jz.find((x) => txt(x.jahr) === j); const ziele = liste(eintrag?.ziele);
          const fertig = ziele.filter((z, i) => ist(j, z, i)).length;
          return (
            <details key={j} className="disclose pl-teil" open={j === String(jahr) || j === String(jahr + 1)}>
              <summary>{j}<span className="muted small"> · {fertig} von {ziele.length}</span></summary>
              <div className="group">
                {ziele.map((z, i) => (
                  <div key={i} className="cell static tr-aufgabe">
                    {bearbeiten ? <button type="button" className="chipbtn tr-weg" onClick={() => zielWeg(j, i)}>Entfernen</button>
                      : <input type="checkbox" className="tr-haken" checked={ist(j, z, i)} aria-label={txt(z)} onChange={() => umschalten(j, z, i)} />}
                    <span className="lbl">{txt(z)}{istObj(z) && liste(z.kategorien).length ? <small>{liste(z.kategorien).map(katName).join(', ')}</small> : null}</span>
                  </div>
                ))}
                <ZielDazu onDazu={(t) => zielDazu(j, t)} />
              </div>
            </details>
          );
        })}
      </section>

      {phasen.length ? (
        <section className="gsec" aria-label="Phasen">
          <h2 className="glabel">Phasen</h2>
          <ol className="tr-phasen">
            {phasen.map((p, i) => {
              const jahre = (txt(p.zeitraum).match(/\d{4}/g) ?? []).map(Number);
              const jetzt = jahre.length && jahr >= Math.min(...jahre) && jahr <= Math.max(...jahre);
              return <li key={i} className={jetzt ? 'jetzt' : ''}><b>{txt(p.name)}</b><small>{txt(p.zeitraum)}{liste(p.kategorien).length ? ` · ${liste(p.kategorien).map(katName).join(', ')}` : ''}</small></li>;
            })}
          </ol>
        </section>
      ) : null}

      {seltener.length ? (
        <details className="disclose pl-teil" aria-label="Seltener"><summary>Monatlich und seltener</summary>
          <div className="group">{seltener.map((g) => <div key={g.id} className="cell static"><span className="lbl">{g.text}<small>{g.info}</small></span></div>)}</div>
        </details>
      ) : null}
    </>
  );
}

function ZielDazu({ onDazu }: { onDazu: (t: string) => void }) {
  const [t, setT] = useState('');
  return (
    <div className="cell static tr-dazu">
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Jahresziel hinzufügen" aria-label="Jahresziel hinzufügen" maxLength={200} {...PRIVAT}
        onKeyDown={(e) => { if (e.key === 'Enter' && t.trim()) { onDazu(t.trim()); setT(''); } }} />
      <button type="button" className="chipbtn" disabled={!t.trim()} onClick={() => { onDazu(t.trim()); setT(''); }}>Dazu</button>
    </div>
  );
}

/** Abgleich einer neuen JSON-Fassung: zeigen, was sich ändert, erst nach Okay übernehmen. Die alte Fassung bleibt im Verlauf. */
export function AbgleichAnsicht({ unterschiede, onUebernehmen, onAbbrechen }: { unterschiede: Abgleich; onUebernehmen: () => void; onAbbrechen: () => void }) {
  return (
    <section className="gsec" aria-label="Neue Fassung">
      <h2 className="glabel">Neue Fassung</h2>
      <div className="group pad tr-form">
        {!unterschiede.length ? <p className="muted small">Die Datei ist gleich wie dein Plan.</p> : unterschiede.map((u) => (
          <div key={u.abschnitt} className="tr-diff">
            <b>{ABSCHNITT[u.abschnitt] ?? u.abschnitt}</b>
            {u.neu.map((t, i) => <span key={'n' + i} className="tr-neu">+ {t}</span>)}
            {u.entfernt.map((t, i) => <span key={'e' + i} className="tr-alt">− {t}</span>)}
            {!u.neu.length && !u.entfernt.length ? <span className="muted small">geändert</span> : null}
          </div>
        ))}
        <p className="muted small">Deine Haken, Tage, Wochen und Reflexionen bleiben. Die bisherige Fassung liegt danach im Verlauf.</p>
        <div className="tr-reihe">
          <button type="button" className="btn primary" disabled={!unterschiede.length} onClick={onUebernehmen}>Übernehmen</button>
          <button type="button" className="chipbtn" onClick={onAbbrechen}>Abbrechen</button>
        </div>
      </div>
    </section>
  );
}

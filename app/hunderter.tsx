'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Icon, api } from './ui';
import { BREMSEN, KONTO_NAME, type LKonto } from '@/lib/hunderter-regeln';
import { BEREICH_FARBE } from '@/lib/bereiche';
import type { HunderterHeute, StandardStand } from '@/lib/hunderter';

/**
 * Challenge auf Heute, im Morgen- und im Abend-Check-in (0.32 als „Die Hunderter“, seit 0.33 Format der Saison).
 * Heute zeigt sie als „Saison heute“ (MAYA, Richtung B, Peter 23.11.2026): Standards als Kacheln, darunter die fünf Leben-Aufgaben als Haken.
 * Fokus-Standards starten einen Fokusblock mit 50 + 10, Haken-Standards zählen per Tipp halb, voll, leer.
 */
export function useHunderter(onFehler: (m: string) => void) {
  const [h, setH] = useState<HunderterHeute | null | undefined>(undefined);
  const laden = useCallback(() => api<{ heute: HunderterHeute | null }>('/api/hunderter').then((x) => setH(x.heute)).catch(() => setH(null)), []);
  useEffect(() => { laden(); }, [laden]);
  const tun = useCallback(async (body: Record<string, unknown>) => {
    try { const x = await api<{ heute: HunderterHeute | null }>('/api/hunderter', { method: 'POST', body: JSON.stringify(body) }); setH(x.heute); return true; }
    catch (e) { onFehler((e as Error).message); return false; }
  }, [onFehler]);
  return { h, laden, tun };
}

const stufe = (n: number) => (n >= 2 ? 'voll' : n === 1 ? 'halb' : 'leer');
const stufeText = (n: number) => (n >= 2 ? 'voll' : n === 1 ? 'Hälfte' : 'offen');
/** Läuft heute ein Tag der Challenge? */
export const laeuftHeute = (h: HunderterHeute | null | undefined): boolean => !!h && !h.vorbei && h.nr >= 1;

function Kopf({ h }: { h: HunderterHeute }) {
  const b = h.bewertung;
  return (
    <div className="hu-kopf">
      <div className="hu-tag"><b>Tag {h.nr}</b><span>von {h.tage}</span></div>
      <div className={'hu-wert ' + (b.zaehlt ? (b.voll ? 'voll' : 'zaehlt') : '')}>
        <b className="num">{b.prozent}<small>%</small></b>
        <span>{b.zaehlt ? (b.voll ? 'voll' : 'Tag zählt') : 'zählt noch nicht'}</span>
      </div>
      <div className="hu-balken" aria-hidden="true"><i style={{ width: `${b.prozent}%` }} /><em /></div>
    </div>
  );
}

/**
 * Eine Kachel pro Standard (0.33.1: Name und Stand untereinander, damit nichts abgeschnitten wird).
 * Fokus: Tipp startet Fokus, Plus und Minus tragen nach. Haken: Tipp zählt halb, voll, leer.
 */
function Kachel({ s, tun }: { s: StandardStand; tun: (b: Record<string, unknown>) => Promise<boolean> }) {
  const phasen = <span className="hu-phasen" aria-hidden="true"><i className={s.n >= 1 ? 'an' : ''} /><i className={s.n >= 2 ? 'an' : ''} /></span>;
  if (s.art === 'haken') return (
    <button type="button" className={'hu-kachel ' + stufe(s.n)} onClick={() => tun({ aktion: 'haken', key: s.key, n: (s.n + 1) % 3 })}
      aria-label={s.key === 'content' ? `Content: ${s.n === 0 ? 'noch nichts' : s.n === 1 ? '50 Pieces' : '100 Pieces'}. Tippen zählt hoch.` : `${s.name}: ${stufeText(s.n)}. Tippen zählt hoch.`}>
      <span className="hu-name">{s.kurz}</span>
      <span className="hu-stand">{s.key === 'content' ? `${s.n * 50} von 100` : stufeText(s.n)}</span>
      <span className="hu-fuss">{phasen}</span>
    </button>
  );
  return (
    <div className={'hu-kachel ' + stufe(s.n)}>
      <Link href={`/fokus?bereich=${s.key}`} className="hu-start" aria-label={`${s.name}: ${s.n} von 2 Phasen. Fokus starten.`}>
        <span className="hu-name">{s.kurz}</span>
        <span className="hu-stand">{s.n ? `${Math.min(s.n, 9)} von 2` : <>{Icon.play}Fokus</>}</span>
      </Link>
      <span className="hu-fuss">
        {phasen}
        <button type="button" onClick={() => tun({ aktion: 'phase', bereich: s.key, delta: -1 })} disabled={s.n < 1} aria-label={`${s.name}: eine Phase zurücknehmen`}>−</button>
        <button type="button" onClick={() => tun({ aktion: 'phase', bereich: s.key, delta: 1 })} aria-label={`${s.name}: eine Phase nachtragen`}>+</button>
      </span>
    </div>
  );
}

/** „Saison heute“ auf Heute. Ohne laufende Challenge ein leiser Einstieg, an Joker-Tagen nur ein Satz. */
export function SaisonHeute({ h, tun }: { h: HunderterHeute | null | undefined; tun: (b: Record<string, unknown>) => Promise<boolean> }) {
  if (h === undefined) return <section className="gsec hu" aria-label="Saison heute" aria-busy="true"><div className="group pad hu-karte skel-karte" /></section>;
  if (h === null) return (
    <Link href="/ziele/neu?format=challenge" className="ws-banner rt-karte" aria-label="Challenge starten">
      <span><b>Challenge starten</b><small>Ein paar Standards jeden Tag, eine kleine Aufgabe pro Lebensbereich, Joker für schlechte Tage.</small></span>
      <em className="rt-knopf">Starten</em>{Icon.chevronRight}
    </Link>
  );
  if (!laeuftHeute(h)) return (
    <Link href="/ziele" className="ws-banner rt-karte">
      <span><b>{h.name}</b><small>{h.jokerHeute ? 'Heute ist ein Joker-Tag. Morgen geht es weiter.' : h.vorbei ? `Die ${h.tage} Tage sind geschafft. Schau dir das Raster an.` : `Start am ${h.start.split('-').reverse().slice(0, 2).join('.')}.`}</small></span>
      {Icon.chevronRight}
    </Link>
  );
  const b = h.bewertung;
  const erledigt = h.leben.filter((l) => l.erledigt).length;
  return (
    <section className="gsec hu" aria-label="Saison heute">
      {/* Kopf in der Karte (0.33.2): so beginnt die Karte auf einer Höhe mit Check-in und Coach daneben */}
      <div className="group pad hu-karte">
        <div className="li-kopf hu-kopfzeile">
          <h2 className="glabel">{h.name} · Tag {h.nr} von {h.tage}</h2>
          <Link href="/ziele" className="li-stand hu-joker-link">{h.jokerFrei} Joker{Icon.chevronRight}</Link>
        </div>
        <div className={'hu-kacheln n' + Math.min(h.standards.length, 6)}>{h.standards.map((s) => <Kachel key={s.key} s={s} tun={tun} />)}</div>
        <div className="li-kopf klein"><span>Leben heute</span><span className="li-stand">{erledigt} von {h.leben.length || 5}</span></div>
        <LebenReihe h={h} tun={tun} />
        <p className={'hu-status' + (b.zaehlt ? ' gut' : '')}>{b.zaehlt ? (b.voll ? 'Alles voll. Stark.' : 'Der Tag zählt. Alles darüber ist Bonus.') : `Fürs Grün fehlt: ${b.fehlt.join(', ')}.`}</p>
      </div>
    </section>
  );
}

/** Die fünf Leben-Aufgaben als Liste zum Abhaken wie in Erinnerungen (0.33.1: nebeneinander waren sie nicht lesbar). */
function LebenReihe({ h, tun }: { h: HunderterHeute; tun: (b: Record<string, unknown>) => Promise<boolean> }) {
  if (!h.leben.length) return <p className="muted small">Die Leben-Aufgaben kommen gleich. Lade die Seite neu, falls sie fehlen.</p>;
  return (
    <ul className="hu-leben hu-abhaken" aria-label="Leben-Aufgaben">
      {h.leben.map((l) => (
        <li key={l.konto} style={{ '--c': BEREICH_FARBE[l.konto] } as React.CSSProperties}>
          <button type="button" className={'hu-haken' + (l.erledigt ? ' an' : '')} aria-pressed={l.erledigt} aria-label={`${KONTO_NAME[l.konto as LKonto]}: ${l.text}`}
            onClick={() => tun({ aktion: 'leben', konto: l.konto, erledigt: !l.erledigt })}>
            <span className="hu-kreis" aria-hidden="true">{l.erledigt ? Icon.check : null}</span>
            <span className={'hu-ltext' + (l.erledigt ? ' fertig' : '')}><small>{l.name}</small>{l.text}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function LebenListe({ h }: { h: HunderterHeute }) {
  if (!h.leben.length) return <p className="muted small">Die Leben-Aufgaben kommen gleich. Lade die Seite neu, falls sie fehlen.</p>;
  return (
    <ul className="hu-leben" aria-label="Leben-Aufgaben">
      {h.leben.map((l) => (
        <li key={l.konto} style={{ '--c': BEREICH_FARBE[l.konto] } as React.CSSProperties}>
          <span className="hu-punkt" aria-hidden="true" />
          <span className="hu-ltext"><small>{l.name}</small>{l.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Im Morgen-Check-in: was heute verordnet ist, dazu der Joker bis 10 Uhr. */
export function HunderterMorgen({ onFehler }: { onFehler: (m: string) => void }) {
  const { h, tun } = useHunderter(onFehler);
  const [sicher, setSicher] = useState(false);
  if (!h || !laeuftHeute(h)) return null;
  return (
    <section className="gsec hu" aria-label={`${h.name} heute`}>
      <h2 className="glabel">{h.name} · Tag {h.nr} · heute verordnet</h2>
      <div className="group pad">
        <LebenListe h={h} />
        <p className="muted small">Kein Tausch. Alle fünf gehören zum grünen Tag, dazu die Hälfte jedes Standards.</p>
        {h.jokerHeuteMoeglich ? (sicher
          ? <div className="hu-zeile"><span className="grow">Heute als Joker nehmen? Die Saison hängt dafür einen Tag an.</span>
              <button type="button" className="btn" onClick={() => setSicher(false)}>Nein</button>
              <button type="button" className="btn primary" onClick={() => tun({ aktion: 'joker', tag: h.heute, setzen: true })}>Joker nehmen</button></div>
          : <button type="button" className="linkbtn" onClick={() => setSicher(true)}>Joker für heute ({h.jokerFrei} frei, bis 10 Uhr)</button>) : null}
      </div>
    </section>
  );
}

/** Im Abend-Check-in: Stand des Tages, ein Satz und was gebremst hat. Alles freiwillig. */
export function HunderterAbschluss({ onFehler, onOk }: { onFehler: (m: string) => void; onOk: (m: string) => void }) {
  const { h, tun } = useHunderter(onFehler);
  const [fazit, setFazit] = useState<string | null>(null);
  const [bremsen, setBremsen] = useState<string[] | null>(null);
  if (!h || !laeuftHeute(h)) return null;
  const f = fazit ?? h.fazit; const br = bremsen ?? h.bremsen;
  const b = h.bewertung;
  return (
    <section className="gsec hu" aria-label={`${h.name}, Abend`}>
      <h2 className="glabel">{h.name} · Tag {h.nr}</h2>
      <div className="group pad">
        <Kopf h={h} />
        <p className="small">{h.standards.map((s) => (s.key === 'content' ? `Content ${s.n * 50}` : s.art === 'fokus' ? `${s.kurz} ${s.n}/2` : `${s.kurz} ${stufeText(s.n)}`)).join(' · ')} · Leben {h.leben.filter((l) => l.erledigt).length}/5</p>
        {!b.zaehlt ? <p className="muted small">Gefehlt hat: {b.fehlt.join(', ')}.</p> : null}
        <span className="fb-frage">Was hat gebremst?</span>
        <div className="fb-opts" role="group" aria-label="Was hat gebremst?">
          {BREMSEN.map((o) => <button key={o} type="button" aria-pressed={br.includes(o)} className="fb-chip" onClick={() => setBremsen(br.includes(o) ? br.filter((x) => x !== o) : [...br, o])}>{o}</button>)}
        </div>
        <textarea className="fb-text" rows={2} value={f} onChange={(e) => setFazit(e.target.value)} placeholder="Etwas dazu sagen: ein Satz zum Tag" aria-label="Ein Satz zum Tag" maxLength={300} />
        <button type="button" className="btn" onClick={async () => { if (await tun({ aktion: 'abschluss', fazit: f, bremsen: br })) onOk('Fazit gespeichert'); }}>{h.abgeschlossen ? 'Fazit ändern' : 'Fazit speichern'}</button>
      </div>
    </section>
  );
}

/** Kleiner Tagesring für den Kopf von Heute: der Tageswert der Challenge. */
export function Tagesring({ h }: { h: HunderterHeute | null | undefined }) {
  if (!h || !laeuftHeute(h)) return null;
  const p = h.bewertung.prozent; const r = 21, u = 2 * Math.PI * r;
  // Bei 0 kein Bogen, sonst zeichnet die runde Kappe einen Punkt
  const farbe = h.bewertung.zaehlt ? (h.bewertung.voll ? 'var(--sand)' : 'var(--ok)') : 'var(--k-arbeit)';
  return (
    <Link href="/ziele" className="tagesring" aria-label={`Tageswert ${p} Prozent, ${h.bewertung.zaehlt ? 'der Tag zählt' : 'zählt noch nicht'}`}>
      <svg viewBox="0 0 50 50" aria-hidden="true">
        <circle cx="25" cy="25" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        {p > 0 ? <circle cx="25" cy="25" r={r} fill="none" stroke={farbe} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(u * p) / 100} ${u}`} transform="rotate(-90 25 25)" /> : null}
      </svg>
      <b className="num">{p}</b>
    </Link>
  );
}

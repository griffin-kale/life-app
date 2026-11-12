'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Icon, api } from './ui';
import { BEREICH_KURZ, BREMSEN, KONTO_NAME, TAGE, type HBereich, type LKonto } from '@/lib/hunderter-regeln';
import type { HunderterHeute } from '@/lib/hunderter';

/**
 * Die Hunderter auf Heute, im Morgen und im Abschluss (0.32, Peter 12.11.2026, Entwurf „Mischung“):
 * Kacheln fürs Geschäft, Leben-Aufgaben als Liste. Ein Tipp auf eine Kachel startet Deep Work mit 50 + 10.
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

const KONTO_FARBE: Record<LKonto, string> = { koerper: 'var(--k-koerper)', sozial: 'var(--k-sozial)', mental: 'var(--k-mental)', geld: 'var(--k-geld)', zeit: 'var(--k-zeit)' };
const stufe = (n: number) => (n >= 2 ? 'voll' : n === 1 ? 'halb' : 'leer');

function Kopf({ h }: { h: HunderterHeute }) {
  const b = h.bewertung;
  return (
    <div className="hu-kopf">
      <div className="hu-tag"><b>Tag {h.nr}</b><span>von {TAGE}</span></div>
      <div className={'hu-wert ' + (b.zaehlt ? (b.voll ? 'voll' : 'zaehlt') : '')}>
        <b className="num">{b.prozent}<small>%</small></b>
        <span>{b.zaehlt ? (b.voll ? 'voll' : 'Tag zählt') : 'zählt noch nicht'}</span>
      </div>
      <div className="hu-balken" aria-hidden="true"><i style={{ width: `${b.prozent}%` }} /><em /></div>
    </div>
  );
}

/** Die Karte auf Heute. Ohne Hunderter ein kleiner Einstieg, an Joker-Tagen nur ein Satz. */
export function HunderterKarte({ onFehler }: { onFehler: (m: string) => void }) {
  const { h, tun } = useHunderter(onFehler);
  if (h === undefined) return null;
  if (h === null) return (
    <Link href="/hunderter" className="ws-banner rt-karte" aria-label="Die Hunderter starten">
      <span><b>Die Hunderter</b><small>100 Tage, sechs Standards, fünf Leben-Aufgaben, zehn Joker.</small></span>
      <em className="rt-knopf">Starten</em>{Icon.chevronRight}
    </Link>
  );
  if (h.vorbei || h.nr < 1) return (
    <Link href="/hunderter" className="ws-banner rt-karte">
      <span><b>Die Hunderter</b><small>{h.jokerHeute ? 'Heute ist ein Joker-Tag. Morgen geht es weiter.' : h.vorbei ? 'Die 100 Tage sind geschafft. Schau dir das Raster an.' : `Start am ${h.start.split('-').reverse().slice(0, 2).join('.')}.`}</small></span>
      {Icon.chevronRight}
    </Link>
  );
  const b = h.bewertung;
  return (
    <section className="gsec hu" aria-label="Die Hunderter">
      <h2 className="glabel">Die Hunderter</h2>
      <div className="group pad hu-karte">
        <Kopf h={h} />
        <div className="hu-kacheln">
          <button type="button" className={'hu-kachel ' + stufe(h.content)} onClick={() => tun({ aktion: 'content', n: (h.content + 1) % 3 })}
            aria-label={`Content: ${h.content === 0 ? 'noch nichts' : h.content === 1 ? '50 Pieces' : '100 Pieces'}. Tippen zählt hoch.`}>
            <span className="hu-name">Content</span>
            <b className="num">{h.content * 50}<small>/100</small></b>
          </button>
          {h.phasen.map((p) => (
            <div key={p.bereich} className={'hu-kachel ' + stufe(p.n)}>
              <Link href={`/fokus?bereich=${p.bereich}`} className="hu-start" aria-label={`${p.name}: ${p.n} von 2 Phasen. Deep Work starten.`}>
                <span className="hu-name">{BEREICH_KURZ[p.bereich as HBereich]}</span>
                {p.n ? <b className="num">{p.n}<small>/2</small></b> : <span className="hu-los">{Icon.play}Phase</span>}
              </Link>
              <span className="hu-hand">
                <button type="button" onClick={() => tun({ aktion: 'phase', bereich: p.bereich, delta: -1 })} disabled={p.n < 1} aria-label={`${p.name}: eine Phase zurücknehmen`}>−</button>
                <button type="button" onClick={() => tun({ aktion: 'phase', bereich: p.bereich, delta: 1 })} aria-label={`${p.name}: eine Phase nachtragen`}>+</button>
              </span>
            </div>
          ))}
        </div>
        <LebenListe h={h} tun={tun} />
        <p className={'hu-status' + (b.zaehlt ? ' gut' : '')}>{b.zaehlt ? (b.voll ? 'Alles voll. Stark.' : 'Der Tag zählt. Alles darüber ist Bonus.') : `Fürs Grün fehlt: ${b.fehlt.join(', ')}.`}</p>
        <Link href="/hunderter" className="hu-mehr">Raster und Joker · {h.jokerFrei} frei {Icon.chevronRight}</Link>
      </div>
    </section>
  );
}

function LebenListe({ h, tun, nurLesen }: { h: HunderterHeute; tun?: (b: Record<string, unknown>) => Promise<boolean>; nurLesen?: boolean }) {
  if (!h.leben.length) return <p className="muted small">Die Leben-Aufgaben kommen gleich. Lade die Seite neu, falls sie fehlen.</p>;
  return (
    <ul className="hu-leben" aria-label="Leben-Aufgaben">
      {h.leben.map((l) => (
        <li key={l.konto} style={{ '--c': KONTO_FARBE[l.konto] } as React.CSSProperties}>
          {nurLesen ? <span className="hu-punkt" aria-hidden="true" />
            : <button type="button" className={'hu-haken' + (l.erledigt ? ' an' : '')} aria-pressed={l.erledigt} aria-label={`${KONTO_NAME[l.konto]}: ${l.text}`} onClick={() => tun?.({ aktion: 'leben', konto: l.konto, erledigt: !l.erledigt })}>{l.erledigt ? Icon.check : null}</button>}
          <span className={'hu-ltext' + (l.erledigt && !nurLesen ? ' fertig' : '')}><small>{l.name}</small>{l.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Im Morgen: was heute verordnet ist, dazu der Joker bis 10 Uhr. */
export function HunderterMorgen({ onFehler }: { onFehler: (m: string) => void }) {
  const { h, tun } = useHunderter(onFehler);
  const [sicher, setSicher] = useState(false);
  if (!h || h.vorbei || h.nr < 1) return null;
  return (
    <section className="gsec hu" aria-label="Die Hunderter heute">
      <h2 className="glabel">Die Hunderter · Tag {h.nr} · heute verordnet</h2>
      <div className="group pad">
        <LebenListe h={h} nurLesen />
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

/** Im Abschluss: Stand des Tages, ein Satz und was gebremst hat. Alles freiwillig. */
export function HunderterAbschluss({ onFehler, onOk }: { onFehler: (m: string) => void; onOk: (m: string) => void }) {
  const { h, tun } = useHunderter(onFehler);
  const [fazit, setFazit] = useState<string | null>(null);
  const [bremsen, setBremsen] = useState<string[] | null>(null);
  if (!h || h.vorbei || h.nr < 1) return null;
  const f = fazit ?? h.fazit; const br = bremsen ?? h.bremsen;
  const b = h.bewertung;
  return (
    <section className="gsec hu" aria-label="Die Hunderter, Abschluss">
      <h2 className="glabel">Die Hunderter · Tag {h.nr}</h2>
      <div className="group pad">
        <Kopf h={h} />
        <p className="small">{h.phasen.map((p) => `${BEREICH_KURZ[p.bereich as HBereich]} ${p.n}/2`).join(' · ')} · Content {h.content * 50} · Leben {h.leben.filter((l) => l.erledigt).length}/5</p>
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

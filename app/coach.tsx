'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Bogen } from '@/lib/fragen';
import { api } from './ui';
import { useSprache } from './sprache';
import type { Empfehlung } from '@/lib/tagesregeln';

type CoachText = { text: string; geste?: string; warnungen: string[] } | null;
type CoachStand = { morgen: CoachText; abend: CoachText; warnungen: string[]; offen?: string[]; empfehlung?: Empfehlung | null; wochenstartOffen?: boolean; standortEtappe?: number | null };
type Zeile = { rolle: 'ich' | 'coach'; text: string; zeit: string; experte?: boolean };
type Stand = { erledigt: Record<Bogen['art'], boolean>; aufgaben: string[]; who5: number | null };

const stunde = () => parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).format(new Date()), 10);

/** Welches Ritual gerade dran ist: morgens bis 14 Uhr der Morgen, ab 17 Uhr der Abschluss. Die Woche läuft seit 0.27 in der Wochenrunde. */
export function useCheckins() {
  const [st, setSt] = useState<Stand | null>(null);
  const [coach, setCoach] = useState<CoachStand | null>(null);
  const [warten, setWarten] = useState(0);
  const laden = useCallback(async () => {
    const [c, k] = await Promise.all([api<Stand>('/api/checkin'), api<CoachStand>('/api/coach')]);
    setSt(c); setCoach(k);
  }, []);
  useEffect(() => { laden().catch(() => {}); }, [laden]);
  // Nach dem Absenden schreibt Claude im Hintergrund. Ein paar Mal nachsehen.
  useEffect(() => {
    if (!warten) return;
    const t = setTimeout(() => { laden().catch(() => {}); setWarten((n) => n - 1); }, 3000);
    return () => clearTimeout(t);
  }, [warten, laden]);
  const h = stunde();
  let zeige: Bogen['art'] | null = null;
  if (st) {
    if (!st.erledigt.morgen && h < 14) zeige = 'morgen';
    else if (!st.erledigt.abend && h >= 17) zeige = 'abend';
  }
  return {
    zeige, aufgaben: st?.aufgaben ?? [], coach, warten: warten > 0, who5: st?.who5 ?? null,
    fertig: () => { setSt((s) => s && zeige ? { ...s, erledigt: { ...s.erledigt, [zeige]: true } } : s); setWarten(10); },
  };
}

const VORSCHLAEGE = ['Was jetzt?', 'Ich bin müde'];

/** Gespräch mit dem Coach für heute. Liegt auf Heute, damit Blatt und Mac-Spalte denselben Stand zeigen. */
export function useCoachChat() {
  const [verlauf, setVerlauf] = useState<Zeile[]>([]);
  const [denkt, setDenkt] = useState(false);
  useEffect(() => { api<{ verlauf: Zeile[] }>('/api/coach/chat').then((r) => setVerlauf(r.verlauf)).catch(() => {}); }, []);
  async function fragen(t: string, experte = false) {
    const n = t.trim(); if (!n || denkt) return false;
    setDenkt(true);
    setVerlauf((v) => [...v, { rolle: 'ich', text: n, zeit: '', experte }]);
    try { const r = await api<{ verlauf: Zeile[] }>('/api/coach/chat', { method: 'POST', body: JSON.stringify({ text: n, experte }) }); setVerlauf(r.verlauf); }
    catch (e) { setVerlauf((v) => [...v, { rolle: 'coach', text: (e as Error).message, zeit: '' }]); }
    finally { setDenkt(false); }
    return true;
  }
  const neuLaden = useCallback(async () => { const r = await api<{ verlauf: Zeile[] }>('/api/coach/chat'); setVerlauf(r.verlauf); return r.verlauf; }, []);
  return { verlauf, denkt, fragen, neuLaden };
}

/** Was heute festgehalten wurde, als Spur im Gespräch. Kommt aus /api/heute, nicht aus dem Chat, und geht nie an Claude. */
export type Spur = { id: string; text: string; zeit: string; titel: string | null; laeuft: boolean };
type Eintrag = { art: 'zeile'; z: Zeile } | { art: 'spur'; s: Spur };

/** Alles im Coach: Warnsignale, Offenes, Satz des Tages, Geste, Gespräch mit Spuren, ein Feld für Festhalten und Fragen. */
export function CoachInhalt({ stand, chat, spuren, onSenden, fokus, kompakt, wartet, onFehler }: {
  stand: ReturnType<typeof useCheckins>; chat: ReturnType<typeof useCoachChat>; spuren: Spur[];
  onSenden: (text: string) => Promise<boolean>; fokus?: boolean; kompakt?: boolean; wartet?: boolean; onFehler: (m: string) => void;
}) {
  const c = stand.coach;
  const [alles, setAlles] = useState(!kompakt);
  const ende = useRef<HTMLDivElement>(null);
  const eintraege: Eintrag[] = [
    ...spuren.map((s): Eintrag => ({ art: 'spur', s })),
    ...chat.verlauf.map((z): Eintrag => ({ art: 'zeile', z })),
  ].sort((a, b) => ((a.art === 'zeile' ? a.z.zeit : a.s.zeit) || '99:99').localeCompare((b.art === 'zeile' ? b.z.zeit : b.s.zeit) || '99:99'));
  const zahl = eintraege.length;
  useEffect(() => { ende.current?.scrollIntoView({ block: 'nearest' }); }, [zahl, chat.denkt]);
  const sichtbar = alles ? eintraege : eintraege.slice(-4);


  const abends = stunde() >= 17 && !!c?.abend;
  // Wochenstart und Standortbestimmung stehen schon als Knopf da, nicht noch einmal als Punkt
  const offen = (c?.offen ?? []).filter((o) => !(c?.wochenstartOffen && o.startsWith('Die Wochenrunde')) && !(c?.standortEtappe && o.startsWith('Die Standortbestimmung')));
  const k = c ? (abends ? c.abend : c.morgen) : null;
  return (
    <>
      <span className="hero-kopf"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor" /></svg>Coach · {abends ? 'Abend' : 'Morgen'}</span>
      {c?.warnungen.length ? <ul className="hero-warn">{c.warnungen.map((w) => <li key={w}>{w}</li>)}</ul> : null}
      {offen.length ? <ul className="hero-offen" aria-label="Noch offen">{offen.map((o) => <li key={o}>{o}</li>)}</ul> : null}
      {k?.text ? <p className="coach-text">{k.text}</p> : stand.warten ? <p className="note working">Der Coach schreibt …</p> : null}
      {k?.geste ? <p className="coach-geste"><b>Kleine Geste</b>{k.geste}</p> : null}
      {zahl ? (
        <div className="chat" aria-live="polite">
          {!alles && zahl > sichtbar.length ? <button type="button" className="chat-mehr" onClick={() => setAlles(true)}>Ganzes Gespräch · {zahl - sichtbar.length} ältere</button> : null}
          {sichtbar.map((e, i) => e.art === 'zeile'
            ? <p key={'z' + i} className={'chat-zeile ' + e.z.rolle + (e.z.experte ? ' experte' : '')}>{e.z.experte && e.z.rolle === 'coach' ? <small className="chat-experte">Expertenmeinung</small> : null}{e.z.text}</p>
            : <Link key={e.s.id} href={`/eintrag/${e.s.id}`} className="chat-zeile fest">{e.s.text}<small>Festgehalten{e.s.titel ? ` · ${e.s.titel}` : e.s.laeuft ? ' · Claude ordnet ein …' : ''}</small></Link>)}
          {chat.denkt || wartet ? <p className="chat-zeile coach working">{chat.denkt && chat.verlauf.at(-1)?.experte ? 'Der Coach denkt gründlich nach …' : 'Der Coach denkt …'}</p> : null}
          <div ref={ende} />
        </div>
      ) : null}
      <div className="coach-eingabe">
        <div className="chat-vorschlaege">
          {c?.standortEtappe ? <Link href={`/stand/${c.standortEtappe}`} className="chat-chip">Standortbestimmung</Link> : null}
          {c?.wochenstartOffen ? <Link href="/wochenstart" className="chat-chip">Wochenrunde</Link> : null}
          {VORSCHLAEGE.map((v) => <button key={v} type="button" className="chat-chip" disabled={chat.denkt} onClick={() => chat.fragen(v)}>{v}</button>)}
        </div>
        <Eingabe onSenden={onSenden} fokus={fokus} onFehler={onFehler} onExperte={(t) => chat.fragen(t, true)} />
      </div>
    </>
  );
}

/** Ein Feld für alles (0.22, Peter 26.10.2026): Life hält jeden Text fest, Claude erkennt beim Einordnen, ob er dem Coach gilt. */
export function Eingabe({ onSenden, fokus, onFehler, onExperte }: { onSenden: (text: string) => Promise<boolean>; fokus?: boolean; onFehler: (m: string) => void; onExperte?: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  // Expertenmeinung (Peter, 31.10.2026): gilt für die nächste Nachricht, geht direkt an den Coach und an Opus
  const [experte, setExperte] = useState(false);
  const feld = useRef<HTMLTextAreaElement>(null);
  const sprache = useSprache(text, setText, onFehler);
  useEffect(() => { if (fokus) feld.current?.focus(); }, [fokus]);
  async function senden() {
    const t = text.trim(); if (!t || busy) return;
    sprache.stop(); setBusy(true);
    try {
      if (experte && onExperte) { if (await onExperte(t)) { setText(''); setExperte(false); } }
      else if (await onSenden(t)) setText('');
    } finally { setBusy(false); }
  }
  return (
    <div className="eingabe">
      <textarea ref={feld} value={text} onChange={(e) => setText(e.target.value)} placeholder="Was geht dir durch den Kopf?" aria-label="Was geht dir durch den Kopf?" maxLength={4000}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); senden(); } }} />
      <div className="eingabe-unten">
        {sprache.geht ? <button type="button" className={'coach-mic' + (sprache.hoert ? ' an' : '')} onClick={sprache.umschalten} aria-pressed={sprache.hoert} aria-label={sprache.hoert ? 'Aufnahme beenden' : 'Sprechen'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{sprache.hoert ? <rect x="7" y="7" width="10" height="10" rx="2" /> : <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>}</svg>
        </button> : null}
        {onExperte ? <button type="button" className={'eingabe-experte' + (experte ? ' an' : '')} aria-pressed={experte} onClick={() => setExperte((x) => !x)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="currentColor" /></svg>Expertenmeinung
        </button> : null}
        <span className="eingabe-hinweis" aria-live="polite">{sprache.hoert ? <><span className="rec" />Ich höre zu</> : busy ? 'Speichert …' : experte ? 'Opus antwortet gründlich' : ''}</span>
        <button type="button" className="eingabe-senden" aria-label="Senden" disabled={!text.trim() || busy} onClick={senden}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
        </button>
      </div>
    </div>
  );
}

/** Die Leiste wächst zum Feld (Variante K1). Darüber steht nur der letzte Satz vom Coach, das ganze Gespräch öffnet „Gespräch“. */
export function CoachFeld({ stand, onSenden, wartet, onGespraech, onZu, onFehler }: { stand: ReturnType<typeof useCheckins>; onSenden: (text: string) => Promise<boolean>; wartet?: boolean; onGespraech: () => void; onZu: () => void; onFehler: (m: string) => void }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onZu(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onZu]);
  const c = stand.coach;
  const k = c ? (stunde() >= 17 && c.abend ? c.abend : c.morgen) : null;
  return <>
    <button type="button" className="blatt-scrim feld-scrim" aria-label="Schließen" onClick={onZu} />
    <div className="coach-feld" role="dialog" aria-modal="true" aria-label="Was geht dir durch den Kopf?">
      {k?.text ? <button type="button" className="cf-satz" onClick={onGespraech}><b>Coach</b>{k.text}</button> : null}
      <div className="cf-karte hero">
        <Eingabe onSenden={onSenden} fokus onFehler={onFehler} />
        <div className="cf-fuss">{wartet ? <span className="working">Claude ordnet ein …</span> : <span />}<button type="button" className="cf-gespraech" onClick={onGespraech}>Gespräch öffnen</button></div>
      </div>
    </div>
  </>;
}

/** Leiste über der Tab-Leiste: ein Tippen öffnet den Coach mit dem Feld. Der Punkt zeigt, dass der Coach etwas hat. */
export function CoachLeiste({ stand, onOeffnen }: { stand: ReturnType<typeof useCheckins>; onOeffnen: () => void }) {
  const c = stand.coach;
  const hat = !!(c && (c.warnungen.length || c.offen?.length));
  return (
    <button type="button" className="coach-leiste" aria-haspopup="dialog" onClick={onOeffnen}>
      {hat ? <span className="cl-punkt" aria-label="Der Coach hat etwas für dich" role="img" /> : null}
      <span className="cl-text">Was geht dir durch den Kopf?</span>
      <span className="cl-stern" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor" /></svg></span>
    </button>
  );
}

/** Der Coach als Blatt von unten (iPhone, iPad hochkant). Escape und Tippen daneben schließen. */
export function CoachBlatt({ onZu, children }: { onZu: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onZu(); };
    window.addEventListener('keydown', f);
    const alt = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', f); document.body.style.overflow = alt; };
  }, [onZu]);
  return <>
    <button type="button" className="blatt-scrim" aria-label="Schließen" onClick={onZu} />
    <div className="coach-blatt hero coach" role="dialog" aria-modal="true" aria-label="Coach">
      <div className="cb-kopf"><span className="blatt-griff" aria-hidden="true" /><button type="button" className="cb-zu" aria-label="Coach schließen" onClick={onZu}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button></div>
      {children}
    </div>
  </>;
}

/** Eine Sache, die jetzt passt. Life entscheidet nach festen Regeln, ein Tipp bringt dich hin. */
export function Empfohlen({ stand }: { stand: ReturnType<typeof useCheckins> }) {
  const e = stand.coach?.empfehlung; if (!e) return null;
  return (
    <section aria-label="Empfohlen für dich">
      <Link href={e.href} className="empfohlen" style={{ '--c': e.farbe } as React.CSSProperties}>
        <span className="em-text"><span className="em-kopf">Empfohlen für dich</span><b>{e.titel}</b><span className="em-grund">{e.grund}</span></span>
        <span className="em-los" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" fill="currentColor" /></svg></span>
      </Link>
    </section>
  );
}

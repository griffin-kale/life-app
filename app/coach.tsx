'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Bogen } from '@/lib/fragen';
import { api } from './ui';
import type { Empfehlung } from '@/lib/tagesregeln';

type CoachText = { text: string; geste?: string; warnungen: string[] } | null;
type CoachStand = { morgen: CoachText; abend: CoachText; warnungen: string[]; offen?: string[]; empfehlung?: Empfehlung | null; wochenstartOffen?: boolean; standortEtappe?: number | null };
type Zeile = { rolle: 'ich' | 'coach'; text: string; zeit: string };
type Stand = { erledigt: Record<Bogen['art'], boolean>; aufgaben: string[]; who5: number | null };

const stunde = () => parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).format(new Date()), 10);
const wochentag = () => new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', weekday: 'short' }).format(new Date());

/** Welcher Bogen gerade dran ist: morgens bis 14 Uhr der Morgen, ab 17 Uhr der Abend, Freitag bis Montag die Woche. */
export function useCheckins(mitWoche = false) {
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
  const wt = wochentag();
  let zeige: Bogen['art'] | null = null;
  if (st) {
    if (!st.erledigt.morgen && h < 14) zeige = 'morgen';
    else if (!st.erledigt.abend && h >= 17) zeige = 'abend';
    else if (!st.erledigt.woche && (mitWoche || ['Fri', 'Sat', 'Sun', 'Mon'].includes(wt))) zeige = 'woche';
  }
  // Auf „Woche“ zählt nur der Wochenbogen
  if (mitWoche && zeige !== 'woche') zeige = st && !st.erledigt.woche ? 'woche' : null;
  return {
    zeige, aufgaben: st?.aufgaben ?? [], coach, warten: warten > 0, who5: st?.who5 ?? null,
    fertig: () => { setSt((s) => s && zeige ? { ...s, erledigt: { ...s.erledigt, [zeige]: true } } : s); setWarten(10); },
  };
}

const VORSCHLAEGE = ['Was jetzt?', 'Ich bin müde', 'Ich habe nur 30 Minuten', 'Ich schiebe etwas vor mir her'];

/** Der Coach auf „Heute“: Warnsignale und Offenes zuerst, dann der Satz des Tages, die Geste und das Gespräch. */
export function Coach({ stand }: { stand: ReturnType<typeof useCheckins> }) {
  const c = stand.coach;
  const [verlauf, setVerlauf] = useState<Zeile[]>([]);
  const [text, setText] = useState('');
  const [denkt, setDenkt] = useState(false);
  const ende = useRef<HTMLDivElement>(null);
  useEffect(() => { api<{ verlauf: Zeile[] }>('/api/coach/chat').then((r) => setVerlauf(r.verlauf)).catch(() => {}); }, []);
  async function fragen(t: string) {
    const n = t.trim(); if (!n || denkt) return;
    setText(''); setDenkt(true);
    setVerlauf((v) => [...v, { rolle: 'ich', text: n, zeit: '' }]);
    try { const r = await api<{ verlauf: Zeile[] }>('/api/coach/chat', { method: 'POST', body: JSON.stringify({ text: n }) }); setVerlauf(r.verlauf); }
    catch (e) { setVerlauf((v) => [...v, { rolle: 'coach', text: (e as Error).message, zeit: '' }]); }
    finally { setDenkt(false); setTimeout(() => ende.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50); }
  }
  if (!c) return null;
  const abends = stunde() >= 17 && !!c.abend;
  const k = abends ? c.abend : c.morgen;
  return (
    <section className="hero coach" aria-label="Coach">
      <span className="hero-kopf"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor" /></svg>Coach · {abends ? 'Abend' : 'Morgen'}</span>
      {c.warnungen.length ? <ul className="hero-warn">{c.warnungen.map((w) => <li key={w}>{w}</li>)}</ul> : null}
      {c.offen?.length ? <ul className="hero-offen" aria-label="Noch offen">{c.offen.map((o) => <li key={o}>{o}</li>)}</ul> : null}
      {k?.text ? <p className="coach-text">{k.text}</p> : stand.warten ? <p className="note working">Der Coach schreibt …</p> : !verlauf.length ? <p className="coach-text">Frag mich, was jetzt dran ist.</p> : null}
      {k?.geste ? <p className="coach-geste"><b>Kleine Geste</b>{k.geste}</p> : null}
      {verlauf.length ? (
        <div className="chat" aria-live="polite">
          {verlauf.map((z, i) => <p key={i} className={'chat-zeile ' + z.rolle}>{z.text}</p>)}
          {denkt ? <p className="chat-zeile coach working">Der Coach denkt …</p> : null}
          <div ref={ende} />
        </div>
      ) : null}
      <div className="chat-vorschlaege">
        {c.standortEtappe ? <Link href={`/stand/${c.standortEtappe}`} className="chat-chip">Standortbestimmung</Link> : null}
        {c.wochenstartOffen ? <Link href="/wochenstart" className="chat-chip">Wochenstart</Link> : null}
        {VORSCHLAEGE.map((v) => <button key={v} type="button" className="chat-chip" disabled={denkt} onClick={() => fragen(v)}>{v}</button>)}
      </div>
      <form className="chat-feld" onSubmit={(e) => { e.preventDefault(); fragen(text); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Schreib dem Coach" aria-label="Nachricht an den Coach" enterKeyHint="send" maxLength={1000} />
        <button type="submit" className="chat-senden" aria-label="Senden" disabled={!text.trim() || denkt}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg></button>
      </form>
    </section>
  );
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

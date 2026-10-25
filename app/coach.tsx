'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Bogen } from '@/lib/fragen';
import { api } from './ui';

type CoachText = { text: string; geste?: string; warnungen: string[] } | null;
type Stand = { erledigt: Record<Bogen['art'], boolean>; aufgaben: string[]; who5: number | null };

const stunde = () => parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).format(new Date()), 10);
const wochentag = () => new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', weekday: 'short' }).format(new Date());

/** Welcher Bogen gerade dran ist: morgens bis 14 Uhr der Morgen, ab 17 Uhr der Abend, Freitag bis Montag die Woche. */
export function useCheckins(mitWoche = false) {
  const [st, setSt] = useState<Stand | null>(null);
  const [coach, setCoach] = useState<{ morgen: CoachText; abend: CoachText; warnungen: string[] } | null>(null);
  const [warten, setWarten] = useState(0);
  const laden = useCallback(async () => {
    const [c, k] = await Promise.all([api<Stand>('/api/checkin'), api<{ morgen: CoachText; abend: CoachText; warnungen: string[] }>('/api/coach')]);
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

/** Der Coach auf „Heute“: Warnsignale zuerst, dann der Satz des Tages und eine kleine Geste. */
export function Coach({ stand }: { stand: ReturnType<typeof useCheckins> }) {
  const c = stand.coach; if (!c) return null;
  const k = (stunde() >= 17 && c.abend) ? c.abend : c.morgen;
  if (!k && !c.warnungen.length && !stand.warten) return null;
  const abends = stunde() >= 17 && !!c.abend;
  return (
    <section className="hero coach" aria-label="Coach">
      <span className="hero-kopf"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor" /></svg>Coach · {abends ? 'Abend' : 'Morgen'}</span>
      {c.warnungen.length ? <ul className="hero-warn">{c.warnungen.map((w) => <li key={w}>{w}</li>)}</ul> : null}
      {k?.text ? <p className="coach-text">{k.text}</p> : stand.warten ? <p className="note working">Der Coach schreibt …</p> : null}
      {k?.geste ? <p className="coach-geste"><b>Kleine Geste</b>{k.geste}</p> : null}
    </section>
  );
}

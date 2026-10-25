'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { TopBar, api, useToast } from '../../ui';

type Geplant = { uebung: string; name: string; muskel: string; saetze: number; zielWdh: number; sekunden: boolean; hinweis: string; pause: number };
type Einheit = { woche: number; rir: string; uebungen: Geplant[] };

const MUSKEL: Record<string, string> = { beine: 'Beine', huefte: 'Hüfte und Beinrückseite', druecken: 'Brust und Drücken', ziehen: 'Rücken', schulter: 'Schultern', arme: 'Arme', rumpf: 'Rumpf' };
const PUMP = ['wenig', 'mittel', 'stark']; const KATER: [string, string][] = [['keiner', 'kein Muskelkater'], ['weg', 'war da, ist weg'], ['noch da', 'noch da']];

export default function Training() {
  const [e, setE] = useState<Einheit | null>(null);
  const [saetze, setSaetze] = useState<Record<string, (number | null)[]>>({});
  const [wert, setWert] = useState<Record<string, number>>({});
  const [pause, setPause] = useState<{ bis: number; dauer: number } | null>(null);
  const [jetzt, setJetzt] = useState(Date.now());
  const [phase, setPhase] = useState<'laeuft' | 'feedback' | 'fertig'>('laeuft');
  const [fb, setFb] = useState<Record<string, { pump?: string; kater?: string; gelenke?: string }>>({});
  const [gelenke, setGelenke] = useState<'gut' | 'zieht' | 'schmerzt' | ''>('');
  const [notiz, setNotiz] = useState(''); const [sagen, setSagen] = useState(false);
  const [hinweise, setHinweise] = useState<string[]>([]);
  const [toast, setToast] = useToast();
  const start = useRef(Date.now());

  const uebernehmen = (x: Einheit) => {
    setE(x);
    setSaetze((s) => Object.fromEntries(x.uebungen.map((u) => [u.uebung, s[u.uebung]?.length === u.saetze ? s[u.uebung] : Array(u.saetze).fill(null)])));
    setWert((w) => Object.fromEntries(x.uebungen.map((u) => [u.uebung, w[u.uebung] ?? u.zielWdh])));
  };
  useEffect(() => { api<{ einheit: Einheit }>('/api/training').then((r) => uebernehmen(r.einheit)).catch((x) => setToast((x as Error).message, 'err')); }, [setToast]);
  useEffect(() => { if (!pause) return; const t = setInterval(() => setJetzt(Date.now()), 250); return () => clearInterval(t); }, [pause]);
  useEffect(() => { if (pause && jetzt >= pause.bis) { setPause(null); try { navigator.vibrate?.(200); } catch {} } }, [jetzt, pause]);
  // Bildschirm bleibt an, solange die Einheit läuft
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, []);

  function satz(u: Geplant, i: number) {
    setSaetze((s) => ({ ...s, [u.uebung]: s[u.uebung].map((x, j) => (j === i ? (x === null ? wert[u.uebung] : null) : x)) }));
    if (saetze[u.uebung][i] === null) { setPause({ bis: Date.now() + u.pause * 1000, dauer: u.pause }); setJetzt(Date.now()); }
  }
  async function tauschen(m: string) {
    try { const r = await api<{ einheit: Einheit }>('/api/training', { method: 'PATCH', body: JSON.stringify({ tausch: { muskel: m } }) }); uebernehmen(r.einheit); }
    catch (x) { setToast((x as Error).message, 'err'); }
  }
  async function speichern() {
    const ergebnisse = (e?.uebungen ?? []).map((u) => ({ uebung: u.uebung, wdh: (saetze[u.uebung] ?? []).map((x) => x ?? 0) }));
    const feedback: Record<string, unknown> = {};
    for (const [m, f] of Object.entries(fb)) feedback[m] = { ...f };
    if (gelenke) for (const u of e?.uebungen ?? []) feedback[u.muskel] = { ...(feedback[u.muskel] as object), gelenke: gelenke === 'gut' ? 'gut' : (fb[u.muskel]?.gelenke ?? 'gut') };
    try {
      const r = await api<{ hinweise: string[] }>('/api/training', { method: 'POST', body: JSON.stringify({ art: 'kraft', saetze: ergebnisse, feedback, notiz, dauer_min: Math.round((Date.now() - start.current) / 60000) }) });
      setHinweise(r.hinweise); setPhase('fertig');
    } catch (x) { setToast((x as Error).message, 'err'); }
  }

  const gemacht = Object.values(saetze).flat().filter((x) => x !== null).length;
  const rest = pause ? Math.max(0, Math.ceil((pause.bis - jetzt) / 1000)) : 0;
  const muskelnMitSatz = (e?.uebungen ?? []).filter((u) => saetze[u.uebung]?.some((x) => x !== null));

  return (
    <main className="wrap">
      <TopBar title="Training" back={{ label: 'Körper', href: '/koerper' }} />
      <header className="head"><span className="eyebrow">Ganzkörper · Woche {e?.woche ?? '–'} von 5</span><h1 className="title">Training<i>.</i></h1>{e ? <p className="muted">{e.rir}. Bei den Sätzen zählt Technik vor Tempo.</p> : null}</header>

      {phase === 'laeuft' && e ? <>
        {e.uebungen.map((u) => (
          <section key={u.uebung} className="gsec" aria-label={u.name}>
            <h2 className="glabel">{MUSKEL[u.muskel]}</h2>
            <div className="group pad uebung">
              <div className="ue-kopf"><b>{u.name}</b><span className="muted small">{u.saetze} {u.saetze === 1 ? 'Satz' : 'Sätze'} · Ziel {u.zielWdh} {u.sekunden ? 'Sekunden' : 'Wiederholungen'}</span></div>
              <details className="disclose"><summary>So geht es</summary><p className="small muted">{u.hinweis}</p></details>
              <div className="ue-wert" role="group" aria-label="Wert für den nächsten Satz">
                <button type="button" className="fb-chip" aria-label="weniger" onClick={() => setWert((w) => ({ ...w, [u.uebung]: Math.max(1, (w[u.uebung] ?? u.zielWdh) - (u.sekunden ? 5 : 1)) }))}>−</button>
                <span className="num big-num">{wert[u.uebung] ?? u.zielWdh}</span>
                <button type="button" className="fb-chip" aria-label="mehr" onClick={() => setWert((w) => ({ ...w, [u.uebung]: (w[u.uebung] ?? u.zielWdh) + (u.sekunden ? 5 : 1) }))}>+</button>
              </div>
              <div className="fb-opts">
                {(saetze[u.uebung] ?? []).map((x, i) => (
                  <button key={i} type="button" className="fb-chip satz" aria-pressed={x !== null} onClick={() => satz(u, i)}>{x === null ? `Satz ${i + 1}` : `✓ ${x}`}</button>
                ))}
              </div>
              <button type="button" className="linkbtn fb-say" onClick={() => tauschen(u.muskel)}>Übung tauschen</button>
            </div>
          </section>
        ))}
        <button type="button" className="btn primary wide" disabled={!gemacht} onClick={() => setPhase('feedback')}>Einheit beenden</button>
      </> : null}

      {phase === 'feedback' ? (
        <div className="group pad fb">
          <div className="fb-head"><b>Wie war es?</b><span>Damit passt Life die Sätze für nächstes Mal an. Alles freiwillig.</span></div>
          {muskelnMitSatz.map((u) => (
            <div key={u.muskel} className="fb-q">
              <span className="fb-frage">{MUSKEL[u.muskel]}</span>
              <span className="fb-sub">Pump</span>
              <div className="fb-opts" role="radiogroup" aria-label={`Pump ${MUSKEL[u.muskel]}`}>{PUMP.map((p) => <button key={p} type="button" role="radio" aria-checked={fb[u.muskel]?.pump === p} className="fb-chip" onClick={() => setFb((f) => ({ ...f, [u.muskel]: { ...f[u.muskel], pump: p } }))}>{p}</button>)}</div>
              <span className="fb-sub">Muskelkater seit letztem Mal</span>
              <div className="fb-opts" role="radiogroup" aria-label={`Muskelkater ${MUSKEL[u.muskel]}`}>{KATER.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={fb[u.muskel]?.kater === k} className="fb-chip" onClick={() => setFb((f) => ({ ...f, [u.muskel]: { ...f[u.muskel], kater: k } }))}>{l}</button>)}</div>
            </div>
          ))}
          <div className="fb-q">
            <span className="fb-frage">Gelenke</span>
            <div className="fb-opts" role="radiogroup" aria-label="Gelenke">{(['gut', 'zieht', 'schmerzt'] as const).map((g) => <button key={g} type="button" role="radio" aria-checked={gelenke === g} className="fb-chip" onClick={() => setGelenke(g)}>{g}</button>)}</div>
            {gelenke && gelenke !== 'gut' ? <>
              <span className="fb-sub">Wo?</span>
              <div className="fb-opts" role="group" aria-label="Wo zieht oder schmerzt es">{muskelnMitSatz.map((u) => <button key={u.muskel} type="button" aria-pressed={fb[u.muskel]?.gelenke === gelenke} className="fb-chip" onClick={() => setFb((f) => ({ ...f, [u.muskel]: { ...f[u.muskel], gelenke: f[u.muskel]?.gelenke === gelenke ? 'gut' : gelenke } }))}>{MUSKEL[u.muskel]}</button>)}</div>
            </> : null}
          </div>
          {sagen ? <textarea className="fb-text" rows={2} placeholder="Eigene Worte, gern diktiert" value={notiz} onChange={(x) => setNotiz(x.target.value)} autoFocus />
            : <button type="button" className="linkbtn fb-say" onClick={() => setSagen(true)}>Etwas dazu sagen</button>}
          <button type="button" className="btn primary" onClick={speichern}>Speichern</button>
        </div>
      ) : null}

      {phase === 'fertig' ? (
        <div className="group pad">
          <p className="coach-text">Fertig. {gemacht === 1 ? 'Ein Satz ist' : `${gemacht} Sätze sind`} festgehalten.</p>
          {hinweise.map((h) => <p key={h} className="small muted">{h}</p>)}
          <Link className="btn primary" href="/koerper">Zurück zu Körper</Link>
        </div>
      ) : null}

      {pause ? (
        <div className="pausebar" role="timer" aria-live="polite">
          <span>Pause</span><b className="num">{Math.floor(rest / 60)}:{String(rest % 60).padStart(2, '0')}</b>
          <button type="button" className="chipbtn" onClick={() => setPause(null)}>Weiter</button>
          <i style={{ width: `${(rest / pause.dauer) * 100}%` }} />
        </div>
      ) : null}
      {toast}
    </main>
  );
}

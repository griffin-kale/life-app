'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, TopBar, api, useToast } from '../../ui';
import { atemPhase, skript, VORLAGEN, vorlage, WIMHOF, WIMHOF_REGELN, type Art, type Hinweis } from '@/lib/ruhe';

/** Gong aus mehreren Sinustönen mit langem Ausklang, im Browser erzeugt. */
function gong(ctx: AudioContext) {
  const t0 = ctx.currentTime; const out = ctx.createGain(); out.gain.value = 0.35; out.connect(ctx.destination);
  for (const [f, a, d] of [[196, 1, 7], [392 * 1.38, 0.5, 5], [196 * 5.4, 0.25, 3], [196 * 8.9, 0.12, 2]] as const) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(a, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g).connect(out); o.start(t0); o.stop(t0 + d + 0.1);
  }
}

function sprechen(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; u.rate = 0.88; u.pitch = 0.95;
    const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith('de')); if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch { /* ohne Sprachausgabe bleibt der Text auf dem Bildschirm */ }
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

type Lauf = { art: Art; minuten: number; start: number };

export default function Ruhe() {
  const [woche, setWoche] = useState<{ minuten: number; tage: number } | null>(null);
  const [wahl, setWahl] = useState<Record<string, number>>({});
  const [lauf, setLauf] = useState<Lauf | null>(null);
  const [jetzt, setJetzt] = useState(Date.now());
  const [text, setText] = useState('');
  const [fertig, setFertig] = useState<Art | null>(null);
  const [regeln, setRegeln] = useState<boolean[]>(WIMHOF_REGELN.map(() => false));
  const [wimhofOffen, setWimhofOffen] = useState(false);
  // Wim Hof: Runde, Phase, Startzeit der Phase, gemessene Haltezeiten
  const [wh, setWh] = useState<{ runde: number; phase: 'atmen' | 'halten' | 'einatmen'; seit: number; zeiten: number[] } | null>(null);
  const [toast, setToast] = useToast();
  const ctx = useRef<AudioContext | null>(null);
  const gesagt = useRef<Set<number>>(new Set());
  const lock = useRef<{ release: () => Promise<void> } | null>(null);

  const laden = useCallback(() => api<{ minuten: number; tage: number }>('/api/ruhe').then(setWoche).catch(() => {}), []);
  useEffect(() => { laden(); }, [laden]);
  // Aus „Empfohlen für dich“: passende Vorlage hervorheben und hinscrollen, Start bleibt ein Tipp
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('vorlage');
    if (!v || !VORLAGEN.some((x) => x.id === v)) return;
    setGewaehlt(v); if (v === 'nsdr') setWahl((w) => ({ ...w, nsdr: 20 }));
    setTimeout(() => document.getElementById(`vorlage-${v}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
  }, []);
  useEffect(() => { if (!lauf) return; const t = setInterval(() => setJetzt(Date.now()), 200); return () => clearInterval(t); }, [lauf]);

  const beenden = useCallback(async (abgebrochen: boolean) => {
    if (!lauf) return;
    const sek = Math.round((Date.now() - lauf.start) / 1000);
    if (!abgebrochen && ctx.current) gong(ctx.current);
    try { speechSynthesis.cancel(); } catch {}
    lock.current?.release().catch(() => {}); lock.current = null;
    setLauf(null); setWh(null); setText('');
    if (sek >= 60) { await api('/api/ruhe', { method: 'POST', body: JSON.stringify({ art: lauf.art, dauer_sek: sek }) }).catch(() => {}); laden(); setFertig(lauf.art); }
    else if (abgebrochen) setToast('Abgebrochen. Unter einer Minute zählt Life nicht mit.');
  }, [lauf, laden, setToast]);

  // Geführte Hinweise und Ende
  const vergangen = lauf ? (jetzt - lauf.start) / 1000 : 0;
  const hinweise: Hinweis[] = lauf ? skript(lauf.art, lauf.minuten) : [];
  useEffect(() => {
    if (!lauf || lauf.art === 'wimhof') return;
    for (const h of hinweise) if (vergangen >= h.t && !gesagt.current.has(h.t)) { gesagt.current.add(h.t); setText(h.text); sprechen(h.text); }
    if (vergangen >= lauf.minuten * 60) beenden(false);
  }, [vergangen, lauf, hinweise, beenden]);

  // Wim Hof: 30 Atemzüge, dann halten bis zum Tippen, dann 15 Sekunden einatmen und halten
  useEffect(() => {
    if (!lauf || lauf.art !== 'wimhof' || !wh) return;
    const t = (jetzt - wh.seit) / 1000;
    if (wh.phase === 'atmen' && t >= WIMHOF.atemzuege * (WIMHOF.einSek + WIMHOF.ausSek)) {
      setWh({ ...wh, phase: 'halten', seit: Date.now() }); setText('Ausatmen und halten. Tipp, sobald du wieder einatmen musst.'); sprechen('Ausatmen. Und halten.');
    }
    if (wh.phase === 'einatmen' && t >= WIMHOF.haltenNachEinatmen) {
      if (wh.runde >= WIMHOF.runden) { beenden(false); return; }
      setWh({ ...wh, runde: wh.runde + 1, phase: 'atmen', seit: Date.now() }); setText(`Runde ${wh.runde + 1}. Tief ein, locker aus.`); sprechen(`Runde ${wh.runde + 1}. Tief ein, locker aus.`);
    }
  }, [jetzt, wh, lauf, beenden]);

  async function starten(art: Art, minuten: number) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    try { ctx.current ??= new C(); await ctx.current.resume(); gong(ctx.current); } catch {}
    try { const n = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }; lock.current = (await n.wakeLock?.request('screen')) ?? null; } catch {}
    gesagt.current = new Set(); setFertig(null);
    const start = Date.now(); setJetzt(start); setLauf({ art, minuten, start });
    if (art === 'wimhof') { setWh({ runde: 1, phase: 'atmen', seit: start, zeiten: [] }); setText('Runde 1. Tief ein, locker aus.'); sprechen('Runde eins. Tief ein, locker aus.'); }
    else if (art === 'stille') setText('Stille');
  }

  const v = lauf ? vorlage(lauf.art)! : null;
  const rest = lauf && lauf.art !== 'wimhof' ? Math.max(0, lauf.minuten * 60 - vergangen) : 0;
  let kreis = 0.5; let kreisText = '';
  if (lauf?.art === 'runter' && vergangen < 300 && v?.atemtakt) { const p = atemPhase(v.atemtakt, vergangen); kreis = p.phase === 'aus' ? 1 - p.anteil : p.phase === 'ein' ? 0.15 + p.anteil * 0.7 : 0.85 + p.anteil * 0.15; kreisText = p.phase === 'ein' ? 'einatmen' : p.phase === 'nach' ? 'nachatmen' : 'lang ausatmen'; }
  if (wh?.phase === 'atmen') { const z = WIMHOF.einSek + WIMHOF.ausSek; const t = ((jetzt - wh.seit) / 1000) % z; kreis = t < WIMHOF.einSek ? 0.2 + (t / WIMHOF.einSek) * 0.8 : 1 - ((t - WIMHOF.einSek) / WIMHOF.ausSek) * 0.8; kreisText = `${Math.min(WIMHOF.atemzuege, Math.floor((jetzt - wh.seit) / 1000 / z) + 1)} von ${WIMHOF.atemzuege}`; }
  if (wh?.phase === 'halten') { kreis = 0.2; kreisText = mmss((jetzt - wh.seit) / 1000); }
  if (wh?.phase === 'einatmen') { kreis = 1; kreisText = `halten ${Math.ceil(WIMHOF.haltenNachEinatmen - (jetzt - wh.seit) / 1000)}`; }

  if (lauf && v) return (
    <main className="ruhe-lauf immer-dunkel" aria-live="polite">
      <span className="eyebrow">{v.name}</span>
      <div className="atemkreis" style={{ transform: `scale(${0.45 + kreis * 0.55})` }} aria-hidden="true" />
      <b className="ruhe-zeit num">{kreisText || (lauf.art === 'wimhof' ? '' : mmss(rest))}</b>
      <p className="ruhe-text">{text}</p>
      {wh?.phase === 'halten' ? <button type="button" className="btn primary wide" onClick={() => { const s = Math.round((Date.now() - wh.seit) / 1000); setWh({ ...wh, phase: 'einatmen', seit: Date.now(), zeiten: [...wh.zeiten, s] }); setText('Tief einatmen und 15 Sekunden halten.'); sprechen('Tief einatmen. Und halten.'); }}>Ich atme wieder</button> : null}
      {wh?.zeiten.length ? <p className="small muted">Gehalten: {wh.zeiten.map(mmss).join(' · ')}</p> : null}
      <button type="button" className="linkbtn" onClick={() => beenden(true)}>Beenden</button>
    </main>
  );

  return (
    <main className="wrap">
      <TopBar title="Ruhe" back={{ label: 'Körper', href: '/koerper' }} />
      <header className="head"><span className="eyebrow">Diese Woche {woche ? `${woche.minuten} Min. an ${woche.tage} ${woche.tage === 1 ? 'Tag' : 'Tagen'}` : '…'}</span><h1 className="title">Ruhe<i>.</i></h1></header>
      {fertig ? (
        <div className="group pad">
          <p className="coach-text">Fertig. Die Minuten sind festgehalten.</p>
          {fertig === 'runter' ? <Link className="btn primary" href="/">Jetzt die Abendfragen</Link> : null}
        </div>
      ) : null}
      {VORLAGEN.map((x) => (
        <section key={x.id} id={`vorlage-${x.id}`} className={`ruhekarte r-${x.id}${gewaehlt === x.id ? ' gewaehlt' : ''}`} aria-label={x.name}>
          <div className="ruhekarte-kopf"><h2>{x.name}</h2><p>{x.beschreibung}</p></div>
          {x.id === 'wimhof' && !wimhofOffen ? <>
            <p className="ruhekarte-warn">Die Atmung kann zu kurzer Ohnmacht führen. Mach sie nur unter diesen Bedingungen:</p>
            <div className="ruhekarte-regeln" role="group" aria-label="Sicherheit">
              {WIMHOF_REGELN.map((r, i) => <button key={r} type="button" aria-pressed={regeln[i]} className="dpill" onClick={() => setRegeln((g) => g.map((y, j) => (j === i ? !y : y)))}>{regeln[i] ? Icon.check : null}{r}</button>)}
            </div>
            <button type="button" className="dpill hell" disabled={!regeln.every(Boolean)} onClick={() => setWimhofOffen(true)}>Verstanden</button>
          </> : (
            <div className="ruhekarte-fuss">
              {x.minuten.length > 1 ? (
                <div className="ruhekarte-dauer" role="radiogroup" aria-label={`Dauer ${x.name}`}>{x.minuten.map((m) => <button key={m} type="button" role="radio" aria-checked={(wahl[x.id] ?? x.minuten[0]) === m} className="dpill" onClick={() => setWahl((w) => ({ ...w, [x.id]: m }))}>{m} Min.</button>)}</div>
              ) : <span className="dpill still">Etwa {x.minuten[0]} Min.</span>}
              <button type="button" className="play" aria-label="Starten" onClick={() => starten(x.id, wahl[x.id] ?? x.minuten[0])}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" fill="currentColor" /></svg></button>
            </div>
          )}
        </section>
      ))}
      <p className="gnote">Der Bildschirm bleibt während der Sitzung an. Bei gesperrtem iPhone setzen Ton und Stimme aus. Hält Unruhe, Schwindel oder Herzrasen an, lass es ärztlich abklären.</p>
      {toast}
    </main>
  );
}

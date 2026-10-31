'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TabBar, TopBar, api, useToast } from '../../ui';
import { Blaetter, type BlaetterSteuerung } from '../../blaetter';
import { BEREICH_TITEL, BEREICHE_S, HINDERNISSE, ZIEL_IDEEN, plusTage, wennDannSatz, type SBereich, type Vorschlag } from '@/lib/saison-regeln';

type Grundlage = { saison: { id: number } | null; start: string; vorschlaege: Vorschlag[]; coach?: { bereich: SBereich; text: string }[] };
type Wahl = { titel: string; zielwert: string; hebel: string[]; eigeneHebel: string; wenn: string; dann: string };
type Ideen = Record<string, { hebel: string[]; dann: string }>;
const LEITSAETZE = ['Erst das Wichtige, dann das Laute.', 'Weniger, aber besser.', 'Um sechs bin ich bei der Familie.'];
const leer = (): Wahl => ({ titel: '', zielwert: '', hebel: [], eigeneHebel: '', wenn: HINDERNISSE[0], dann: '' });
const datum = (t: string) => new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(t + 'T12:00:00Z'));

/**
 * Blatt „Neue Saison“ (Life 2.0, Phase 2): Zeitraum und Leitsatz, ein Ziel pro Bereich, Hebel und Wenn-dann, Fertig.
 * Alles zum Antippen. Eigene Worte gehen immer, Claude schlägt Hebel vor und sieht dabei nur Platzhalter.
 */
export default function NeueSaison() {
  const [g, setG] = useState<Grundlage | null>(null);
  const [start, setStart] = useState('');
  const [leitsatz, setLeitsatz] = useState('');
  const [wahl, setWahl] = useState<Record<string, Wahl>>({});
  const [eigen, setEigen] = useState<Record<string, string>>({});
  const [ideen, setIdeen] = useState<Ideen | null>(null);
  const [fragt, setFragt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useToast();
  const blatt = useRef<BlaetterSteuerung>(null);
  const gefragt = useRef('');
  const router = useRouter();

  useEffect(() => {
    api<Grundlage>('/api/saison').then((x) => {
      if (x.saison) { router.replace('/ziele'); return; }
      setG(x); setStart(x.start);
      // Ziele, die der Coach vorgeschlagen hat, sind vorgewählt. Peter tippt an, was nicht passt.
      if (x.coach?.length) setWahl(Object.fromEntries(x.coach.map((z) => [z.bereich, { ...leer(), titel: z.text }])));
    }).catch((e) => setToast((e as Error).message, 'err'));
  }, [router, setToast]);

  const gewaehlt = useMemo(() => BEREICHE_S.filter((b) => wahl[b]?.titel.trim()), [wahl]);
  const setze = (b: SBereich, teil: Partial<Wahl>) => setWahl((w) => ({ ...w, [b]: { ...(w[b] ?? leer()), ...teil } }));

  // Beim Blättern auf die Hebel fragt Life Claude einmal pro Zielauswahl
  const hebelHolen = useCallback(async () => {
    const schluessel = gewaehlt.map((b) => `${b}:${wahl[b].titel}`).join('|');
    if (!gewaehlt.length || gefragt.current === schluessel) return;
    gefragt.current = schluessel; setFragt(true);
    try {
      const r = await api<{ vorschlaege: Ideen }>('/api/saison/hebel', { method: 'POST', body: JSON.stringify({ ziele: gewaehlt.map((b) => ({ bereich: b, titel: wahl[b].titel, wenn: HINDERNISSE[0] })) }) });
      setIdeen(r.vorschlaege);
      // Vorschläge sind vorgewählt, solange Peter für dieses Ziel noch nichts gewählt hat
      setWahl((w) => {
        const neu = { ...w };
        for (const b of gewaehlt) {
          const v = r.vorschlaege[b]; if (!v) continue;
          neu[b] = { ...neu[b], hebel: neu[b].hebel.length ? neu[b].hebel : v.hebel, dann: neu[b].dann || v.dann };
        }
        return neu;
      });
    } catch (e) { setToast((e as Error).message, 'err'); setIdeen({}); }
    finally { setFragt(false); }
  }, [gewaehlt, wahl, setToast]);
  const seite = useCallback((i: number) => { if (i === 2) hebelHolen(); }, [hebelHolen]);

  function hebelUmschalten(b: SBereich, h: string) {
    const w = wahl[b]; if (!w) return;
    setze(b, { hebel: w.hebel.includes(h) ? w.hebel.filter((x) => x !== h) : w.hebel.length >= 3 ? w.hebel : [...w.hebel, h] });
  }
  function eigenenHebel(b: SBereich) {
    const w = wahl[b]; const t = w?.eigeneHebel.trim(); if (!w || !t || w.hebel.length >= 3) return;
    setze(b, { hebel: [...w.hebel, t.slice(0, 80)], eigeneHebel: '' });
  }

  async function anlegen() {
    setBusy(true);
    try {
      await api('/api/saison', { method: 'POST', body: JSON.stringify({
        start, leitsatz,
        ziele: gewaehlt.map((b) => {
          const w = wahl[b]; const zw = parseInt(w.zielwert, 10);
          return { bereich: b, titel: w.titel, zielwert: Number.isInteger(zw) && zw > 0 ? zw : null, hebel: w.hebel.map((t) => ({ titel: t, art: 'kalender' })), wenn: w.dann.trim() ? w.wenn : '', dann: w.dann };
        }),
      }) });
      router.push('/ziele');
    } catch (e) { setToast((e as Error).message, 'err'); setBusy(false); }
  }

  const ideenFuer = (b: SBereich) => {
    const aus = (g?.vorschlaege ?? []).filter((v) => v.bereich === b || (b === 'geschaeft' && v.bereich === null)).map((v) => v.text);
    return [...new Set([...aus, ...ZIEL_IDEEN[b]])].slice(0, 5);
  };

  const seiten = g ? [
    <div key="z" className="ws-seite">
      <h2 className="ws-titel">Zeitraum und Leitsatz</h2>
      <span className="fb-frage">Wann geht es los?</span>
      <div className="fb-opts stack" role="radiogroup" aria-label="Start">
        {[g.start, plusTage(g.start, 7)].map((t) => <button key={t} type="button" role="radio" aria-checked={start === t} className="fb-chip left" onClick={() => setStart(t)}>Ab {datum(t)}, zwölf Wochen</button>)}
      </div>
      <span className="fb-frage">Dein Leitsatz für die Saison</span>
      <p className="muted small">Ein Satz, der dir hilft, wenn zwei Dinge gleichzeitig wollen. Darf leer bleiben.</p>
      <div className="fb-opts stack" role="radiogroup" aria-label="Leitsatz">
        {LEITSAETZE.map((l) => <button key={l} type="button" role="radio" aria-checked={leitsatz === l} className="fb-chip left" onClick={() => setLeitsatz(leitsatz === l ? '' : l)}>{l}</button>)}
      </div>
      <textarea className="fb-text" rows={2} value={LEITSAETZE.includes(leitsatz) ? '' : leitsatz} onChange={(e) => setLeitsatz(e.target.value)} placeholder="Etwas dazu sagen: eigener Leitsatz, gern diktiert" aria-label="Eigener Leitsatz" maxLength={160} />
    </div>,

    <div key="b" className="ws-seite">
      <h2 className="ws-titel">Ein Ziel pro Bereich</h2>
      <p className="muted small">Wenige Ziele tragen weiter. Lass leer, was in dieser Saison nicht dran ist.</p>
      {g.coach?.length ? <p className="sz-coach">Der Coach hat {g.coach.length === 1 ? 'ein Ziel' : `${g.coach.length} Ziele`} aus eurem Gespräch vorgewählt. Tipp an, was nicht passt.</p> : null}
      {BEREICHE_S.map((b) => {
        const w = wahl[b]; const ideenB = ideenFuer(b);
        return (
          <div key={b} className="fb-q sz-blatt-bereich">
            <span className="fb-frage">{BEREICH_TITEL[b]}</span>
            <div className="fb-opts" role="radiogroup" aria-label={BEREICH_TITEL[b]}>
              <button type="button" role="radio" aria-checked={!w?.titel} className="fb-chip" onClick={() => setze(b, { titel: '' })}>Leer lassen</button>
              {ideenB.map((t) => <button key={t} type="button" role="radio" aria-checked={w?.titel === t} className="fb-chip" onClick={() => setze(b, { titel: t, hebel: w?.titel === t ? w.hebel : [] })}>{t}</button>)}
              {w?.titel && !ideenB.includes(w.titel) ? <button type="button" role="radio" aria-checked className="fb-chip">{w.titel}</button> : null}
            </div>
            <div className="geld-neu">
              <input value={eigen[b] ?? ''} onChange={(e) => setEigen({ ...eigen, [b]: e.target.value })} placeholder="Etwas dazu sagen: eigenes Ziel" aria-label={`Eigenes Ziel ${BEREICH_TITEL[b]}`} maxLength={80}
                onKeyDown={(e) => { if (e.key === 'Enter' && (eigen[b] ?? '').trim().length >= 3) { e.preventDefault(); setze(b, { titel: eigen[b].trim(), hebel: [] }); setEigen({ ...eigen, [b]: '' }); } }} />
              <button type="button" className="chipbtn" disabled={(eigen[b] ?? '').trim().length < 3} onClick={() => { setze(b, { titel: eigen[b].trim(), hebel: [] }); setEigen({ ...eigen, [b]: '' }); }}>Nehmen</button>
            </div>
            {w?.titel ? (
              <label className="sz-zahl">Messbar? Zielzahl für die zwölf Wochen
                <input inputMode="numeric" value={w.zielwert} onChange={(e) => setze(b, { zielwert: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="zum Beispiel 10" aria-label={`Zielzahl ${BEREICH_TITEL[b]}`} />
              </label>
            ) : null}
          </div>
        );
      })}
    </div>,

    <div key="h" className="ws-seite">
      <h2 className="ws-titel">Hebel und Wenn-dann</h2>
      {!gewaehlt.length ? <p className="muted small">Wähl zuerst mindestens ein Ziel.</p> : <p className="muted small">Bis zu drei Hebel pro Ziel: regelmäßige Handlungen, die das Ziel tragen.{fragt ? ' Claude macht Vorschläge …' : ''}</p>}
      {gewaehlt.map((b) => {
        const w = wahl[b]; const v = ideen?.[b];
        const angebot = [...new Set([...(v?.hebel ?? []), ...w.hebel])];
        return (
          <div key={b} className="fb-q sz-blatt-bereich">
            <span className="sz-bereich" style={{ '--k': b === 'geschaeft' ? 'var(--sky)' : `var(--k-${b})` } as React.CSSProperties}>{BEREICH_TITEL[b]}</span>
            <span className="fb-frage">Was trägt „{w.titel}“?</span>
            <div className="fb-opts stack" role="group" aria-label={`Hebel für ${w.titel}`}>
              {angebot.map((h) => <button key={h} type="button" aria-pressed={w.hebel.includes(h)} className="fb-chip left" disabled={!w.hebel.includes(h) && w.hebel.length >= 3} onClick={() => hebelUmschalten(b, h)}>{h}</button>)}
            </div>
            <div className="geld-neu">
              <input value={w.eigeneHebel} onChange={(e) => setze(b, { eigeneHebel: e.target.value })} placeholder="Etwas dazu sagen: eigener Hebel" aria-label={`Eigener Hebel für ${w.titel}`} maxLength={80}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); eigenenHebel(b); } }} />
              <button type="button" className="chipbtn" disabled={!w.eigeneHebel.trim() || w.hebel.length >= 3} onClick={() => eigenenHebel(b)}>Dazu</button>
            </div>
            <span className="fb-frage">Woran könnte es scheitern?</span>
            <div className="fb-opts" role="radiogroup" aria-label={`Hindernis für ${w.titel}`}>
              {HINDERNISSE.map((x) => <button key={x} type="button" role="radio" aria-checked={w.wenn === x} className="fb-chip" onClick={() => setze(b, { wenn: x, dann: x === HINDERNISSE[0] && v?.dann ? v.dann : '' })}>{x}</button>)}
            </div>
            <textarea className="fb-text" rows={2} value={w.dann} onChange={(e) => setze(b, { dann: e.target.value })} placeholder="Dann tue ich stattdessen …" aria-label={`Dann-Plan für ${w.titel}`} maxLength={160} />
            {wennDannSatz(w.wenn, w.dann) ? <p className="sz-wenn">{wennDannSatz(w.wenn, w.dann)}</p> : null}
          </div>
        );
      })}
    </div>,

    <div key="f" className="ws-seite">
      <h2 className="ws-titel">Fertig</h2>
      <ul className="ws-liste">
        <li>Ab {start ? datum(start) : '…'}, zwölf Wochen</li>
        <li>Leitsatz: {leitsatz.trim() || 'keiner'}</li>
        {gewaehlt.map((b) => <li key={b}><b>{BEREICH_TITEL[b]}:</b> {wahl[b].titel}{wahl[b].zielwert ? ` (Ziel ${wahl[b].zielwert})` : ''} · {wahl[b].hebel.length} {wahl[b].hebel.length === 1 ? 'Hebel' : 'Hebel'}</li>)}
      </ul>
      <button type="button" className="btn primary wide" onClick={anlegen} disabled={busy || !gewaehlt.length || !start}>{busy ? 'Speichert …' : 'Saison anlegen'}</button>
      {!gewaehlt.length ? <p className="muted small">Wähl mindestens ein Ziel.</p> : null}
    </div>,
  ] : [];

  return (
    <main className="wrap">
      <TopBar title="Neue Saison" back={{ label: 'Plan', href: '/ziele' }} />
      <header className="head"><span className="eyebrow">Zwölf Wochen, wenige Ziele</span><h1 className="title">Neue Saison<i>.</i></h1></header>
      {g ? <div className="group pad"><Blaetter ref={blatt} seiten={seiten} label="Neue Saison" onSeite={seite} /></div> : <p className="loading">Lädt …</p>}
      {toast}
      <TabBar />
    </main>
  );
}
